"""
SignFlow Canonical Feature Normalizer — Single Source of Truth
Used by BOTH training feature extraction AND live inference.
Ensures zero train/serve skew across aspect ratios, handedness, and joint scaling.
"""

from typing import Optional, Union, List, Dict
import numpy as np


def canonical_normalize_21(
    coords: np.ndarray,
    aspect_ratio: float = 1.0,
    handedness: Optional[str] = None,
) -> np.ndarray:
    """
    Normalizes (21, 3) landmarks to a 63-dim feature vector.
    
    1. Apply aspect ratio correction to x (default 1.0 = unstretched normalized space).
    2. Wrist-center relative to landmark 0.
    3. Chirality flip for left hands (reflect x so left hands match right-hand manifold).
    4. Scale by wrist -> middle MCP (landmark 9) distance.
       Falls back to multi-MCP median (5, 9, 17) if landmark 9 is degenerate.
    
    Returns: flat (63,) float32 array.
    """
    if coords.shape != (21, 3):
        raise ValueError(f"Expected shape (21, 3), got {coords.shape}")

    c = coords.astype(np.float32).copy()
    
    # 1. Aspect ratio scaling (default 1.0 maintains standard normalized coords)
    if aspect_ratio != 1.0:
        c[:, 0] *= aspect_ratio

    # 2. Wrist-centering (landmark 0)
    wrist = c[0].copy()
    c -= wrist

    # 3. Chirality flip for left hand
    if handedness and str(handedness).strip().lower() == "left":
        c[:, 0] = -c[:, 0]

    # 4. Scale normalization by distance from wrist (0) to middle MCP (9)
    scale = float(np.linalg.norm(c[9]))
    if scale < 1e-4:
        spans = [float(np.linalg.norm(c[i])) for i in [5, 9, 17]]
        valid = [s for s in spans if s > 1e-4]
        scale = float(np.median(valid)) if valid else 1.0

    normalized = c / scale
    return normalized.flatten().astype(np.float32)


def dict_landmarks_to_array(landmarks: List[Dict[str, float]]) -> np.ndarray:
    """
    Converts a list of 21 landmark dicts ({'x': ..., 'y': ..., 'z': ...})
    into a (21, 3) numpy float32 array.
    """
    if len(landmarks) != 21:
        raise ValueError(f"Expected 21 landmarks, got {len(landmarks)}")
    arr = np.zeros((21, 3), dtype=np.float32)
    for i, pt in enumerate(landmarks):
        arr[i, 0] = float(pt.get("x", 0.0))
        arr[i, 1] = float(pt.get("y", 0.0))
        arr[i, 2] = float(pt.get("z", 0.0))
    return arr
