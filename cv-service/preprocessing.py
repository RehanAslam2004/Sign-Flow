"""
SignFlow Canonical Feature Normalizer
Single source of truth for feature preprocessing between training and live inference.
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np


def normalize_hand_landmarks(
    landmarks: List[Dict[str, float]],
    image_width: int = 1280,
    image_height: int = 720,
) -> np.ndarray:
    """
    Normalizes 21 MediaPipe hand landmarks.
    
    Steps:
    1. Converts normalized image coordinates to aspect-ratio-corrected space.
    2. Centers all landmarks relative to the wrist (landmark 0).
    3. Normalizes scale using the distance between wrist (0) and middle finger MCP (9).
    4. Returns a flattened array of 63 features: [x0, y0, z0, x1, y1, z1, ..., x20, y20, z20].
    """
    if not landmarks or len(landmarks) != 21:
        raise ValueError(f"Expected 21 landmarks, received {len(landmarks) if landmarks else 0}")

    aspect_ratio = image_width / max(image_height, 1)

    # Convert to numpy array of shape (21, 3)
    coords = np.zeros((21, 3), dtype=np.float32)
    for i, pt in enumerate(landmarks):
        # Scale x by aspect ratio so geometric distances in Euclidean space are circular
        coords[i, 0] = float(pt.get("x", 0.0)) * aspect_ratio
        coords[i, 1] = float(pt.get("y", 0.0))
        coords[i, 2] = float(pt.get("z", 0.0))

    # 1. Wrist-centering: wrist is index 0
    wrist = coords[0].copy()
    centered = coords - wrist

    # 2. Scale normalization: distance between wrist (0) and middle finger MCP (9)
    # centered[0] is (0,0,0), so distance is just Euclidean norm of centered[9]
    scale_dist = np.linalg.norm(centered[9])
    
    # Guard against division by zero (e.g. collapsed or invalid landmarks)
    if scale_dist < 1e-4:
        # Fallback to standard deviation or max norm
        scale_dist = np.max(np.abs(centered))
        if scale_dist < 1e-4:
            scale_dist = 1.0

    normalized = centered / scale_dist

    # Flatten to 1D feature vector of length 63
    return normalized.flatten().astype(np.float32)


def extract_frame_features(
    frame_data: Dict[str, Any]
) -> Tuple[Optional[np.ndarray], str]:
    """
    Parses a v1.0 frame payload and extracts normalized feature vector.
    
    Returns:
        (features_vector, status_message)
    """
    hands = frame_data.get("hands", [])
    if not hands:
        return None, "no_hands"

    # Select the primary hand (first detected hand with valid landmarks)
    primary_hand = hands[0]
    landmarks = primary_hand.get("landmarks", [])
    if len(landmarks) != 21:
        return None, "invalid_landmarks"

    width = frame_data.get("image_width", 1280)
    height = frame_data.get("image_height", 720)

    try:
        features = normalize_hand_landmarks(landmarks, image_width=width, image_height=height)
        return features, "valid"
    except Exception as e:
        return None, f"error: {str(e)}"
