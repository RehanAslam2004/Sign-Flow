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
