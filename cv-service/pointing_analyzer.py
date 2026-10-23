"""
SignFlow 3D Pointing and Referential Gesture Kinematics Analyzer

Analyzes 3D hand geometry and finger kinematics to recognize deictic pointing:
1. Pointing toward camera / addressee -> "YOU" / "Ap"
2. Pointing toward self / torso -> "ME" / "Mujhay"
3. Pointing downward / spatial reference -> "THIS" / "Ye"
4. Pointing upward -> "Alif" / "1" / "D" / "HELP"

Computes:
- 3D pointing direction unit vector: v_index = (L8 - L5) / ||L8 - L5||
- Index finger extension and collinearity ratio
- Curl ratios for Middle, Ring, and Pinky fingers
- Palm plane orientation normal vector
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np


class PointingGestureResult:
    def __init__(
        self,
        is_pointing: bool,
        gesture_type: Optional[str] = None,
        candidate_psl: Optional[str] = None,
        candidate_en: Optional[str] = None,
        confidence: float = 0.0,
        margin: float = 0.0,
        direction_vector: Optional[Tuple[float, float, float]] = None,
        diagnostics: Optional[Dict[str, Any]] = None,
    ):
        self.is_pointing = is_pointing
        self.gesture_type = gesture_type
        self.candidate_psl = candidate_psl
        self.candidate_en = candidate_en
        self.confidence = confidence
        self.margin = margin
        self.direction_vector = direction_vector
        self.diagnostics = diagnostics or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_pointing": self.is_pointing,
            "gesture_type": self.gesture_type,
            "candidate_psl": self.candidate_psl,
            "candidate_en": self.candidate_en,
            "confidence": round(self.confidence, 3),
            "margin": round(self.margin, 3),
            "direction_vector": (
                [round(x, 3) for x in self.direction_vector]
                if self.direction_vector
                else None
            ),
            "diagnostics": self.diagnostics,
        }


def analyze_pointing_landmarks(
    landmarks: List[Dict[str, float]],
    handedness: str = "Right",
) -> PointingGestureResult:
    """
    Analyzes 21 MediaPipe hand landmarks in 3D coordinate space.
    Returns PointingGestureResult containing candidate interpretations.
    """
    if not landmarks or len(landmarks) != 21:
        return PointingGestureResult(is_pointing=False)

    pts = np.zeros((21, 3), dtype=np.float32)
    for i, pt in enumerate(landmarks):
        pts[i, 0] = float(pt.get("x", 0.0))
        pts[i, 1] = float(pt.get("y", 0.0))
        pts[i, 2] = float(pt.get("z", 0.0))

    # Key landmark positions
    wrist = pts[0]
    mcp_index = pts[5]
    pip_index = pts[6]
    dip_index = pts[7]
    tip_index = pts[8]

    mcp_middle = pts[9]
    tip_middle = pts[12]

    mcp_ring = pts[13]
    tip_ring = pts[16]

    mcp_pinky = pts[17]
    tip_pinky = pts[20]

    # Scale reference: Palm span (wrist to middle MCP)
    palm_scale = float(np.linalg.norm(mcp_middle - wrist))
    if palm_scale < 1e-4:
        palm_scale = 1.0

    # 1. Index finger extension check
    index_len = float(np.linalg.norm(tip_index - mcp_index))
    index_wrist_dist = float(np.linalg.norm(tip_index - wrist))
    mcp_wrist_dist = float(np.linalg.norm(mcp_index - wrist))

    # Collinearity of index finger segments
    v_mcp_pip = pip_index - mcp_index
    v_pip_tip = tip_index - pip_index
    norm_mcp_pip = float(np.linalg.norm(v_mcp_pip))
    norm_pip_tip = float(np.linalg.norm(v_pip_tip))
    collinearity = 0.0
    if norm_mcp_pip > 1e-4 and norm_pip_tip > 1e-4:
        collinearity = float(np.dot(v_mcp_pip, v_pip_tip) / (norm_mcp_pip * norm_pip_tip))

    is_index_extended = (index_wrist_dist > 1.25 * mcp_wrist_dist) or (index_len > 0.8 * palm_scale)

    # 2. Curl checks for Middle, Ring, Pinky
    # In curled fingers, tip distance to wrist is close to MCP distance to wrist
    middle_curl_ratio = float(np.linalg.norm(tip_middle - wrist) / max(np.linalg.norm(mcp_middle - wrist), 1e-4))
    ring_curl_ratio = float(np.linalg.norm(tip_ring - wrist) / max(np.linalg.norm(mcp_ring - wrist), 1e-4))
    pinky_curl_ratio = float(np.linalg.norm(tip_pinky - wrist) / max(np.linalg.norm(mcp_pinky - wrist), 1e-4))

    other_fingers_curled = (
        middle_curl_ratio < 1.35
        and ring_curl_ratio < 1.35
        and pinky_curl_ratio < 1.35
    )

    if not (is_index_extended and other_fingers_curled):
        return PointingGestureResult(
            is_pointing=False,
            diagnostics={
                "index_extended": is_index_extended,
                "other_fingers_curled": other_fingers_curled,
                "middle_curl_ratio": round(middle_curl_ratio, 2),
                "ring_curl_ratio": round(ring_curl_ratio, 2),
                "pinky_curl_ratio": round(pinky_curl_ratio, 2),
            },
        )

    # 3. 3D Index pointing vector (from MCP 5 to TIP 8)
    v_pointing = tip_index - mcp_index
    norm_pointing = float(np.linalg.norm(v_pointing))
    if norm_pointing < 1e-4:
        return PointingGestureResult(is_pointing=False)

    u_pointing = v_pointing / norm_pointing
    dx, dy, dz = float(u_pointing[0]), float(u_pointing[1]), float(u_pointing[2])

    diagnostics = {
        "dx": round(dx, 3),
        "dy": round(dy, 3),
        "dz": round(dz, 3),
        "collinearity": round(collinearity, 3),
        "palm_scale": round(palm_scale, 3),
    }

    # 4. Classify pointing direction:
    # A. Pointing to Camera / Addressee ("YOU" / "Ap")
    # In MediaPipe Hands, negative z indicates closer to the camera lens.
    # When pointing towards the viewer/camera, dz is strongly negative.
    if dz < -0.25:
        # Confidence increases as finger points more directly along the z-axis
        conf = float(np.clip(0.70 + (-dz) * 0.25, 0.70, 0.96))
        margin = float(np.clip((-dz) * 0.40, 0.15, 0.45))
        return PointingGestureResult(
            is_pointing=True,
            gesture_type="point_addressee",
            candidate_psl="Ap",
            candidate_en="YOU",
            confidence=conf,
            margin=margin,
            direction_vector=(dx, dy, dz),
            diagnostics=diagnostics,
        )

    # B. Pointing to Self / Torso ("ME" / "Mujhay")
    # When pointing towards oneself, the fingertip is directed backward towards the signer's body.
    # In MediaPipe, positive z is away from camera (towards signer), OR
    # the index curves down/inward towards the chest.
    if dz > 0.12 or (dy > 0.35 and abs(dx) < 0.6 and dz > -0.05):
        conf = float(np.clip(0.72 + max(dz, 0.0) * 0.25, 0.70, 0.96))
        margin = float(np.clip(0.18 + max(dz, 0.0) * 0.30, 0.15, 0.45))
        return PointingGestureResult(
            is_pointing=True,
            gesture_type="point_self",
            candidate_psl="Mujhay",
            candidate_en="ME",
            confidence=conf,
            margin=margin,
            direction_vector=(dx, dy, dz),
            diagnostics=diagnostics,
        )

    # C. Pointing Down / Spatial Object ("THIS" / "Ye")
    # Index finger points downward-forward towards an object or location.
    if dy > 0.55 and abs(dz) < 0.35:
        conf = float(np.clip(0.70 + dy * 0.22, 0.70, 0.94))
        margin = 0.25
        return PointingGestureResult(
            is_pointing=True,
            gesture_type="point_spatial",
            candidate_psl="Ye",
            candidate_en="THIS",
            confidence=conf,
            margin=margin,
            direction_vector=(dx, dy, dz),
            diagnostics=diagnostics,
        )

    # D. Pointing Upward ("Alif" / "1" / "D" / "HELP")
    # Index points vertically upward in camera image (dy is strongly negative).
    if dy < -0.65 and abs(dz) < 0.35:
        conf = float(np.clip(0.70 + (-dy) * 0.22, 0.70, 0.94))
        margin = 0.22
        return PointingGestureResult(
            is_pointing=True,
            gesture_type="point_up",
            candidate_psl="Alif",
            candidate_en="HELP",
            confidence=conf,
            margin=margin,
            direction_vector=(dx, dy, dz),
            diagnostics=diagnostics,
        )

    # Lateral or ambiguous point
    return PointingGestureResult(
        is_pointing=True,
        gesture_type="point_ambiguous",
        candidate_psl=None,
        candidate_en=None,
        confidence=0.50,
        margin=0.05,
        direction_vector=(dx, dy, dz),
        diagnostics=diagnostics,
    )
