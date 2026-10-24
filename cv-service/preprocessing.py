"""
SignFlow Canonical Feature Normalizer
Single source of truth for feature preprocessing between training and live inference.
Enhanced with:
1. Chirality / Handedness normalization (horizontal flip for left-handed gestures).
2. Robust palm-scale normalization fallback (multi-MCP median).
3. Deterministic multi-hand selection with spatial continuity.
4. Image boundary proximity detection.
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from normalize import canonical_normalize_21, dict_landmarks_to_array
except ImportError:
    from .normalize import canonical_normalize_21, dict_landmarks_to_array


def normalize_hand_landmarks(
    landmarks: List[Dict[str, float]],
    image_width: int = 1280,
    image_height: int = 720,
    handedness: Optional[str] = None,
) -> np.ndarray:
    """
    Normalizes 21 MediaPipe hand landmarks using canonical normalization:
    1. Canonical unstretched normalized coordinate space (aspect_ratio=1.0).
    2. Centers all landmarks relative to the wrist (landmark 0).
    3. Chirality normalization: Inverts x-coordinates for left-handed landmarks
       so features align with the right-handed training baseline.
    4. Normalizes scale using the distance between wrist (0) and middle finger MCP (9)
       with multi-MCP median fallback.
    5. Returns a flattened array of 63 features: [x0, y0, z0, ..., x20, y20, z20].
    """
    if not landmarks or len(landmarks) != 21:
        raise ValueError(f"Expected 21 landmarks, received {len(landmarks) if landmarks else 0}")

    coords = dict_landmarks_to_array(landmarks)
    # Use aspect_ratio=1.0 to ensure zero skew against training landmark distribution
    return canonical_normalize_21(coords, aspect_ratio=1.0, handedness=handedness)



def check_boundary_proximity(
    landmarks: List[Dict[str, float]],
    margin: float = 0.02
) -> bool:
    """
    Checks if any key landmark is within `margin` of the camera viewport border (0..1).
    Near-boundary hands risk coordinate clamping and distorted feature vectors.
    """
    for pt in landmarks:
        x = float(pt.get("x", 0.5))
        y = float(pt.get("y", 0.5))
        if x <= margin or x >= (1.0 - margin) or y <= margin or y >= (1.0 - margin):
            return True
    return False


def select_primary_hand(
    hands: List[Dict[str, Any]],
    prev_wrist_norm: Optional[Tuple[float, float]] = None
) -> Tuple[Dict[str, Any], int]:
    """
    Deterministically selects the primary signing hand when multiple hands are in view:
    1. If tracking an active hand from the previous frame, pick the hand with minimum
       wrist displacement (spatial continuity).
    2. Otherwise, prefer a Right hand, or the hand with the highest detection score.
    Returns: (selected_hand_dict, hand_index)
    """
    if len(hands) == 1:
        return hands[0], 0

    # 1. Spatial continuity with previous tracked wrist
    if prev_wrist_norm is not None:
        best_idx = 0
        min_dist = float("inf")
        for idx, h in enumerate(hands):
            lms = h.get("landmarks", [])
            if lms and len(lms) > 0:
                wx = float(lms[0].get("x", 0.0))
                wy = float(lms[0].get("y", 0.0))
                dist = (wx - prev_wrist_norm[0]) ** 2 + (wy - prev_wrist_norm[1]) ** 2
                if dist < min_dist:
                    min_dist = dist
                    best_idx = idx
        return hands[best_idx], best_idx

    # 2. Prefer Right hand, then highest score
    right_hands = [
        (idx, h) for idx, h in enumerate(hands)
        if str(h.get("handedness", "")).lower() == "right"
    ]
    if right_hands:
        right_hands.sort(key=lambda item: float(item[1].get("score", 0.0)), reverse=True)
        return right_hands[0][1], right_hands[0][0]

    # 3. Highest detection score
    sorted_hands = sorted(
        enumerate(hands),
        key=lambda item: float(item[1].get("score", 0.0)),
        reverse=True
    )
    return sorted_hands[0][1], sorted_hands[0][0]


def extract_frame_features_extended(
    frame_data: Dict[str, Any],
    prev_wrist_norm: Optional[Tuple[float, float]] = None
) -> Tuple[Optional[np.ndarray], str, Dict[str, Any]]:
    """
    Extracts normalized 63-feature vector with rich diagnostics metadata:
    - handedness
    - hands_count
    - near_boundary flag
    - wrist_pos (for spatial tracking)
    """
    hands = frame_data.get("hands", [])
    if not hands:
        return None, "no_hands", {"hands_count": 0}

    primary_hand, hand_idx = select_primary_hand(hands, prev_wrist_norm)
    landmarks = primary_hand.get("landmarks", [])
    if len(landmarks) != 21:
        return None, "invalid_landmarks", {"hands_count": len(hands)}

    width = frame_data.get("image_width", 1280)
    height = frame_data.get("image_height", 720)
    handedness = primary_hand.get("handedness", "Right")
    near_boundary = check_boundary_proximity(landmarks)

    wrist_pos = (float(landmarks[0].get("x", 0.5)), float(landmarks[0].get("y", 0.5)))

    try:
        features = normalize_hand_landmarks(
            landmarks,
            image_width=width,
            image_height=height,
            handedness=handedness
        )
        metadata = {
            "hands_count": len(hands),
            "selected_hand_index": hand_idx,
            "handedness": handedness,
            "score": float(primary_hand.get("score", 1.0)),
            "near_boundary": near_boundary,
            "wrist_pos": wrist_pos,
            "landmarks": landmarks,
        }
        return features, "valid", metadata
    except Exception as e:
        return None, f"error: {str(e)}", {"hands_count": len(hands)}


def extract_frame_features(
    frame_data: Dict[str, Any]
) -> Tuple[Optional[np.ndarray], str]:
    """
    Backward-compatible entry point returning (features_vector, status_message).
    """
    features, status, _ = extract_frame_features_extended(frame_data)
    return features, status
