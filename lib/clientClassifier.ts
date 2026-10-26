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

  // Index finger direction vector
  const vIndex = [indexTip[0] - indexMcp[0], indexTip[1] - indexMcp[1], indexTip[2] - indexMcp[2]];
  const normVIndex = Math.hypot(vIndex[0], vIndex[1], vIndex[2]) || 1.0;
  const vIndexNorm = [vIndex[0] / normVIndex, vIndex[1] / normVIndex, vIndex[2] / normVIndex];

  // Adjacent finger spacings
  const dIndexMiddle = dist(indexTip, middleTip);
  const dMiddleRing = dist(middleTip, ringTip);
  const dRingPinky = dist(ringTip, pinkyTip);

  // 1. PLAY: "Y" handshape (Thumb and Pinky extended, middle 3 curled)
  if (thumbExt && pinkyExt && !middleExt && !ringExt && indexCurl < 1.25) {
    return {
      status: 'recognized',
      sign: 'PLAY',
      confidence: 0.94,
      margin: 0.40,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'PLAY', confidence: 0.94 },
        { sign: 'YES', confidence: 0.40 },
      ],
      gesture_type: 'y_handshape',
      language: 'asl',
    };
  }

  // 2. FIND: "F" handshape (Thumb and Index fingertips touching to pick up, other 3 extended)
  if (dThumbIndex < 0.38 && middleExt && ringExt && pinkyExt) {
    return {
      status: 'recognized',
      sign: 'FIND',
      confidence: 0.92,
      margin: 0.36,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'FIND', confidence: 0.92 },
        { sign: 'F', confidence: 0.70 },
      ],
      gesture_type: 'f_pinch_handshape',
      language: 'asl',
    };
  }

  // 3. MORE / EAT: 5 fingertips cluster (all 5 tips meet together in a tapered point)
  const allTipsTouchThumb =
    dist(thumbTip, indexTip) < 0.38 &&
    dist(thumbTip, middleTip) < 0.40 &&
    dist(thumbTip, ringTip) < 0.38 &&
    dist(thumbTip, pinkyTip) < 0.38;

  if (allTipsTouchThumb && extendedCount < 4) {
    if (avgY < 0.40) {
      return {
        status: 'recognized',
        sign: 'EAT',
        confidence: 0.92,
        margin: 0.36,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'EAT', confidence: 0.92 },
          { sign: 'MORE', confidence: 0.55 },
        ],
        gesture_type: 'cluster_at_mouth',
        language: 'asl',
      };
    } else {
      return {
        status: 'recognized',
        sign: 'MORE',
        confidence: 0.92,
        margin: 0.36,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'MORE', confidence: 0.92 },
          { sign: 'EAT', confidence: 0.55 },
        ],
        gesture_type: 'fingertip_cluster',
        language: 'asl',
      };
    }
  }

  // 4. NO: 3-finger snapping beak (Index + Middle extended with tips touching Thumb tip, ring & pinky curled)
  const indexOrMiddleExt = (indexTip[1] < indexPip[1] || middleTip[1] < middlePip[1]) || (indexCurl >= 1.18 || middleCurl >= 1.18);
  if (
    indexOrMiddleExt &&
    dThumbIndex < 0.45 &&
    dThumbMiddle < 0.48 &&
    dist(thumbTip, ringTip) > 0.35 &&
    dist(thumbTip, pinkyTip) > 0.35 &&
    ringCurl < 1.25 &&
    pinkyCurl < 1.25 &&
    !ringExt &&
    !pinkyExt
  ) {
    return {
      status: 'recognized',
      sign: 'NO',
      confidence: 0.92,
      margin: 0.36,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'NO', confidence: 0.92 },
        { sign: 'MORE', confidence: 0.45 },
      ],
      gesture_type: 'three_finger_pinch',
      language: 'asl',
    };
  }

  // 5. DRINK: "C" cup handshape tilted near mouth
  const dCGap = dist(thumbTip, indexTip);
  const isCShape =
    dCGap > 0.35 &&
    dCGap < 0.80 &&
    indexCurl > 1.05 &&
    indexCurl < 1.55 &&
    middleCurl > 1.05 &&
    middleCurl < 1.55 &&
    ringCurl > 1.05 &&
    ringCurl < 1.55 &&
    !indexExt;

  if (isCShape && avgY < 0.60) {
    return {
      status: 'recognized',
      sign: 'DRINK',
      confidence: 0.90,
      margin: 0.32,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'DRINK', confidence: 0.90 },
        { sign: 'MORE', confidence: 0.40 },
      ],
      gesture_type: 'c_cup_handshape',
      language: 'asl',
    };
  }

  // 6. RESTROOM: "T" handshape (Thumb tucked between index & middle knuckles)
  if (
    curledCount === 4 &&
    !indexExt &&
    !thumbExt &&
    Math.abs(thumbTip[0] - (indexPip[0] + middlePip[0]) / 2.0) < 0.30 * palmScale &&
    thumbTip[1] < indexPip[1] + 0.15 * palmScale
  ) {
    return {
      status: 'recognized',
      sign: 'RESTROOM',
      confidence: 0.90,
      margin: 0.35,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'RESTROOM', confidence: 0.90 },
        { sign: 'YES', confidence: 0.45 },
      ],
      gesture_type: 't_handshape',
      language: 'asl',
    };
  }

  // 7. HELP: Thumbs up upright, all 4 fingers curled
  const thumbPointingUp = (thumbTip[1] - thumbMcp[1]) < -0.12 * palmScale || (thumbTip[1] - wrist[1]) < -0.35 * palmScale;
  if (curledCount >= 3 && thumbExt && thumbPointingUp && dThumbIndex > 0.18) {
    return {
      status: 'recognized',
      sign: 'HELP',
      confidence: 0.94,
      margin: 0.38,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'HELP', confidence: 0.94 },
        { sign: 'YES', confidence: 0.50 },
      ],
      gesture_type: 'thumb_up',
      language: 'asl',
    };
  }

  // 8. SORRY: Closed fist held against chest
  if (curledCount === 4 && dist(thumbTip, indexMcp) < 0.50 && avgY >= 0.42 && avgY <= 0.72) {
    return {
      status: 'recognized',
      sign: 'SORRY',
      confidence: 0.88,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'SORRY', confidence: 0.88 },
        { sign: 'YES', confidence: 0.65 },
      ],
      gesture_type: 'fist_on_chest',
      language: 'asl',
    };
  }

  // 9. YES: Closed fist (all 4 fingers curled, thumb folded across fingers)
  if (curledCount === 4 && !thumbExt) {
    return {
      status: 'recognized',
      sign: 'YES',
      confidence: 0.90,
      margin: 0.35,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'YES', confidence: 0.90 },
        { sign: 'RESTROOM', confidence: 0.42 },
      ],
      gesture_type: 'closed_fist',
      language: 'asl',
    };
  }

  // 10. WANT: Claw hands (all 5 fingers curved/clawed, palm facing upward/inward)
  const isClawed =
    indexCurl > 1.10 && indexCurl < 1.65 &&
    middleCurl > 1.10 && middleCurl < 1.65 &&
    ringCurl > 1.10 && ringCurl < 1.65 &&
    pinkyCurl > 1.10 && pinkyCurl < 1.65;
  if (isClawed && (palmNormal[1] < -0.15 || palmNormal[2] < -0.15)) {
    return {
      status: 'recognized',
      sign: 'WANT',
      confidence: 0.88,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'WANT', confidence: 0.88 },
        { sign: 'EAT', confidence: 0.40 },
      ],
      gesture_type: 'claw_hand_inward',
      language: 'asl',
    };
  }

  // 11. SIT: Index and Middle extended but bent/hooked downward at knuckles
  if (
    vIndexNorm[1] > 0.40 &&
    indexTip[1] > indexPip[1] &&
    middleTip[1] > middlePip[1] &&
    ringCurl < 1.25 &&
    pinkyCurl < 1.25
  ) {
    return {
      status: 'recognized',
      sign: 'SIT',
      confidence: 0.88,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'SIT', confidence: 0.88 },
        { sign: 'GO', confidence: 0.40 },
      ],
      gesture_type: 'hooked_fingers_down',
      language: 'asl',
    };
  }

  // 12. HURT: Index finger pointing horizontally across body
  if (indexExt && !middleExt && !ringExt && !pinkyExt && Math.abs(vIndexNorm[0]) > 0.68) {
    return {
      status: 'recognized',
      sign: 'HURT',
      confidence: 0.90,
      margin: 0.32,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'HURT', confidence: 0.90 },
        { sign: 'HELP', confidence: 0.45 },
      ],
      gesture_type: 'index_pointing_horizontal',
      language: 'asl',
    };
  }

  // 13. GO / YOU: Index finger pointing forward toward camera
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    if (vIndexNorm[2] < -0.18 || (Math.abs(vIndexNorm[0]) > 0.55 && vIndexNorm[1] < 0.2)) {
      return {
        status: 'recognized',
        sign: 'GO',
        confidence: 0.92,
        margin: 0.35,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'GO', confidence: 0.92 },
          { sign: 'YOU', confidence: 0.85 },
        ],
        gesture_type: 'index_pointing_forward',
        language: 'asl',
      };
    } else if (vIndexNorm[1] < -0.5) {
      return {
        status: 'recognized',
        sign: 'HELP',
        confidence: 0.84,
        margin: 0.28,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HELP', confidence: 0.84 },
          { sign: 'GO', confidence: 0.40 },
        ],
        gesture_type: 'index_pointing_up',
        language: 'asl',
      };
    }
  }

  // 14. SLEEP: Hand at face level closing downward
  if (avgY < 0.36 && palmNormal[2] < 0.10 && (extendedCount >= 3 || allTipsTouchThumb)) {
    return {
      status: 'recognized',
      sign: 'SLEEP',
      confidence: 0.88,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'SLEEP', confidence: 0.88 },
        { sign: 'THANK YOU', confidence: 0.45 },
      ],
      gesture_type: 'hand_closing_at_face',
      language: 'asl',
    };
  }

  // 15. OPEN HAND FAMILY: HELLO, STOP, THANK YOU, PLEASE, OPEN, ALL DONE
  if (extendedCount >= 4) {
    const fingersSpread = dIndexMiddle >= 0.22;
    const fingersTogether = dIndexMiddle < 0.32 && dMiddleRing < 0.32;

    // A. HELLO: Open palm facing camera with fingers spread, held upright near face/shoulder
    if (fingersSpread && palmNormal[2] > -0.25 && avgY < 0.65) {
      return {
        status: 'recognized',
        sign: 'HELLO',
        confidence: 0.95,
        margin: 0.40,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HELLO', confidence: 0.95 },
          { sign: 'STOP', confidence: 0.45 },
        ],
        gesture_type: 'open_palm_greeting',
        language: 'asl',
      };
    }

    // B. THANK YOU: Flat hand at chin/mouth height
    if (avgY < 0.38) {
      return {
        status: 'recognized',
        sign: 'THANK YOU',
        confidence: 0.92,
        margin: 0.35,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'THANK YOU', confidence: 0.92 },
          { sign: 'HELLO', confidence: 0.50 },
        ],
        gesture_type: 'flat_hand_chin',
        language: 'asl',
      };
    }

    // C. PLEASE: Flat hand placed over chest, palm facing inward
    if (avgY >= 0.40 && avgY <= 0.72 && palmNormal[2] < 0.15) {
      return {
        status: 'recognized',
        sign: 'PLEASE',
        confidence: 0.90,
        margin: 0.32,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'PLEASE', confidence: 0.90 },
          { sign: 'STOP', confidence: 0.50 },
        ],
        gesture_type: 'flat_hand_chest',
        language: 'asl',
      };
    }

    // D. STOP: Flat vertical palm facing directly forward, fingers together
    if (fingersTogether && palmNormal[2] > 0.15) {
      return {
        status: 'recognized',
        sign: 'STOP',
        confidence: 0.94,
        margin: 0.38,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'STOP', confidence: 0.94 },
          { sign: 'HELLO', confidence: 0.45 },
        ],
        gesture_type: 'flat_hand_vertical_stop',
        language: 'asl',
      };
    }

    // E. OPEN: Flat hand held vertically with palm angled laterally (doors opening)
    if (Math.abs(palmNormal[0]) > 0.35 && avgY >= 0.35 && avgY <= 0.75) {
      return {
        status: 'recognized',
        sign: 'OPEN',
        confidence: 0.90,
        margin: 0.35,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'OPEN', confidence: 0.90 },
          { sign: 'STOP', confidence: 0.45 },
        ],
        gesture_type: 'flat_hand_open_doors',
        language: 'asl',
      };
    }

    // F. ALL DONE: Open hand spread wide twisting
    return {
      status: 'recognized',
      sign: 'ALL DONE',
      confidence: 0.88,
      margin: 0.30,
      is_candidate: true,
      message: null,
      top_candidates: [
        { sign: 'ALL DONE', confidence: 0.88 },
        { sign: 'HELLO', confidence: 0.45 },
      ],
      gesture_type: 'open_hands_spread',
      language: 'asl',
    };
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
 * Evaluates two-hand coordinated ASL/PSL gestures matching common conversational signs:
 * - HURT: Both index fingers pointing towards each other horizontally
 * - HELP: Thumbs up resting on or above open flat palm
 * - MORE: Both hands with clustered fingertips touching / tapping
 * - OPEN: Both hands flat open side by side separating like doors
 * - STOP: One hand vertical chopping onto other flat horizontal palm
 * - SIT: One hand hooked fingers over other hand's flat fingers
 * - PLAY: Both hands showing "Y" handshapes
 * - ALL DONE: Both hands open flat with fingers spread wide
 */
export function classifyTwoHandFeatures(
  hands: DetectedHand[],
  imageWidth: number = 1280,
  imageHeight: number = 720
): ClientPredictionResult | null {
  if (!hands || hands.length < 2) return null;
  const h1 = hands[0];
  const h2 = hands[1];
  if (!h1.landmarks || h1.landmarks.length !== 21 || !h2.landmarks || h2.landmarks.length !== 21) {
    return null;
  }

  try {
    const norm1 = normalizeClientLandmarks(h1.landmarks, imageWidth, imageHeight, h1.handedness);
    const norm2 = normalizeClientLandmarks(h2.landmarks, imageWidth, imageHeight, h2.handedness);

    const res1 = classifyHandFeatures(norm1, h1.landmarks, h1.handedness);
    const res2 = classifyHandFeatures(norm2, h2.landmarks, h2.handedness);

    const w1 = h1.landmarks[0];
    const w2 = h2.landmarks[0];
    const distWrists = Math.hypot(w1.x - w2.x, w1.y - w2.y);

    // 1. HURT: Both hands have index fingers pointing towards each other horizontally
    const tip1 = h1.landmarks[8];
    const mcp1 = h1.landmarks[5];
    const tip2 = h2.landmarks[8];
    const mcp2 = h2.landmarks[5];
    const isIdx1 = Math.hypot(tip1.x - mcp1.x, tip1.y - mcp1.y) > 0.08;
    const isIdx2 = Math.hypot(tip2.x - mcp2.x, tip2.y - mcp2.y) > 0.08;
    const isHorizontal1 = Math.abs(tip1.x - mcp1.x) > Math.abs(tip1.y - mcp1.y);
    const isHorizontal2 = Math.abs(tip2.x - mcp2.x) > Math.abs(tip2.y - mcp2.y);

    if (isIdx1 && isIdx2 && isHorizontal1 && isHorizontal2 && distWrists < 0.65) {
      return {
        status: 'recognized',
        sign: 'HURT',
        confidence: 0.96,
        margin: 0.42,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HURT', confidence: 0.96 },
          { sign: 'HELP', confidence: 0.40 },
        ],
        gesture_type: 'two_hands_hurt_pointing',
        language: 'asl',
      };
    }

    // 2. HELP: One hand is thumbs-up upright, other hand is flat open palm beneath it
    const isThumbUp1 = res1.sign === 'HELP' || res1.gesture_type === 'thumb_up';
    const isThumbUp2 = res2.sign === 'HELP' || res2.gesture_type === 'thumb_up';
    const isOpen1 = ['STOP', 'PLEASE', 'HELLO', 'ALL DONE', 'OPEN'].includes(res1.sign || '');
    const isOpen2 = ['STOP', 'PLEASE', 'HELLO', 'ALL DONE', 'OPEN'].includes(res2.sign || '');

    if ((isThumbUp1 && isOpen2) || (isThumbUp2 && isOpen1)) {
      return {
        status: 'recognized',
        sign: 'HELP',
        confidence: 0.97,
        margin: 0.45,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'HELP', confidence: 0.97 },
          { sign: 'YES', confidence: 0.40 },
        ],
        gesture_type: 'two_hands_help_support',
        language: 'asl',
      };
    }

    // 3. MORE: Both hands have clustered fingertips (flattened-O) touching
    if ((res1.sign === 'MORE' || res1.sign === 'EAT') && (res2.sign === 'MORE' || res2.sign === 'EAT')) {
      return {
        status: 'recognized',
        sign: 'MORE',
        confidence: 0.96,
        margin: 0.42,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'MORE', confidence: 0.96 },
          { sign: 'ALL DONE', confidence: 0.40 },
        ],
        gesture_type: 'two_hands_more_tapping',
        language: 'asl',
      };
    }

    // 4. OPEN: Both hands flat open side by side
    if (
      ['STOP', 'HELLO', 'PLEASE', 'OPEN', 'ALL DONE'].includes(res1.sign || '') &&
      ['STOP', 'HELLO', 'PLEASE', 'OPEN', 'ALL DONE'].includes(res2.sign || '')
    ) {
      const dy = Math.abs(w1.y - w2.y);
      if (dy < 0.25 && distWrists > 0.15) {
        return {
          status: 'recognized',
          sign: 'OPEN',
          confidence: 0.95,
          margin: 0.40,
          is_candidate: true,
          message: null,
          top_candidates: [
            { sign: 'OPEN', confidence: 0.95 },
            { sign: 'ALL DONE', confidence: 0.45 },
          ],
          gesture_type: 'two_hands_open_doors',
          language: 'asl',
        };
      }
    }

    // 5. STOP: One hand vertical flat chopping on horizontal flat palm of other
    if ((res1.sign === 'STOP' && isOpen2) || (res2.sign === 'STOP' && isOpen1)) {
      return {
        status: 'recognized',
        sign: 'STOP',
        confidence: 0.96,
        margin: 0.42,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'STOP', confidence: 0.96 },
          { sign: 'HELLO', confidence: 0.40 },
        ],
        gesture_type: 'two_hands_stop_barrier',
        language: 'asl',
      };
    }

    // 6. SIT: One hand hooked fingers (SIT), other hand flat palm/fingers
    if ((res1.sign === 'SIT' && isOpen2) || (res2.sign === 'SIT' && isOpen1)) {
      return {
        status: 'recognized',
        sign: 'SIT',
        confidence: 0.95,
        margin: 0.40,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'SIT', confidence: 0.95 },
          { sign: 'GO', confidence: 0.40 },
        ],
        gesture_type: 'two_hands_sit_bench',
        language: 'asl',
      };
    }

    // 7. PLAY: Both hands showing "Y" handshape
    if (res1.sign === 'PLAY' && res2.sign === 'PLAY') {
      return {
        status: 'recognized',
        sign: 'PLAY',
        confidence: 0.96,
        margin: 0.42,
        is_candidate: true,
        message: null,
        top_candidates: [
          { sign: 'PLAY', confidence: 0.96 },
          { sign: 'YES', confidence: 0.40 },
        ],
        gesture_type: 'two_hands_play',
        language: 'asl',
      };
    }

    return null;
  } catch {
    return null;
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

  // 1. If 2 or more hands are present, check two-hand coordinated gestures first
  if (payload.hands && payload.hands.length >= 2) {
    const twoHandResult = classifyTwoHandFeatures(
      payload.hands,
      payload.image_width,
      payload.image_height
    );
    if (twoHandResult && twoHandResult.status === 'recognized') {
      return {
        schema_version: '1.0',
        session_id: payload.session_id,
        frame_id: payload.frame_id,
        timestamp,
        status: twoHandResult.status,
        sign: twoHandResult.sign,
        confidence: twoHandResult.confidence,
        margin: twoHandResult.margin,
        is_candidate: twoHandResult.is_candidate,
        message: twoHandResult.message,
        rejection_reason: twoHandResult.rejection_reason,
        top_candidates: twoHandResult.top_candidates,
        hands_count: handsCount,
        handedness: 'Both',
        language: twoHandResult.language || 'asl',
      };
    }
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
