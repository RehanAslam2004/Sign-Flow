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

    # Check PSL Alphabets model
    assert "psl_alphabets" in classifier.models, "PSL Alphabets model must be loaded"
    psl_alphabets_labels = classifier.labels_map.get("psl_alphabets", [])
    assert len(psl_alphabets_labels) == 37, "Must load 37 Urdu alphabets"


