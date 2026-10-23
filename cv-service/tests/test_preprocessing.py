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

def test_handedness_chirality_flip():
    # Asymmetric landmarks: x is positive
    landmarks = [{"x": float(0.1 * i), "y": 0.5, "z": 0.0} for i in range(21)]
    right_feats = normalize_hand_landmarks(landmarks, handedness="Right")
    left_feats = normalize_hand_landmarks(landmarks, handedness="Left")

    right_coords = right_feats.reshape(21, 3)
    left_coords = left_feats.reshape(21, 3)

    # In left-hand normalization, x-coordinates relative to wrist are inverted
    assert np.allclose(right_coords[:, 0], -left_coords[:, 0], atol=1e-5)
    # y and z coordinates remain identical
    assert np.allclose(right_coords[:, 1], left_coords[:, 1], atol=1e-5)
    assert np.allclose(right_coords[:, 2], left_coords[:, 2], atol=1e-5)

def test_multi_hand_selection():
    lms1 = [{"x": 0.2, "y": 0.5, "z": 0.0} for _ in range(21)]
    lms2 = [{"x": 0.8, "y": 0.5, "z": 0.0} for _ in range(21)]
    sample_frame = {
        "hands_detected": 2,
        "hands": [
            {"handedness": "Left", "score": 0.80, "landmarks": lms1},
            {"handedness": "Right", "score": 0.95, "landmarks": lms2},
        ]
    }
    feats, status = extract_frame_features(sample_frame)
    assert status == "valid"
    assert feats is not None

