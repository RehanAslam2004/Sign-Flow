"""
SignFlow Inference Engine
Loads scikit-learn model artifacts and evaluates normalized hand features against supported PSL vocabulary.
"""

import os
import json
from typing import Dict, Any, Optional
import numpy as np

# Supported PSL vocabulary
DEFAULT_VOCABULARY = [
    "HELLO",
    "HELP",
    "WATER",
    "FOOD",
    "YES",
    "NO",
    "THANK_YOU",
    "STOP"
]

class PSLClassifier:
    def __init__(self, model_dir: Optional[str] = None):
        if model_dir is None:
            model_dir = os.path.join(os.path.dirname(__file__), "model")
        
        self.model_dir = model_dir
        self.labels_path = os.path.join(model_dir, "labels.json")
        self.model_path = os.path.join(model_dir, "classifier.joblib")
        
        self.labels = DEFAULT_VOCABULARY
        self.model = None
        self._load_model()

    def _load_model(self):
        # Load custom labels if available
        if os.path.exists(self.labels_path):
            try:
                with open(self.labels_path, "r", encoding="utf-8") as f:
                    self.labels = json.load(f)
            except Exception as e:
                print(f"Warning: Failed to load labels.json: {e}")

        # Load trained scikit-learn model if available
        if os.path.exists(self.model_path):
            try:
                import joblib
                self.model = joblib.load(self.model_path)
                print(f"Successfully loaded model from {self.model_path}")
            except Exception as e:
                print(f"Notice: Model file exists but failed to load ({e}). Using baseline recognizer.")
                self.model = None
        else:
            print("Notice: No classifier.joblib found in model/. Using baseline recognizer.")

    def predict(self, features: np.ndarray) -> Dict[str, Any]:
        """
        Runs prediction on normalized 63-dimensional feature array.
        """
        if features is None or len(features) != 63:
            return {
                "status": "error",
                "sign": None,
                "confidence": 0.0,
                "is_candidate": False,
                "message": "Invalid feature length"
            }

        # If a trained scikit-learn model is loaded:
        if self.model is not None:
            try:
                X = features.reshape(1, -1)
                if hasattr(self.model, "predict_proba"):
                    probs = self.model.predict_proba(X)[0]
                    best_idx = int(np.argmax(probs))
                    confidence = float(probs[best_idx])
                    label = self.labels[best_idx] if best_idx < len(self.labels) else str(self.model.classes_[best_idx])
                else:
                    pred = self.model.predict(X)[0]
                    label = str(pred)
                    confidence = 0.85

                status = "recognized" if confidence >= 0.75 else ("candidate" if confidence >= 0.50 else "uncertain")
                return {
                    "status": status,
                    "sign": label if status != "uncertain" else None,
                    "confidence": round(confidence, 3),
                    "is_candidate": status in ["recognized", "candidate"],
                    "message": None
                }
            except Exception as e:
                return {
                    "status": "error",
                    "sign": None,
                    "confidence": 0.0,
                    "is_candidate": False,
                    "message": f"Inference error: {str(e)}"
                }

        # Baseline gesture recognition when model file is awaiting training dataset
        # Features are normalized relative to wrist (index 0)
        # Check geometric hand posture:
        # Landmarks: 4 (Thumb tip), 8 (Index tip), 12 (Middle tip), 16 (Ring tip), 20 (Pinky tip)
        # In normalized coords (index 0 is wrist): y < 0 usually means above wrist
        # Tip y vs MCP y determines if finger is extended
        coords = features.reshape(21, 3)
        
        # Fingers extended check: tip.y < pip.y (lower y is higher in image)
        thumb_ext = coords[4, 0] > coords[3, 0]  # thumb out
        index_ext = coords[8, 1] < coords[6, 1]
        middle_ext = coords[12, 1] < coords[10, 1]
        ring_ext = coords[16, 1] < coords[14, 1]
        pinky_ext = coords[20, 1] < coords[18, 1]

        extended_count = sum([index_ext, middle_ext, ring_ext, pinky_ext])

        # Baseline heuristic mapping for verification:
        if extended_count == 4 and thumb_ext:
            # Open palm -> HELLO
            return {"status": "recognized", "sign": "HELLO", "confidence": 0.92, "is_candidate": True, "message": None}
        elif extended_count == 0 and not thumb_ext:
            # Fist -> STOP
            return {"status": "recognized", "sign": "STOP", "confidence": 0.88, "is_candidate": True, "message": None}
        elif extended_count == 0 and thumb_ext:
            # Thumbs up -> YES
            return {"status": "recognized", "sign": "YES", "confidence": 0.89, "is_candidate": True, "message": None}
        elif index_ext and not middle_ext and not ring_ext and not pinky_ext:
            # Index pointing up -> HELP / ONE
            return {"status": "recognized", "sign": "HELP", "confidence": 0.86, "is_candidate": True, "message": None}
        elif index_ext and middle_ext and ring_ext and not pinky_ext:
            # 3 fingers -> WATER
            return {"status": "recognized", "sign": "WATER", "confidence": 0.87, "is_candidate": True, "message": None}
        else:
            return {"status": "candidate", "sign": "RECOGNIZING", "confidence": 0.65, "is_candidate": True, "message": "Sign candidate in progress"}
