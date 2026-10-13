/**
 * SignFlow In-Browser Client-Side Feature Normalizer & PSL Classifier
 *
 * Provides high-speed, zero-dependency edge inference directly in the browser.
 * Implements identical canonical landmark normalization and geometric classification
 * as cv-service/preprocessing.py and cv-service/inference.py.
 *
 * Ensures seamless, 100% functional deployment on Serverless platforms (e.g. Vercel)
 * where persistent background WebSocket daemons are not available.
 */

import { FramePayload, PredictionEvent, DetectedHand } from '@/types/contract';

export interface ClientPredictionResult {
  status: 'recognized' | 'candidate' | 'uncertain' | 'no_hands';
  sign: string | null;
  confidence: number;
  is_candidate: boolean;
  message: string | null;
}

/**
 * Normalizes 21 MediaPipe hand landmarks identically to preprocessing.py:
 * 1. Aspect-ratio correction in Euclidean space.
 * 2. Wrist-centering (wrist is landmark 0).
 * 3. Scale normalization by distance between wrist (0) and middle MCP (9).
 */
export function normalizeClientLandmarks(
  landmarks: { x: number; y: number; z: number }[],
  imageWidth: number = 1280,
  imageHeight: number = 720
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

  // 2. Scale normalization: distance between wrist (0) and middle MCP (9)
  const mcp = centered[9];
  let scaleDist = Math.hypot(mcp[0], mcp[1], mcp[2]);

  if (scaleDist < 1e-4) {
    // Fallback if collapsed
    const maxCoord = Math.max(...centered.flatMap(([x, y, z]) => [Math.abs(x), Math.abs(y), Math.abs(z)]));
    scaleDist = maxCoord > 1e-4 ? maxCoord : 1.0;
  }

  return centered.map(([x, y, z]) => [
    x / scaleDist,
    y / scaleDist,
    z / scaleDist,
  ]);
}

/**
 * Evaluates geometric PSL postures matching inference.py baseline rules:
 * - HELLO: Open palm (all 4 fingers extended + thumb out)
 * - STOP: Closed fist (0 fingers extended, thumb curled)
 * - YES: Thumbs up (thumb extended, other 4 fingers curled)
 * - HELP: Index finger pointing up
 * - WATER: 3 fingers extended (Index, Middle, Ring)
 */
export function classifyHandFeatures(normalizedCoords: number[][]): ClientPredictionResult {
  if (normalizedCoords.length !== 21) {
    return {
      status: 'uncertain',
      sign: null,
      confidence: 0,
      is_candidate: false,
      message: 'Invalid coordinate count',
    };
  }

  const coords = normalizedCoords;

  // Finger extension checks (in normalized coords, negative y is higher in camera image):
  // Tip y vs PIP y determines if finger is extended
  const thumbExt = coords[4][0] > coords[3][0];
  const indexExt = coords[8][1] < coords[6][1];
  const middleExt = coords[12][1] < coords[10][1];
  const ringExt = coords[16][1] < coords[14][1];
  const pinkyExt = coords[20][1] < coords[18][1];

  const extendedFingers = [indexExt, middleExt, ringExt, pinkyExt];
  const extendedCount = extendedFingers.filter(Boolean).length;

  if (extendedCount === 4 && thumbExt) {
    // Open palm -> HELLO
    return {
      status: 'recognized',
      sign: 'HELLO',
      confidence: 0.92,
      is_candidate: true,
      message: null,
    };
  } else if (extendedCount === 0 && !thumbExt) {
    // Fist -> STOP
    return {
      status: 'recognized',
      sign: 'STOP',
      confidence: 0.88,
      is_candidate: true,
      message: null,
    };
  } else if (extendedCount === 0 && thumbExt) {
    // Thumbs up -> YES
    return {
      status: 'recognized',
      sign: 'YES',
      confidence: 0.89,
      is_candidate: true,
      message: null,
    };
  } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    // Index pointing up -> HELP
    return {
      status: 'recognized',
      sign: 'HELP',
      confidence: 0.86,
      is_candidate: true,
      message: null,
    };
  } else if (indexExt && middleExt && ringExt && !pinkyExt) {
    // 3 fingers extended -> WATER
    return {
      status: 'recognized',
      sign: 'WATER',
      confidence: 0.87,
      is_candidate: true,
      message: null,
    };
  } else {
    // Motion in progress or ambiguous transition
    return {
      status: 'candidate',
      sign: 'RECOGNIZING',
      confidence: 0.65,
      is_candidate: true,
      message: 'Sign candidate in progress',
    };
  }
}

/**
 * End-to-end client prediction pipeline for a single frame payload.
 * Emits a structured v1.0 PredictionEvent matching the backend WebSocket contract.
 */
export function runClientInference(payload: FramePayload): PredictionEvent {
  const timestamp = Date.now();

  if (payload.hands_detected === 0 || !payload.hands || payload.hands.length === 0) {
    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: 'no_hands',
      sign: null,
      confidence: 0.0,
      is_candidate: false,
      message: 'No hands detected in frame',
    };
  }

  const primaryHand = payload.hands[0];
  if (!primaryHand.landmarks || primaryHand.landmarks.length !== 21) {
    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: 'uncertain',
      sign: null,
      confidence: 0.0,
      is_candidate: false,
      message: 'Invalid hand landmarks',
    };
  }

  try {
    const normalized = normalizeClientLandmarks(
      primaryHand.landmarks,
      payload.image_width,
      payload.image_height
    );

    const result = classifyHandFeatures(normalized);

    return {
      schema_version: '1.0',
      session_id: payload.session_id,
      frame_id: payload.frame_id,
      timestamp,
      status: result.status,
      sign: result.sign,
      confidence: result.confidence,
      is_candidate: result.is_candidate,
      message: result.message,
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
      is_candidate: false,
      message: err?.message || 'Feature processing error',
    };
  }
}
