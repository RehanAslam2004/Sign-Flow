/**
 * SignFlow 3D Pointing and Referential Gesture Kinematics Analyzer (Client-side)
 *
 * Analyzes 3D hand geometry and finger kinematics to recognize deictic pointing:
 * 1. Pointing toward camera / addressee -> "YOU" / "Ap"
 * 2. Pointing toward self / torso -> "ME" / "Mujhay"
 * 3. Pointing downward / spatial reference -> "THIS" / "Ye"
 * 4. Pointing upward -> "Alif" / "1" / "D" / "HELP"
 */

import { LandmarkPoint } from '@/types/contract';

export interface PointingGestureResult {
  isPointing: boolean;
  gestureType: 'point_addressee' | 'point_self' | 'point_spatial' | 'point_up' | 'point_ambiguous' | null;
  candidatePSL: string | null;
  candidateEN: string | null;
  confidence: number;
  margin: number;
  directionVector: [number, number, number] | null;
  diagnostics: Record<string, any>;
}

export function analyzePointingLandmarks(
  landmarks: LandmarkPoint[],
  handedness: string = 'Right'
): PointingGestureResult {
  if (!landmarks || landmarks.length !== 21) {
    return {
      isPointing: false,
      gestureType: null,
      candidatePSL: null,
      candidateEN: null,
      confidence: 0,
      margin: 0,
      directionVector: null,
      diagnostics: {},
    };
  }

  const wrist = landmarks[0];
  const mcpIndex = landmarks[5];
  const pipIndex = landmarks[6];
  const dipIndex = landmarks[7];
  const tipIndex = landmarks[8];

  const mcpMiddle = landmarks[9];
  const tipMiddle = landmarks[12];

  const mcpRing = landmarks[13];
  const tipRing = landmarks[16];

  const mcpPinky = landmarks[17];
  const tipPinky = landmarks[20];

  const dist3D = (a: LandmarkPoint, b: LandmarkPoint) =>
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  const palmScale = Math.max(dist3D(mcpMiddle, wrist), 1e-4);

  // 0. Guard: If index tip and thumb tip touch or are close, it is an "O", "F", or pinch shape, NEVER pointing!
  const tipThumb = landmarks[4];
  const dIndexThumb = dist3D(tipIndex, tipThumb);
  if (dIndexThumb < 0.38 * palmScale) {
    return {
      isPointing: false,
      gestureType: null,
      candidatePSL: null,
      candidateEN: null,
      confidence: 0,
      margin: 0,
      directionVector: null,
      diagnostics: { reason: 'index_thumb_touching_pinch_or_o_shape' },
    };
  }

  // 1. Index finger extension check (orientation-independent knuckle-to-tip distance)
  const indexLen = dist3D(tipIndex, mcpIndex);
  const isIndexExtended = indexLen > 0.85 * palmScale;

  // 2. Middle, Ring, Pinky must be curled into palm
  const middleLen = dist3D(tipMiddle, mcpMiddle);
  const ringLen = dist3D(tipRing, mcpRing);
  const pinkyLen = dist3D(tipPinky, mcpPinky);

  const otherFingersCurled =
    middleLen < 0.75 * palmScale &&
    ringLen < 0.75 * palmScale &&
    pinkyLen < 0.75 * palmScale;

  if (!isIndexExtended || !otherFingersCurled) {
    return {
      isPointing: false,
      gestureType: null,
      candidatePSL: null,
      candidateEN: null,
      confidence: 0,
      margin: 0,
      directionVector: null,
      diagnostics: {
        isIndexExtended,
        otherFingersCurled,
        middleLen,
        ringLen,
        pinkyLen,
      },
    };
  }

  // 3. 3D Index pointing vector (from MCP 5 to TIP 8)
  const vx = tipIndex.x - mcpIndex.x;
  const vy = tipIndex.y - mcpIndex.y;
  const vz = tipIndex.z - mcpIndex.z;
  const norm = Math.hypot(vx, vy, vz);

  if (norm < 1e-4) {
    return {
      isPointing: false,
      gestureType: null,
      candidatePSL: null,
      candidateEN: null,
      confidence: 0,
      margin: 0,
      directionVector: null,
      diagnostics: {},
    };
  }

  const dx = vx / norm;
  const dy = vy / norm;
  const dz = vz / norm;

  const diagnostics = {
    dx: Number(dx.toFixed(3)),
    dy: Number(dy.toFixed(3)),
    dz: Number(dz.toFixed(3)),
    palmScale: Number(palmScale.toFixed(3)),
  };

  // 4. Direction classification
  // A. Pointing to Camera / Addressee ("YOU" / "Ap")
  // In MediaPipe Hands, negative z indicates closer to camera lens
  if (dz < -0.25) {
    const conf = Math.min(0.96, Math.max(0.70, 0.70 + -dz * 0.25));
    const margin = Math.min(0.45, Math.max(0.15, -dz * 0.40));
    return {
      isPointing: true,
      gestureType: 'point_addressee',
      candidatePSL: 'Ap',
      candidateEN: 'YOU',
      confidence: Number(conf.toFixed(3)),
      margin: Number(margin.toFixed(3)),
      directionVector: [dx, dy, dz],
      diagnostics,
    };
  }

  // B. Pointing to Self / Torso ("ME" / "Mujhay")
  // In MediaPipe, positive z is towards user's chest, OR downward hook towards chest
  if (dz > 0.12 || (dy > 0.35 && Math.abs(dx) < 0.6 && dz > -0.05)) {
    const conf = Math.min(0.96, Math.max(0.70, 0.72 + Math.max(dz, 0) * 0.25));
    const margin = Math.min(0.45, Math.max(0.15, 0.18 + Math.max(dz, 0) * 0.30));
    return {
      isPointing: true,
      gestureType: 'point_self',
      candidatePSL: 'Mujhay',
      candidateEN: 'ME',
      confidence: Number(conf.toFixed(3)),
      margin: Number(margin.toFixed(3)),
      directionVector: [dx, dy, dz],
      diagnostics,
    };
  }

  // C. Pointing Downward / Spatial Object ("THIS" / "Ye")
  if (dy > 0.55 && Math.abs(dz) < 0.35) {
    const conf = Math.min(0.94, Math.max(0.70, 0.70 + dy * 0.22));
    return {
      isPointing: true,
      gestureType: 'point_spatial',
      candidatePSL: 'Ye',
      candidateEN: 'THIS',
      confidence: Number(conf.toFixed(3)),
      margin: 0.25,
      directionVector: [dx, dy, dz],
      diagnostics,
    };
  }

  // D. Pointing Upward ("Alif" / "1" / "HELP")
  if (dy < -0.65 && Math.abs(dz) < 0.35) {
    const conf = Math.min(0.94, Math.max(0.70, 0.70 + -dy * 0.22));
    return {
      isPointing: true,
      gestureType: 'point_up',
      candidatePSL: 'Alif',
      candidateEN: 'HELP',
      confidence: Number(conf.toFixed(3)),
      margin: 0.22,
      directionVector: [dx, dy, dz],
      diagnostics,
    };
  }

  // Ambiguous pointing
  return {
    isPointing: true,
    gestureType: 'point_ambiguous',
    candidatePSL: null,
    candidateEN: null,
    confidence: 0.50,
    margin: 0.05,
    directionVector: [dx, dy, dz],
    diagnostics,
  };
}
