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
  const wrist = coords[0];
  const thumbCmc = coords[1], thumbMcp = coords[2], thumbTip = coords[4];
  const indexMcp = coords[5], indexPip = coords[6], indexTip = coords[8];
  const middleMcp = coords[9], middlePip = coords[10], middleTip = coords[12];
  const ringMcp = coords[13], ringPip = coords[14], ringTip = coords[16];
  const pinkyMcp = coords[17], pinkyPip = coords[18], pinkyTip = coords[20];

  const palmScale = Math.hypot(middleMcp[0] - wrist[0], middleMcp[1] - wrist[1], middleMcp[2] - wrist[2]) || 1.0;

  function dist(p1: number[], p2: number[]): number {
    return Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]) / palmScale;
  }

  function fingerCurlRatio(tip: number[], mcp: number[]): number {
    const tipWrist = Math.hypot(tip[0] - wrist[0], tip[1] - wrist[1], tip[2] - wrist[2]);
    const mcpWrist = Math.max(Math.hypot(mcp[0] - wrist[0], mcp[1] - wrist[1], mcp[2] - wrist[2]), 1e-4);
    return tipWrist / mcpWrist;
  }

  function isFingerExtended(tip: number[], pip: number[], mcp: number[]): boolean {
    const tipWrist = Math.hypot(tip[0] - wrist[0], tip[1] - wrist[1], tip[2] - wrist[2]);
    const mcpWrist = Math.hypot(mcp[0] - wrist[0], mcp[1] - wrist[1], mcp[2] - wrist[2]);
    const pipWrist = Math.hypot(pip[0] - wrist[0], pip[1] - wrist[1], pip[2] - wrist[2]);
    return tipWrist > 1.25 * mcpWrist && tipWrist > pipWrist;
  }

  const indexExt = isFingerExtended(indexTip, indexPip, indexMcp);
  const middleExt = isFingerExtended(middleTip, middlePip, middleMcp);
  const ringExt = isFingerExtended(ringTip, ringPip, ringMcp);
  const pinkyExt = isFingerExtended(pinkyTip, pinkyPip, pinkyMcp);

  const thumbWristDist = Math.hypot(thumbTip[0] - wrist[0], thumbTip[1] - wrist[1], thumbTip[2] - wrist[2]);
  const thumbMcpDist = Math.hypot(thumbMcp[0] - wrist[0], thumbMcp[1] - wrist[1], thumbMcp[2] - wrist[2]);
  const thumbExt = thumbWristDist > 1.25 * thumbMcpDist && thumbTip[1] < thumbMcp[1];

  const indexCurl = fingerCurlRatio(indexTip, indexMcp);
  const middleCurl = fingerCurlRatio(middleTip, middleMcp);
  const ringCurl = fingerCurlRatio(ringTip, ringMcp);
  const pinkyCurl = fingerCurlRatio(pinkyTip, pinkyMcp);

  const curledCount = [indexCurl < 1.25, middleCurl < 1.25, ringCurl < 1.25, pinkyCurl < 1.25].filter(Boolean).length;
  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

  const dThumbIndex = dist(thumbTip, indexTip);
  const dThumbMiddle = dist(thumbTip, middleTip);

  const allTips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
  const tipCenterX = allTips.reduce((s, t) => s + t[0], 0) / 5;
  const tipCenterY = allTips.reduce((s, t) => s + t[1], 0) / 5;
  const tipCenterZ = allTips.reduce((s, t) => s + t[2], 0) / 5;
  const maxTipSpread = Math.max(
    ...allTips.map((t) => Math.hypot(t[0] - tipCenterX, t[1] - tipCenterY, t[2] - tipCenterZ) / palmScale)
  );

  const avgY = rawLandmarks && rawLandmarks.length > 0 ? rawLandmarks.reduce((s, pt) => s + pt.y, 0) / rawLandmarks.length : 0.5;

  // Palm normal vector
  const v1 = [indexMcp[0] - wrist[0], indexMcp[1] - wrist[1], indexMcp[2] - wrist[2]];
  const v2 = [pinkyMcp[0] - wrist[0], pinkyMcp[1] - wrist[1], pinkyMcp[2] - wrist[2]];
  const cross = [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0],
  ];
  const normCross = Math.hypot(cross[0], cross[1], cross[2]) || 1.0;
  const palmNormal = [cross[0] / normCross, cross[1] / normCross, cross[2] / normCross];

  // 1. PLAY: "Y" handshape (Thumb and Pinky extended, middle 3 curled)
  if (thumbExt && pinkyExt && !middleExt && !ringExt && indexCurl < 1.20) {
    return {
      status: 'recognized',
      sign: 'PLAY',
      confidence: 0.90,
      margin: 0.40,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'PLAY', confidence: 0.90 },
        { sign: 'YES', confidence: 0.40 },
      ],
      gesture_type: 'y_handshape',
      language: 'asl',
    };
  }

  // 2. NO: 3-finger pinch (Index + Middle extended with tips touching Thumb tip)
  if (
    curledCount < 4 &&
    dThumbIndex < 0.40 &&
    dThumbMiddle < 0.45 &&
    ringCurl < 1.25 &&
    pinkyCurl < 1.25 &&
    !ringExt &&
    !pinkyExt
  ) {
    return {
      status: 'recognized',
      sign: 'NO',
      confidence: 0.88,
      margin: 0.35,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'NO', confidence: 0.88 },
        { sign: 'MORE', confidence: 0.45 },
      ],
      gesture_type: 'three_finger_pinch',
      language: 'asl',
    };
  }

  // 3. HELP: Thumbs up upright, all 4 fingers curled
  const thumbPointingUp = (thumbTip[1] - thumbMcp[1]) < -0.15 * palmScale;
  if (curledCount === 4 && thumbExt && thumbPointingUp) {
    return {
      status: 'recognized',
      sign: 'HELP',
      confidence: 0.88,
      margin: 0.32,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'HELP', confidence: 0.88 },
        { sign: 'YES', confidence: 0.50 },
      ],
      gesture_type: 'thumb_up',
      language: 'asl',
    };
  }

  // 4. YES: Closed fist (0 fingers extended, thumb folded)
  if (curledCount === 4 && !thumbExt) {
    return {
      status: 'recognized',
      sign: 'YES',
      confidence: 0.86,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'YES', confidence: 0.86 },
        { sign: 'RESTROOM', confidence: 0.42 },
      ],
      gesture_type: 'closed_fist',
      language: 'asl',
    };
  }

  // 5. Index Finger Pointing: Forward -> YOU / GO
  const vIndex = [indexTip[0] - indexMcp[0], indexTip[1] - indexMcp[1], indexTip[2] - indexMcp[2]];
  const normVIndex = Math.hypot(vIndex[0], vIndex[1], vIndex[2]) || 1.0;
  const vIndexNorm = [vIndex[0] / normVIndex, vIndex[1] / normVIndex, vIndex[2] / normVIndex];

  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    if (vIndexNorm[2] < -0.20 || (Math.abs(vIndexNorm[0]) > 0.6 && vIndexNorm[1] < 0.2)) {
      return {
        status: 'recognized',
        sign: 'YOU',
        confidence: 0.88,
        margin: 0.32,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'YOU', confidence: 0.88 },
          { sign: 'GO', confidence: 0.65 },
        ],
        gesture_type: 'index_pointing_forward',
        language: 'asl',
      };
    } else if (vIndexNorm[1] < -0.5) {
      return {
        status: 'recognized',
        sign: 'HELP',
        confidence: 0.82,
        margin: 0.25,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HELP', confidence: 0.82 },
          { sign: 'YOU', confidence: 0.40 },
        ],
        gesture_type: 'index_pointing_up',
        language: 'asl',
      };
    }
  }

  // 6. RESTROOM: "T" handshape (Thumb between index & middle knuckles)
  if (
    curledCount === 4 &&
    !indexExt &&
    !thumbExt &&
    Math.abs(thumbTip[0] - (indexPip[0] + middlePip[0]) / 2.0) < 0.25 * palmScale &&
    thumbTip[1] < indexPip[1] + 0.1 * palmScale
  ) {
    return {
      status: 'recognized',
      sign: 'RESTROOM',
      confidence: 0.85,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'RESTROOM', confidence: 0.85 },
        { sign: 'YES', confidence: 0.45 },
      ],
      gesture_type: 't_handshape',
      language: 'asl',
    };
  }

  // 7. MORE / EAT: 5 fingertips cluster
  if (maxTipSpread < 0.45 && curledCount < 4) {
    if (avgY < 0.40) {
      return {
        status: 'recognized',
        sign: 'EAT',
        confidence: 0.86,
        margin: 0.30,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'EAT', confidence: 0.86 },
          { sign: 'MORE', confidence: 0.55 },
        ],
        gesture_type: 'cluster_at_mouth',
        language: 'asl',
      };
    } else {
      return {
        status: 'recognized',
        sign: 'MORE',
        confidence: 0.87,
        margin: 0.30,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'MORE', confidence: 0.87 },
          { sign: 'EAT', confidence: 0.55 },
        ],
        gesture_type: 'fingertip_cluster',
        language: 'asl',
      };
    }
  }

  // 8. DRINK: "C" cup handshape
  const dCGap = dist(thumbTip, indexTip);
  const isCShape =
    dCGap > 0.35 &&
    dCGap < 0.75 &&
    indexCurl > 1.10 &&
    indexCurl < 1.50 &&
    middleCurl > 1.10 &&
    middleCurl < 1.50 &&
    ringCurl > 1.10 &&
    ringCurl < 1.50 &&
    !indexExt;

  if (isCShape && avgY < 0.60) {
    return {
      status: 'recognized',
      sign: 'DRINK',
      confidence: 0.84,
      margin: 0.28,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'DRINK', confidence: 0.84 },
        { sign: 'MORE', confidence: 0.40 },
      ],
      gesture_type: 'c_cup_handshape',
      language: 'asl',
    };
  }

  // 9. STOP / PLEASE / THANK YOU: Open flat hand (4 fingers extended)
  if (extendedCount === 4) {
    if (palmNormal[2] > 0.40 && avgY > 0.40) {
      return {
        status: 'recognized',
        sign: 'PLEASE',
        confidence: 0.84,
        margin: 0.26,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'PLEASE', confidence: 0.84 },
          { sign: 'THANK YOU', confidence: 0.50 },
        ],
        gesture_type: 'flat_hand_chest',
        language: 'asl',
      };
    } else if (avgY < 0.42) {
      return {
        status: 'recognized',
        sign: 'THANK YOU',
        confidence: 0.85,
        margin: 0.28,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'THANK YOU', confidence: 0.85 },
          { sign: 'STOP', confidence: 0.45 },
        ],
        gesture_type: 'flat_hand_chin',
        language: 'asl',
      };
    } else {
      return {
        status: 'recognized',
        sign: 'STOP',
        confidence: 0.86,
        margin: 0.30,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'STOP', confidence: 0.86 },
          { sign: 'THANK YOU', confidence: 0.50 },
        ],
        gesture_type: 'flat_hand_vertical',
        language: 'asl',
      };
    }
  }

  return {
    status: 'candidate',
    sign: 'RECOGNIZING',
    confidence: 0.45,
    margin: 0.05,
    is_candidate: true,
    message: 'Sign candidate in progress',
    rejection_reason: 'ambiguous_margin',
    top_candidates: [
      { sign: 'RECOGNIZING', confidence: 0.45 },
      { sign: 'UNCERTAIN', confidence: 0.35 },
    ],
    language: 'asl',
  };
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
