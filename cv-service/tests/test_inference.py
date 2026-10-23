import pytest
import numpy as np
from inference import PSLClassifier

def test_inference_returns_valid_contract():
    classifier = PSLClassifier()
    dummy_features = np.zeros(63, dtype=np.float32)
    
    result = classifier.predict(dummy_features)
    
    assert "status" in result
    assert "sign" in result
    assert "confidence" in result
    assert "is_candidate" in result
    assert isinstance(result["confidence"], (float, int))
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["status"] in ["recognized", "candidate", "uncertain", "error"]

def test_inference_invalid_features():
    classifier = PSLClassifier()
    invalid_features = np.zeros(10, dtype=np.float32)
    
    result = classifier.predict(invalid_features)
    assert result["status"] == "error"
    assert result["is_candidate"] is False

def test_trained_model_loaded_and_multi_language_classes():
    classifier = PSLClassifier()
    # Check ASL model
    assert "asl" in classifier.models, "Trained scikit-learn model must be loaded for ASL"
    asl_labels = classifier.labels_map.get("asl", [])
    assert len(asl_labels) == 36, "Must load exactly 36 ASL classes (0-9, A-Z)"
    assert "A" in asl_labels
    assert "0" in asl_labels
    assert "Z" in asl_labels

    # Check PSL Words model
    assert "psl_words" in classifier.models, "PSL Words model must be loaded"
    psl_words_labels = classifier.labels_map.get("psl_words", [])
    assert len(psl_words_labels) == 12, "Must load 12 PSL conversational words"
    assert "THANKS" in psl_words_labels

    # Check PSL Extended model (89 classes)
    assert "psl_extended" in classifier.models, "PSL Extended model must be loaded"
    psl_ext_labels = classifier.labels_map.get("psl_extended", [])
    assert len(psl_ext_labels) == 89, "Must load 89 PSL Extended categories"
    assert "Assalamulaikum" in psl_ext_labels
    assert "Barai Mehrbani" in psl_ext_labels
    assert "G Han" in psl_ext_labels

def test_inference_margin_and_rejection_reasons():
    classifier = PSLClassifier(confidence_threshold=0.70, margin_threshold=0.15)
    dummy_features = np.zeros(63, dtype=np.float32)

    # Clean prediction check
    result = classifier.predict(dummy_features, language="psl_extended")
    assert "margin" in result
    assert "top_candidates" in result
    assert isinstance(result["margin"], float)
    assert len(result["top_candidates"]) <= 3

    # Boundary proximity triggers uncertainty if confidence isn't very high
    near_border_result = classifier.predict(dummy_features, language="psl_extended", near_boundary=True)
    if near_border_result["confidence"] < 0.80:
        assert near_border_result["status"] in ["uncertain", "candidate"]


def test_unified_pointing_recognition():
    classifier = PSLClassifier()
    dummy_features = np.zeros(63, dtype=np.float32)

    # 1. Pointing to camera (dz < -0.25)
    landmarks_camera = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)]
    landmarks_camera[0] = {"x": 0.5, "y": 0.7, "z": 0.0}   # wrist
    landmarks_camera[5] = {"x": 0.5, "y": 0.5, "z": 0.0}   # index MCP
    landmarks_camera[8] = {"x": 0.5, "y": 0.5, "z": -0.3}  # index TIP (forward towards camera)
    landmarks_camera[9] = {"x": 0.55, "y": 0.5, "z": 0.0}
    landmarks_camera[12] = {"x": 0.55, "y": 0.65, "z": 0.0}
    landmarks_camera[13] = {"x": 0.6, "y": 0.52, "z": 0.0}
    landmarks_camera[16] = {"x": 0.6, "y": 0.66, "z": 0.0}
    landmarks_camera[17] = {"x": 0.65, "y": 0.54, "z": 0.0}
    landmarks_camera[20] = {"x": 0.65, "y": 0.68, "z": 0.0}

    res_cam = classifier.predict(dummy_features, language="unified", landmarks=landmarks_camera)
    assert res_cam["status"] in ["recognized", "candidate"]
    assert res_cam["sign"] in ["Ap", "YOU"]
    assert res_cam["confidence"] >= 0.70

    # 2. Pointing to self (dz > 0.12)
    landmarks_self = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)]
    landmarks_self[0] = {"x": 0.5, "y": 0.7, "z": 0.0}
    landmarks_self[5] = {"x": 0.5, "y": 0.5, "z": 0.0}
    landmarks_self[8] = {"x": 0.5, "y": 0.5, "z": 0.25}  # index TIP (backward towards chest)
    landmarks_self[9] = {"x": 0.55, "y": 0.5, "z": 0.0}
    landmarks_self[12] = {"x": 0.55, "y": 0.65, "z": 0.0}
    landmarks_self[13] = {"x": 0.6, "y": 0.52, "z": 0.0}
    landmarks_self[16] = {"x": 0.6, "y": 0.66, "z": 0.0}
    landmarks_self[17] = {"x": 0.65, "y": 0.54, "z": 0.0}
    landmarks_self[20] = {"x": 0.65, "y": 0.68, "z": 0.0}

    res_self = classifier.predict(dummy_features, language="unified", landmarks=landmarks_self)
    assert res_self["status"] in ["recognized", "candidate"]
    assert res_self["sign"] in ["Mujhay", "ME"]
    assert res_self["confidence"] >= 0.70





