import pytest
import numpy as np
from preprocessing import normalize_hand_landmarks, extract_frame_features

def test_normalize_hand_landmarks_shape_and_centering():
    # 21 synthetic landmarks
    landmarks = [{"x": float(i * 0.02), "y": float(i * 0.03), "z": 0.0} for i in range(21)]
    
    features = normalize_hand_landmarks(landmarks, image_width=1280, image_height=720)
    
    assert isinstance(features, np.ndarray)
    assert features.shape == (63,)
    assert features.dtype == np.float32

    # Reshaped coords
    coords = features.reshape(21, 3)
    
    # Wrist (point 0) should be at origin (0, 0, 0)
    assert np.allclose(coords[0], [0.0, 0.0, 0.0], atol=1e-5)

def test_extract_frame_features_valid():
    sample_frame = {
        "schema_version": "1.0",
        "session_id": "test_sess",
        "frame_id": 1,
        "image_width": 1280,
        "image_height": 720,
        "hands_detected": 1,
        "hands": [
            {
                "handedness": "Right",
                "score": 0.95,
                "landmarks": [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)]
            }
        ]
    }
    
    features, status = extract_frame_features(sample_frame)
    assert status == "valid"
    assert features is not None
    assert len(features) == 63

def test_extract_frame_features_no_hands():
    sample_frame = {
        "schema_version": "1.0",
        "session_id": "test_sess",
        "frame_id": 2,
        "hands_detected": 0,
        "hands": []
    }
    
    features, status = extract_frame_features(sample_frame)
    assert status == "no_hands"
    assert features is None
