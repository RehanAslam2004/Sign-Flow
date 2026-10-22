"""
SignFlow Multi-Model Inference Engine
Loads scikit-learn models for:
1. PSL Conversational Words (12 classes) - psl_words_classifier.joblib
2. PSL Urdu Alphabets (37 classes) - psl_alphabets_classifier.joblib
3. ASL Alphabet & Digits (36 classes) - classifier.joblib
Evaluates normalized 63-dimensional hand features against the active language/model.
"""

import os
import json
from typing import Dict, Any, Optional
import numpy as np
import joblib

DEFAULT_VOCABULARY = [
    "THANKS", "EAT", "GOOD", "MY", "YOU", "YOUR",
    "NAME", "ME", "WHAT", "LITTLE", "KNOW", "PHONE"
]

class PSLClassifier:
    def __init__(self, model_dir: Optional[str] = None):
        if model_dir is None:
            model_dir = os.path.join(os.path.dirname(__file__), "model")

        self.model_dir = model_dir
        self.models: Dict[str, Any] = {}
        self.labels_map: Dict[str, list] = {}

        self._load_all_models()

        # Default compatibility aliases
        self.model = self.models.get("psl_words") or self.models.get("asl")
        self.labels = self.labels_map.get("psl_words") or self.labels_map.get("asl", DEFAULT_VOCABULARY)

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
        # 1. PSL Conversational Words
        self._load_model_suite("psl_words", "psl_words_classifier.joblib", "psl_words_labels.json")

        # 2. PSL Urdu Alphabets
        self._load_model_suite("psl_alphabets", "psl_alphabets_classifier.joblib", "psl_alphabets_labels.json")

        # 3. ASL Alphabet & Digits
        self._load_model_suite("asl", "classifier.joblib", "labels.json")

    def resolve_language(self, language: Optional[str]) -> str:
        if not language:
            return "psl_words"
        lang = language.lower().strip()
        if lang in ["psl", "psl_words", "words", "urdu_words"]:
            return "psl_words"
        elif lang in ["psl_alphabets", "alphabets", "urdu", "urdu_letters"]:
            return "psl_alphabets"
        elif lang in ["asl", "asl_alphabet", "english"]:
            return "asl"
        return "psl_words"

    def predict(self, features: np.ndarray, language: Optional[str] = "psl_words") -> Dict[str, Any]:
        """
        Runs prediction on normalized 63-dimensional feature array using the requested model.
        """
        if features is None or len(features) != 63:
            return {
                "status": "error",
                "sign": None,
                "confidence": 0.0,
                "is_candidate": False,
                "message": "Invalid feature length"
            }

        lang_key = self.resolve_language(language)
        active_model = self.models.get(lang_key)
        active_labels = self.labels_map.get(lang_key, DEFAULT_VOCABULARY)

        # Fallback to any loaded model if requested key not found
        if active_model is None:
            active_model = self.model
            active_labels = self.labels

        # 1. Run Machine Learning Inference if model is loaded
        if active_model is not None:
            try:
                X = features.reshape(1, -1)
                if hasattr(active_model, "predict_proba"):
                    probs = active_model.predict_proba(X)[0]
                    best_idx = int(np.argmax(probs))
                    confidence = float(probs[best_idx])
                    label = active_labels[best_idx] if best_idx < len(active_labels) else str(active_model.classes_[best_idx])
                else:
                    pred = active_model.predict(X)[0]
                    label = str(pred)
                    confidence = 0.85

                # Threshold calibration
                status = "recognized" if confidence >= 0.70 else ("candidate" if confidence >= 0.45 else "uncertain")
                return {
                    "status": status,
                    "sign": label if status != "uncertain" else None,
                    "confidence": round(confidence, 3),
                    "is_candidate": status in ["recognized", "candidate"],
                    "language": lang_key,
                    "message": None
                }
            except Exception as e:
                return {
                    "status": "error",
                    "sign": None,
                    "confidence": 0.0,
                    "is_candidate": False,
                    "language": lang_key,
                    "message": f"Inference error: {str(e)}"
                }

        # 2. Geometric heuristic fallback if no model file loaded
        coords = features.reshape(21, 3)
        thumb_ext = coords[4, 0] > coords[3, 0]
        index_ext = coords[8, 1] < coords[6, 1]
        middle_ext = coords[12, 1] < coords[10, 1]
        ring_ext = coords[16, 1] < coords[14, 1]
        pinky_ext = coords[20, 1] < coords[18, 1]
        extended_count = sum([index_ext, middle_ext, ring_ext, pinky_ext])

        if extended_count == 4 and thumb_ext:
            return {"status": "recognized", "sign": "THANKS", "confidence": 0.90, "is_candidate": True, "language": "heuristic", "message": None}
        elif extended_count == 0 and not thumb_ext:
            return {"status": "recognized", "sign": "GOOD", "confidence": 0.88, "is_candidate": True, "language": "heuristic", "message": None}
        elif extended_count == 0 and thumb_ext:
            return {"status": "recognized", "sign": "YOU", "confidence": 0.89, "is_candidate": True, "language": "heuristic", "message": None}
        elif index_ext and not middle_ext and not ring_ext and not pinky_ext:
            return {"status": "recognized", "sign": "ME", "confidence": 0.86, "is_candidate": True, "language": "heuristic", "message": None}
        elif index_ext and middle_ext and ring_ext and not pinky_ext:
            return {"status": "recognized", "sign": "EAT", "confidence": 0.87, "is_candidate": True, "language": "heuristic", "message": None}
        else:
            return {"status": "candidate", "sign": "RECOGNIZING", "confidence": 0.60, "is_candidate": True, "language": "heuristic", "message": "Sign in progress"}
