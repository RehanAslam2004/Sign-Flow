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

  const aspectRatio = imageWidth / Math.max(imageHeight, 1);

  // Aspect-ratio corrected coords: shape (21, 3)
  const coords: [number, number, number][] = landmarks.map((pt) => [
    pt.x * aspectRatio,
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
      const topCands: PredictionCandidate[] = [
        { sign: pSign, confidence: pointing.confidence },
      ];
      if (pointing.candidateEN && pointing.candidateEN !== pSign) {
        topCands.push({ sign: pointing.candidateEN, confidence: Number((pointing.confidence * 0.95).toFixed(3)) });
      }
      if (pointing.candidatePSL && pointing.candidatePSL !== pSign) {
        topCands.push({ sign: pointing.candidatePSL, confidence: Number((pointing.confidence * 0.92).toFixed(3)) });
      }

      return {
        status: pointing.confidence >= 0.65 && pointing.margin >= 0.12 ? 'recognized' : 'candidate',
        sign: pSign,
        confidence: pointing.confidence,
        margin: pointing.margin,
        is_candidate: true,
        message: null,
        rejection_reason: null,
        top_candidates: topCands,
        gesture_type: pointing.gestureType,
      };
    }
  }

  const coords = normalizedCoords;

  // Finger extension checks (in normalized coords, negative y is higher in camera image):
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
      confidence: 0.92,
      margin: 0.35,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'HELLO', confidence: 0.92 },
        { sign: 'WATER', confidence: 0.57 },
        { sign: 'YES', confidence: 0.12 },
      ],
    };
  } else if (extendedCount === 0 && !thumbExt) {
    return {
      status: 'recognized',
      sign: 'STOP',
      confidence: 0.88,
      margin: 0.40,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'STOP', confidence: 0.88 },
        { sign: 'YES', confidence: 0.48 },
        { sign: 'HELP', confidence: 0.15 },
      ],
    };
  } else if (extendedCount === 0 && thumbExt) {
    return {
      status: 'recognized',
      sign: 'YES',
      confidence: 0.89,
      margin: 0.38,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'YES', confidence: 0.89 },
        { sign: 'STOP', confidence: 0.51 },
        { sign: 'HELLO', confidence: 0.10 },
      ],
    };
  } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    // Kinematic index pointing evaluation from normalized coordinates
    if (indexDz < -0.20) {
      // Pointing toward camera / addressee (YOU / Ap)
      return {
        status: 'recognized',
        sign: 'Ap',
        confidence: 0.90,
        margin: 0.38,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'Ap', confidence: 0.90 },
          { sign: 'YOU', confidence: 0.86 },
          { sign: 'HELP', confidence: 0.20 },
        ],
        gesture_type: 'point_addressee',
      };
    } else if (indexDz > 0.10 || (indexDy > 0.30 && indexDz > -0.05)) {
      // Pointing toward self / torso (ME / Mujhay)
      return {
        status: 'recognized',
        sign: 'Mujhay',
        confidence: 0.90,
        margin: 0.38,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'Mujhay', confidence: 0.90 },
          { sign: 'ME', confidence: 0.86 },
          { sign: 'HELP', confidence: 0.20 },
        ],
        gesture_type: 'point_self',
      };
    } else {
      // Pointing upward (HELP / Alif)
      return {
        status: 'recognized',
        sign: 'HELP',
        confidence: 0.86,
        margin: 0.32,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HELP', confidence: 0.86 },
          { sign: 'Alif', confidence: 0.82 },
          { sign: 'WATER', confidence: 0.30 },
        ],
        gesture_type: 'point_up',
      };
    }
  } else if (indexExt && middleExt && ringExt && !pinkyExt) {
    return {
      status: 'recognized',
      sign: 'WATER',
      confidence: 0.87,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'WATER', confidence: 0.87 },
        { sign: 'HELLO', confidence: 0.57 },
        { sign: 'HELP', confidence: 0.25 },
      ],
    };
  } else {
    // Ambiguous posture or transition in progress
    return {
      status: 'candidate',
      sign: 'RECOGNIZING',
      confidence: 0.58,
      margin: 0.08,
      is_candidate: true,
      message: 'Sign candidate in progress',
      rejection_reason: 'ambiguous_margin',
      top_candidates: [
        { sign: 'RECOGNIZING', confidence: 0.58 },
        { sign: 'UNCERTAIN', confidence: 0.50 },
      ],
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
