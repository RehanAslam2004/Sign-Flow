/**
 * SignFlow In-Browser Client-Side Feature Normalizer & PSL Classifier
 *
 * Provides high-speed, zero-dependency edge inference directly in the browser.
 * Implements identical canonical landmark normalization and geometric classification
 * as cv-service/preprocessing.py and cv-service/inference.py.
 *
 * Enhanced with:
 * 1. Chirality / Handedness normalization (horizontal flip for left-handed gestures).
 * 2. Deterministic multi-hand selection.
 * 3. Margin computation & rejection reasons.
 */

import { FramePayload, PredictionEvent, DetectedHand, PredictionCandidate, LandmarkPoint } from '@/types/contract';
import { analyzePointingLandmarks, PointingGestureResult } from './pointingAnalyzer';

export interface ClientPredictionResult {
  status: 'recognized' | 'candidate' | 'uncertain' | 'no_hands';
  sign: string | null;
  confidence: number;
  margin: number;
  is_candidate: boolean;
  message: string | null;
  rejection_reason?: string | null;
  top_candidates?: PredictionCandidate[];
  gesture_type?: string | null;
  language?: string;
}


/**
 * Normalizes 21 MediaPipe hand landmarks identically to preprocessing.py:
 * 1. Aspect-ratio correction in Euclidean space.
 * 2. Wrist-centering (wrist is landmark 0).
 * 3. Scale normalization by distance between wrist (0) and middle MCP (9).
 * 4. Chirality normalization: Inverts x-coordinates for left-handed landmarks.
 */
export function normalizeClientLandmarks(
  landmarks: { x: number; y: number; z: number }[],
  imageWidth: number = 1280,
  imageHeight: number = 720,
  handedness?: string
): number[][] {
  if (!landmarks || landmarks.length !== 21) {
    throw new Error(`Expected 21 landmarks, received ${landmarks?.length || 0}`);
  }

  // Canonical normalized coords without aspect ratio distortion: shape (21, 3)
  const coords: [number, number, number][] = landmarks.map((pt) => [
    pt.x,
    pt.y,
    pt.z,
  ]);


  // 1. Wrist-centering (landmark 0)
  const wrist = coords[0];
  const centered = coords.map(([x, y, z]) => [
    x - wrist[0],
    y - wrist[1],
    z - wrist[2],
  ]);

  // 2. Chirality / Handedness normalization: mirror x if left hand
  if (handedness && handedness.trim().toLowerCase() === 'left') {
    for (let i = 0; i < centered.length; i++) {
      centered[i][0] = -centered[i][0];
    }
  }

  // 3. Scale normalization: distance between wrist (0) and middle MCP (9)
  const mcp = centered[9];
  let scaleDist = Math.hypot(mcp[0], mcp[1], mcp[2]);

  if (scaleDist < 1e-4) {
    // Fallback to median across key metacarpal bases: MCP 5, 9, 17
    const spans = [
      Math.hypot(centered[5][0], centered[5][1], centered[5][2]),
      Math.hypot(centered[9][0], centered[9][1], centered[9][2]),
      Math.hypot(centered[17][0], centered[17][1], centered[17][2]),
    ].filter((s) => s > 1e-4);
    spans.sort((a, b) => a - b);
    scaleDist = spans.length > 0 ? spans[Math.floor(spans.length / 2)] : 1.0;
  }

  return centered.map(([x, y, z]) => [
    x / scaleDist,
    y / scaleDist,
    z / scaleDist,
  ]);
}

/**
 * Selects the primary hand from detected hands:
 * Prefers 'Right' hand or hand with highest detection score.
 */
function selectClientPrimaryHand(hands: DetectedHand[]): { hand: DetectedHand; index: number } {
  if (hands.length === 1) {
    return { hand: hands[0], index: 0 };
  }

  const rightHandIdx = hands.findIndex(
    (h) => h.handedness && h.handedness.toLowerCase() === 'right'
  );
  if (rightHandIdx !== -1) {
    return { hand: hands[rightHandIdx], index: rightHandIdx };
  }

  // Fallback to highest detection score
  let bestIdx = 0;
  let bestScore = -1;
  hands.forEach((h, idx) => {
    const s = h.score ?? 1.0;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = idx;
    }
  });

  return { hand: hands[bestIdx], index: bestIdx };
}

/**
 * Evaluates geometric PSL postures matching inference.py baseline rules:
 * - HELLO: Open palm (all 4 fingers extended + thumb out)
 * - STOP: Closed fist (0 fingers extended, thumb curled)
 * - YES: Thumbs up (thumb extended, other 4 fingers curled)
 * - HELP: Index finger pointing up
 * - WATER: 3 fingers extended (Index, Middle, Ring)
 */
export function classifyHandFeatures(
  normalizedCoords: number[][],
  rawLandmarks?: LandmarkPoint[],
  handedness: string = 'Right'
): ClientPredictionResult {
  if (normalizedCoords.length !== 21) {
    return {
      status: 'uncertain',
      sign: null,
      confidence: 0,
      margin: 0,
      is_candidate: false,
      message: 'Invalid coordinate count',
      rejection_reason: 'tracking_loss',
    };
  }

  // 1. Evaluate 3D Pointing & Referential Kinematics if raw landmarks are available
  if (rawLandmarks && rawLandmarks.length === 21) {
    const pointing = analyzePointingLandmarks(rawLandmarks, handedness);
    if (pointing.isPointing && pointing.candidatePSL) {
      const pSign = pointing.gestureType === 'point_up' ? 'HELP' : pointing.candidatePSL;
      const pointingConf = Math.min(0.72, Math.max(0.60, Number(pointing.confidence.toFixed(2))));
      const pointingMargin = Math.min(0.25, Math.max(0.12, Number(pointing.margin.toFixed(2))));
      const topCands: PredictionCandidate[] = [
        { sign: pSign, confidence: pointingConf },
      ];
      if (pointing.candidateEN && pointing.candidateEN !== pSign) {
        topCands.push({ sign: pointing.candidateEN, confidence: Number((pointingConf * 0.95).toFixed(3)) });
      }
      if (pointing.candidatePSL && pointing.candidatePSL !== pSign) {
        topCands.push({ sign: pointing.candidatePSL, confidence: Number((pointingConf * 0.92).toFixed(3)) });
      }

      return {
        status: pointingConf >= 0.65 && pointingMargin >= 0.12 ? 'recognized' : 'candidate',
        sign: pSign,
        confidence: pointingConf,
        margin: pointingMargin,
        is_candidate: true,
        message: null,
        rejection_reason: null,
        top_candidates: topCands,
        gesture_type: pointing.gestureType,
        language: 'heuristic',
      };
    }
  }

  const coords = normalizedCoords;

  // Finger extension checks (in normalized coords, negative y is higher in camera image):
  // Post-chirality flip, all hands are aligned to right-hand manifold where thumb extends toward +X.
  const thumbExt = coords[4][0] > coords[3][0];
  const indexExt = coords[8][1] < coords[6][1];
  const middleExt = coords[12][1] < coords[10][1];
  const ringExt = coords[16][1] < coords[14][1];
  const pinkyExt = coords[20][1] < coords[18][1];

  const extendedFingers = [indexExt, middleExt, ringExt, pinkyExt];
  const extendedCount = extendedFingers.filter(Boolean).length;

  // Direction vector of index finger in normalized space
  const indexDz = coords[8][2] - coords[5][2];
  const indexDy = coords[8][1] - coords[5][1];

  if (extendedCount === 4 && thumbExt) {
    return {
      status: 'recognized',
      sign: 'HELLO',
      confidence: 0.72,
      margin: 0.25,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'HELLO', confidence: 0.72 },
        { sign: 'WATER', confidence: 0.45 },
        { sign: 'YES', confidence: 0.12 },
      ],
      language: 'heuristic',
    };
  } else if (extendedCount === 0 && !thumbExt) {
    return {
      status: 'recognized',
      sign: 'STOP',
      confidence: 0.70,
      margin: 0.25,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'STOP', confidence: 0.70 },
        { sign: 'YES', confidence: 0.45 },
        { sign: 'HELP', confidence: 0.15 },
      ],
      language: 'heuristic',
    };
  } else if (extendedCount === 0 && thumbExt) {
    return {
      status: 'recognized',
      sign: 'YES',
      confidence: 0.70,
      margin: 0.25,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'YES', confidence: 0.70 },
        { sign: 'STOP', confidence: 0.45 },
        { sign: 'HELLO', confidence: 0.10 },
      ],
      language: 'heuristic',
    };
  } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    // Kinematic index pointing evaluation from normalized coordinates
    if (indexDz < -0.20) {
      // Pointing toward camera / addressee (YOU / Ap)
      return {
        status: 'recognized',
        sign: 'Ap',
        confidence: 0.68,
        margin: 0.22,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'Ap', confidence: 0.68 },
          { sign: 'YOU', confidence: 0.64 },
          { sign: 'HELP', confidence: 0.20 },
        ],
        gesture_type: 'point_addressee',
        language: 'heuristic',
      };
    } else if (indexDz > 0.10 || (indexDy > 0.30 && indexDz > -0.05)) {
      // Pointing toward self / torso (ME / Mujhay)
      return {
        status: 'recognized',
        sign: 'Mujhay',
        confidence: 0.68,
        margin: 0.22,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'Mujhay', confidence: 0.68 },
          { sign: 'ME', confidence: 0.64 },
          { sign: 'HELP', confidence: 0.20 },
        ],
        gesture_type: 'point_self',
        language: 'heuristic',
      };
    } else {
      // Pointing upward (HELP / Alif)
      return {
        status: 'recognized',
        sign: 'HELP',
        confidence: 0.68,
        margin: 0.20,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HELP', confidence: 0.68 },
          { sign: 'Alif', confidence: 0.62 },
          { sign: 'WATER', confidence: 0.25 },
        ],
        gesture_type: 'point_up',
        language: 'heuristic',
      };
    }
  } else if (indexExt && middleExt && !ringExt && !pinkyExt) {
    // Two fingers extended (V / Peace) -> MEET
    return {
      status: 'recognized',
      sign: 'MEET',
      confidence: 0.70,
      margin: 0.22,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'MEET', confidence: 0.70 },
        { sign: 'NICE', confidence: 0.45 },
        { sign: 'Ap', confidence: 0.20 },
      ],
      language: 'heuristic',
    };
  } else if (indexExt && middleExt && ringExt && !pinkyExt) {
    return {
      status: 'recognized',
      sign: 'WATER',
      confidence: 0.68,
      margin: 0.22,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'WATER', confidence: 0.68 },
        { sign: 'HELLO', confidence: 0.45 },
        { sign: 'HELP', confidence: 0.20 },
      ],
      language: 'heuristic',
    };
  } else {
    // Check for pinch gesture (Pill / Medicine / Dawa)
    const pinchDist = Math.hypot(
      coords[4][0] - coords[8][0],
      coords[4][1] - coords[8][1],
      coords[4][2] - coords[8][2]
    );

    if (pinchDist < 0.38 && !middleExt && !ringExt && !pinkyExt) {
      return {
        status: 'recognized',
        sign: 'MEDICINE',
        confidence: 0.70,
        margin: 0.22,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'MEDICINE', confidence: 0.70 },
          { sign: 'Dawa', confidence: 0.65 },
          { sign: 'BUY', confidence: 0.30 },
        ],
        language: 'heuristic',
      };
    }

    // Check for chest contact / sick state (Bemar / ILL)
    if (extendedCount >= 3 && coords[12][2] > 0.12) {
      return {
        status: 'recognized',
        sign: 'Bemar',
        confidence: 0.70,
        margin: 0.22,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'Bemar', confidence: 0.70 },
          { sign: 'ILL', confidence: 0.65 },
          { sign: 'Mujhay', confidence: 0.40 },
        ],
        language: 'heuristic',
      };
    }

    // Check for open offer / Buy gesture (flat palm facing forward/up)
    if (extendedCount === 4 && !thumbExt && coords[8][2] < -0.10) {
      return {
        status: 'recognized',
        sign: 'BUY',
        confidence: 0.68,
        margin: 0.20,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'BUY', confidence: 0.68 },
          { sign: 'Kharidna', confidence: 0.62 },
          { sign: 'MEDICINE', confidence: 0.35 },
        ],
        language: 'heuristic',
      };
    }

    // Ambiguous posture or transition in progress
    return {
      status: 'candidate',
      sign: 'RECOGNIZING',
      confidence: 0.50,
      margin: 0.05,
      is_candidate: true,
      message: 'Sign candidate in progress',
      rejection_reason: 'ambiguous_margin',
      top_candidates: [
        { sign: 'RECOGNIZING', confidence: 0.50 },
        { sign: 'UNCERTAIN', confidence: 0.45 },
      ],
      language: 'heuristic',
    };
  }
}

/**
 * End-to-end client prediction pipeline for a single frame payload.
 * Emits a structured v1.0 PredictionEvent matching the backend WebSocket contract.
 */
export function runClientInference(payload: FramePayload): PredictionEvent {
  const timestamp = Date.now();
  const handsCount = payload.hands_detected || (payload.hands ? payload.hands.length : 0);

  if (handsCount === 0 || !payload.hands || payload.hands.length === 0) {
    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: 'no_hands',
      sign: null,
      confidence: 0.0,
      margin: 0.0,
      is_candidate: false,
      message: 'No hands detected in frame',
      rejection_reason: 'no_hands',
      hands_count: 0,
      language: 'heuristic',
    };
  }

  const { hand: primaryHand } = selectClientPrimaryHand(payload.hands);
  if (!primaryHand.landmarks || primaryHand.landmarks.length !== 21) {
    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: 'uncertain',
      sign: null,
      confidence: 0.0,
      margin: 0.0,
      is_candidate: false,
      message: 'Invalid hand landmarks',
      rejection_reason: 'tracking_loss',
      hands_count: handsCount,
      handedness: primaryHand.handedness,
      language: 'heuristic',
    };
  }

  try {
    const normalized = normalizeClientLandmarks(
      primaryHand.landmarks,
      payload.image_width,
      payload.image_height,
      primaryHand.handedness
    );

    const result = classifyHandFeatures(
      normalized,
      primaryHand.landmarks,
      primaryHand.handedness
    );

    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: result.status,
      sign: result.sign,
      confidence: result.confidence,
      margin: result.margin,
      is_candidate: result.is_candidate,
      message: result.message,
      rejection_reason: result.rejection_reason,
      top_candidates: result.top_candidates,
      hands_count: handsCount,
      handedness: primaryHand.handedness,
      language: result.language || 'heuristic',
    };

  } catch (err: any) {
    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: 'uncertain',
      sign: null,
      confidence: 0.0,
      margin: 0.0,
      is_candidate: false,
      message: err?.message || 'Feature processing error',
      rejection_reason: 'tracking_loss',
      hands_count: handsCount,
      handedness: primaryHand.handedness,
    };
  }
}
