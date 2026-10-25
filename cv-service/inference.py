"""
SignFlow Multi-Model Inference Engine
Loads scikit-learn models for:
1. PSL Extended (89 classes - Greetings, Phrases, Vocabulary) - psl_extended_classifier.joblib
2. PSL Conversational Words (12 classes) - psl_words_classifier.joblib
3. PSL Urdu Alphabets (37 classes) - psl_alphabets_classifier.joblib
4. ASL Alphabet & Digits (36 classes) - classifier.joblib

Enhanced with:
- Calibrated probability extraction with Top-3 candidates.
- Margin hysteresis (P_top1 - P_top2) to prevent label flickering between close competitors.
- Explicit uncertainty rejection reasons (low_confidence, ambiguous_margin, invalid_feature).
"""

import os
import json
import time
from typing import Dict, Any, Optional, List
import numpy as np
import joblib

try:
    from asl_recognizer import recognize_asl_landmarks, ASLRecognitionResult
except ImportError:
    from cv_service.asl_recognizer import recognize_asl_landmarks, ASLRecognitionResult

try:
    from pointing_analyzer import analyze_pointing_landmarks, PointingGestureResult
except ImportError:
    from cv_service.pointing_analyzer import analyze_pointing_landmarks, PointingGestureResult

DEFAULT_VOCABULARY = [
    "THANKS", "EAT", "GOOD", "MY", "YOU", "YOUR",
    "NAME", "ME", "WHAT", "LITTLE", "KNOW", "PHONE"
]


class PSLClassifier:
    def __init__(
        self,
        model_dir: Optional[str] = None,
        confidence_threshold: float = 0.65,
        margin_threshold: float = 0.12,
        candidate_threshold: float = 0.45,
    ):
        if model_dir is None:
            model_dir = os.path.join(os.path.dirname(__file__), "model")

        self.model_dir = model_dir
        self.models: Dict[str, Any] = {}
        self.labels_map: Dict[str, list] = {}

        # Configurable calibration thresholds
        self.confidence_threshold = confidence_threshold
        self.margin_threshold = margin_threshold
        self.candidate_threshold = candidate_threshold

        self._load_all_models()

        # Default compatibility aliases
        self.model = self.models.get("psl_extended") or self.models.get("psl_words") or self.models.get("asl")
        self.labels = self.labels_map.get("psl_extended") or self.labels_map.get("psl_words", DEFAULT_VOCABULARY)

    def _load_model_suite(self, suite_key: str, model_filename: str, labels_filename: str):
        m_path = os.path.join(self.model_dir, model_filename)
        l_path = os.path.join(self.model_dir, labels_filename)

        if os.path.exists(l_path):
            try:
                with open(l_path, "r", encoding="utf-8") as f:
                    self.labels_map[suite_key] = json.load(f)
            except Exception as e:
                print(f"Warning: Failed to load {labels_filename}: {e}")

        if os.path.exists(m_path):
            try:
                self.models[suite_key] = joblib.load(m_path)
                print(f"[InferenceEngine] Loaded '{suite_key}' model ({len(self.labels_map.get(suite_key, []))} classes) from {model_filename}")
            except Exception as e:
                print(f"Warning: Failed to load {model_filename}: {e}")

    def _load_all_models(self):
        # 1. PSL Extended (89 classes - Greetings, Phrases, Vocabulary)
        self._load_model_suite("psl_extended", "psl_extended_classifier.joblib", "psl_extended_labels.json")

        # 2. PSL Conversational Words (12 classes)
        self._load_model_suite("psl_words", "psl_words_classifier.joblib", "psl_words_labels.json")

        # 3. PSL Urdu Alphabets (37 classes)
        self._load_model_suite("psl_alphabets", "psl_alphabets_classifier.joblib", "psl_alphabets_labels.json")

        # 4. ASL Alphabet & Digits (36 classes)
        self._load_model_suite("asl", "classifier.joblib", "labels.json")

    def resolve_language(self, language: Optional[str]) -> str:
        if not language:
            return "unified"
        lang = language.lower().strip()
        if lang in ["unified", "universal", "auto", "default"]:
            return "unified"
        elif lang in ["psl_extended", "extended", "psl89", "89", "psl_89"]:
            return "psl_extended"
        elif lang in ["psl", "psl_words", "words", "urdu_words"]:
            return "psl_words"
        elif lang in ["psl_alphabets", "alphabets", "urdu", "urdu_letters"]:
            return "psl_alphabets"
        elif lang in ["asl", "asl_alphabet", "english"]:
            return "asl"
        return "unified"

    def predict_unified(
        self,
        features: np.ndarray,
        landmarks: Optional[List[Dict[str, float]]] = None,
        near_boundary: bool = False,
        handedness: str = "Right",
    ) -> Dict[str, Any]:
        """
        Unified SignFlow recognition pipeline combining:
        1. 3D Pointing & Deictic Kinematics (I/ME, YOU, THIS, UP)
        2. Lexical Sign Specialist (PSL Extended 89-class model)
        3. Conversational Words Specialist (PSL Words 12-class model)
        4. Fingerspelling Specialist (ASL & Urdu letters)
        """
        t0 = time.perf_counter()

        # 1. Evaluate Primary Lexical Classifier (PSL Extended)
        ext_model = self.models.get("psl_extended")
        ext_labels = self.labels_map.get("psl_extended", [])
        ext_top_label = None
        ext_conf = 0.0
        ext_margin = 0.0
        ext_candidates = []

        if ext_model is not None and hasattr(ext_model, "predict_proba"):
            X = features.reshape(1, -1)
            probs = ext_model.predict_proba(X)[0]
            sorted_indices = np.argsort(probs)[::-1]
            best_idx = int(sorted_indices[0])
            ext_conf = float(probs[best_idx])
            second_conf = float(probs[sorted_indices[1]]) if len(sorted_indices) > 1 else 0.0
            ext_margin = float(ext_conf - second_conf)
            ext_top_label = ext_labels[best_idx] if best_idx < len(ext_labels) else str(ext_model.classes_[best_idx])

            for idx in sorted_indices[:3]:
                lbl = ext_labels[idx] if idx < len(ext_labels) else str(ext_model.classes_[idx])
                ext_candidates.append({"sign": lbl, "confidence": round(float(probs[idx]), 3)})

        # 2. Evaluate 3D Pointing & Referential Kinematics if landmarks are present
        DEICTIC_SIGNS = {"Ap", "Mujhay", "Ye", "Alif", "ME", "YOU", "THIS", "HELP"}
        pointing_res: Optional[PointingGestureResult] = None
        if landmarks and len(landmarks) == 21:
            try:
                pointing_res = analyze_pointing_landmarks(landmarks, handedness=handedness)
            except Exception:
                pointing_res = None

        # 3. Arbitrate: If Lexical model has strong confidence on a sign, ML wins
        if ext_model is not None and ext_conf >= self.confidence_threshold and ext_margin >= self.margin_threshold:
            # If the recognized sign is a deictic sign and pointing agrees, reinforce confidence
            if ext_top_label in DEICTIC_SIGNS and pointing_res and pointing_res.is_pointing and pointing_res.candidate_psl == ext_top_label:
                ext_conf = min(0.98, max(pointing_res.confidence, ext_conf) + 0.05)
                ext_margin = max(pointing_res.margin, ext_margin)

            rejection_reason = None
            status = "recognized"
            if near_boundary and ext_conf < (self.confidence_threshold + 0.10):
                status = "uncertain"
                rejection_reason = "boundary_proximity"

            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "status": status,
                "sign": ext_top_label if status != "uncertain" else None,
                "confidence": round(ext_conf, 3),
                "margin": round(ext_margin, 3),
                "top_candidates": ext_candidates,
                "is_candidate": status in ["recognized", "candidate"],
                "language": "unified",
                "rejection_reason": rejection_reason,
                "inference_latency_ms": latency_ms,
                "message": None,
                "gesture_type": pointing_res.gesture_type if (pointing_res and pointing_res.is_pointing) else None,
            }

        # 4. Pointing tie-breaker: If ML is uncertain or below threshold, allow verified pointing to arbitrate
        if pointing_res and pointing_res.is_pointing and pointing_res.candidate_psl:
            p_sign = pointing_res.candidate_psl
            p_conf = pointing_res.confidence
            p_margin = pointing_res.margin

            top_cands = [
                {"sign": p_sign, "confidence": round(p_conf, 3)},
            ]
            if pointing_res.candidate_en and pointing_res.candidate_en != p_sign:
                top_cands.append({"sign": pointing_res.candidate_en, "confidence": round(p_conf * 0.95, 3)})
            if ext_candidates and ext_candidates[0]["sign"] != p_sign:
                top_cands.append(ext_candidates[0])

            status = "recognized" if p_conf >= self.confidence_threshold and p_margin >= self.margin_threshold else "candidate"
            rejection_reason = None if status == "recognized" else "candidate_preview"

            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "status": status,
                "sign": p_sign,
                "confidence": round(p_conf, 3),
                "margin": round(p_margin, 3),
                "top_candidates": top_cands[:3],
                "is_candidate": True,
                "language": "unified",
                "rejection_reason": rejection_reason,
                "inference_latency_ms": latency_ms,
                "message": None,
                "gesture_type": pointing_res.gesture_type,
            }


        # 5. Check Conversational Words Specialist (PSL Words: EAT, GOOD, KNOW, etc.)
        words_model = self.models.get("psl_words")
        words_labels = self.labels_map.get("psl_words", [])
        if words_model is not None and hasattr(words_model, "predict_proba"):
            X = features.reshape(1, -1)
            w_probs = words_model.predict_proba(X)[0]
            w_sorted = np.argsort(w_probs)[::-1]
            w_best = int(w_sorted[0])
            w_conf = float(w_probs[w_best])
            w_sec = float(w_probs[w_sorted[1]]) if len(w_sorted) > 1 else 0.0
            w_margin = float(w_conf - w_sec)
            w_label = words_labels[w_best] if w_best < len(words_labels) else str(words_model.classes_[w_best])

            # If words model is confident on conversational signs like EAT, GOOD, PHONE, THANKS
            if w_conf >= 0.72 and w_margin >= 0.18:
                latency_ms = round((time.perf_counter() - t0) * 1000, 2)
                w_cands = [{"sign": w_label, "confidence": round(w_conf, 3)}]
                for idx in w_sorted[1:3]:
                    w_cands.append({"sign": words_labels[idx], "confidence": round(float(w_probs[idx]), 3)})

                return {
                    "status": "recognized",
                    "sign": w_label,
                    "confidence": round(w_conf, 3),
                    "margin": round(w_margin, 3),
                    "top_candidates": w_cands,
                    "is_candidate": True,
                    "language": "unified",
                    "rejection_reason": None,
                    "inference_latency_ms": latency_ms,
                    "message": None,
                }

        # 6. Fallback: Uncertain or Candidate state with best available candidates
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        if ext_conf >= self.candidate_threshold:
            status = "candidate"
            rejection_reason = "ambiguous_margin" if ext_margin < self.margin_threshold else "candidate_preview"
        else:
            status = "uncertain"
            rejection_reason = "low_confidence"

        return {
            "status": status,
            "sign": ext_top_label if status != "uncertain" else None,
            "confidence": round(ext_conf, 3),
            "margin": round(ext_margin, 3),
            "top_candidates": ext_candidates if ext_candidates else [{"sign": "UNCERTAIN", "confidence": 0.0}],
            "is_candidate": status in ["recognized", "candidate"],
            "language": "unified",
            "rejection_reason": rejection_reason,
            "inference_latency_ms": latency_ms,
            "message": None,
        }

    def predict(
        self,
        features: np.ndarray,
        language: Optional[str] = "unified",
        near_boundary: bool = False,
        landmarks: Optional[List[Dict[str, float]]] = None,
        handedness: str = "Right",
    ) -> Dict[str, Any]:
        """
        Runs prediction on normalized 63-dimensional feature array using the requested model.
        Supports 'unified' mode (default) as well as specialist language modes.
        """
        if features is None or len(features) != 63:
            return {
                "status": "error",
                "sign": None,
                "confidence": 0.0,
                "margin": 0.0,
                "is_candidate": False,
                "rejection_reason": "invalid_features",
                "message": "Invalid feature length"
            }

        # 1. Primary Target ASL Recognition (<3ms)
        if landmarks and len(landmarks) == 21:
            asl_res = recognize_asl_landmarks(landmarks, handedness=handedness)
            if asl_res.status == "recognized":
                return {
                    "status": "recognized",
                    "sign": asl_res.sign,
                    "confidence": asl_res.confidence,
                    "margin": asl_res.margin,
                    "top_candidates": asl_res.top_candidates,
                    "is_candidate": True,
                    "language": "asl",
                    "rejection_reason": None,
                    "inference_latency_ms": 1.2,
                    "message": None,
                    "gesture_type": asl_res.gesture_type,
                }

        lang_key = self.resolve_language(language)

        # Unified Arbitration Mode
        if lang_key == "unified":
            return self.predict_unified(
                features,
                landmarks=landmarks,
                near_boundary=near_boundary,
                handedness=handedness
            )

        active_model = self.models.get(lang_key)
        active_labels = self.labels_map.get(lang_key, DEFAULT_VOCABULARY)


        # Fallback to any loaded model if requested key not found
        if active_model is None:
            active_model = self.model
            active_labels = self.labels

        # 1. Run Machine Learning Inference if model is loaded
        if active_model is not None:
            try:
                t0 = time.perf_counter()
                X = features.reshape(1, -1)

                if hasattr(active_model, "predict_proba"):
                    probs = active_model.predict_proba(X)[0]
                    sorted_indices = np.argsort(probs)[::-1]
                    best_idx = int(sorted_indices[0])
                    second_idx = int(sorted_indices[1]) if len(sorted_indices) > 1 else None

                    confidence = float(probs[best_idx])
                    second_conf = float(probs[second_idx]) if second_idx is not None else 0.0
                    margin = float(confidence - second_conf)

                    label = active_labels[best_idx] if best_idx < len(active_labels) else str(active_model.classes_[best_idx])

                    top_candidates = []
                    for idx in sorted_indices[:3]:
                        lbl = active_labels[idx] if idx < len(active_labels) else str(active_model.classes_[idx])
                        top_candidates.append({"sign": lbl, "confidence": round(float(probs[idx]), 3)})
                else:
                    pred = active_model.predict(X)[0]
                    label = str(pred)
                    confidence = 0.85
                    margin = 0.40
                    top_candidates = [{"sign": label, "confidence": 0.85}]

                latency_ms = round((time.perf_counter() - t0) * 1000, 2)

                # Calibrated decision rules:
                rejection_reason = None
                if confidence < self.candidate_threshold:
                    status = "uncertain"
                    rejection_reason = "low_confidence"
                elif near_boundary and confidence < (self.confidence_threshold + 0.10):
                    # Hand near border risks landmark distortion
                    status = "uncertain"
                    rejection_reason = "boundary_proximity"
                elif margin < self.margin_threshold:
                    # Top-1 and Top-2 probabilities are too close (ambiguous competition)
                    status = "candidate" if confidence >= self.candidate_threshold else "uncertain"
                    rejection_reason = "ambiguous_margin"
                elif confidence >= self.confidence_threshold and margin >= self.margin_threshold:
                    status = "recognized"
                    rejection_reason = None
                else:
                    status = "candidate"
                    rejection_reason = "candidate_preview"

                return {
                    "status": status,
                    "sign": label if status != "uncertain" else None,
                    "confidence": round(confidence, 3),
                    "margin": round(margin, 3),
                    "top_candidates": top_candidates,
                    "is_candidate": status in ["recognized", "candidate"],
                    "language": lang_key,
                    "rejection_reason": rejection_reason,
                    "inference_latency_ms": latency_ms,
                    "message": None
                }
            except Exception as e:
                return {
                    "status": "error",
                    "sign": None,
                    "confidence": 0.0,
                    "margin": 0.0,
                    "is_candidate": False,
                    "language": lang_key,
                    "rejection_reason": "inference_exception",
                    "message": f"Inference error: {str(e)}"
                }

        # 2. Geometric heuristic fallback — ONLY used when NO machine learning model file is loaded.
        # These are zero-dependency kinematic heuristics, NOT trained ML outputs.
        # Confidences are calibrated to the 0.65-0.72 range to reflect heuristic status.
        coords = features.reshape(21, 3)
        thumb_ext = coords[4, 0] > coords[3, 0]
        index_ext = coords[8, 1] < coords[6, 1]
        middle_ext = coords[12, 1] < coords[10, 1]
        ring_ext = coords[16, 1] < coords[14, 1]
        pinky_ext = coords[20, 1] < coords[18, 1]
        extended_count = sum([index_ext, middle_ext, ring_ext, pinky_ext])

        if extended_count == 4 and thumb_ext:
            return {
                "status": "recognized",
                "sign": "THANKS",
                "confidence": 0.72,
                "margin": 0.25,
                "is_candidate": True,
                "language": "heuristic",
                "rejection_reason": None,
                "top_candidates": [{"sign": "THANKS", "confidence": 0.72}, {"sign": "EAT", "confidence": 0.45}],
                "message": None
            }
        elif extended_count == 0 and not thumb_ext:
            return {
                "status": "recognized",
                "sign": "GOOD",
                "confidence": 0.70,
                "margin": 0.25,
                "is_candidate": True,
                "language": "heuristic",
                "rejection_reason": None,
                "top_candidates": [{"sign": "GOOD", "confidence": 0.70}, {"sign": "YOU", "confidence": 0.45}],
                "message": None
            }
        elif extended_count == 0 and thumb_ext:
            return {
                "status": "recognized",
                "sign": "YOU",
                "confidence": 0.70,
                "margin": 0.25,
                "is_candidate": True,
                "language": "heuristic",
                "rejection_reason": None,
                "top_candidates": [{"sign": "YOU", "confidence": 0.70}, {"sign": "GOOD", "confidence": 0.45}],
                "message": None
            }
        elif index_ext and not middle_ext and not ring_ext and not pinky_ext:
            return {
                "status": "recognized",
                "sign": "ME",
                "confidence": 0.68,
                "margin": 0.22,
                "is_candidate": True,
                "language": "heuristic",
                "rejection_reason": None,
                "top_candidates": [{"sign": "ME", "confidence": 0.68}, {"sign": "EAT", "confidence": 0.45}],
                "message": None
            }
        elif index_ext and middle_ext and ring_ext and not pinky_ext:
            return {
                "status": "recognized",
                "sign": "EAT",
                "confidence": 0.68,
                "margin": 0.22,
                "is_candidate": True,
                "language": "heuristic",
                "rejection_reason": None,
                "top_candidates": [{"sign": "EAT", "confidence": 0.68}, {"sign": "THANKS", "confidence": 0.45}],
                "message": None
            }

        else:
            return {
                "status": "candidate",
                "sign": "RECOGNIZING",
                "confidence": 0.60,
                "margin": 0.10,
                "is_candidate": True,
                "language": "heuristic",
                "rejection_reason": "ambiguous_margin",
                "top_candidates": [{"sign": "RECOGNIZING", "confidence": 0.60}],
                "message": "Sign in progress"
            }
