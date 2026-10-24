/**
 * MediaPipe Tasks Vision Web Handler
 * Runs client-side hand landmark extraction in WebAssembly/GPU
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { DetectedHand } from '@/types/contract';

let handLandmarker: HandLandmarker | null = null;
let isInitializing = false;

export async function initHandLandmarker(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker;
  if (isInitializing) {
    // Wait for in-flight initialization
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (handLandmarker) return handLandmarker;
  }

  isInitializing = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    console.log('MediaPipe HandLandmarker successfully initialized');
    return handLandmarker;
  } finally {
    isInitializing = false;
  }
}

export function extractLandmarksFromVideo(
  landmarker: HandLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
  isFrontFacing: boolean = true
): DetectedHand[] {
  if (video.readyState < 2) return [];

  try {
    const result = landmarker.detectForVideo(video, timestampMs);
    if (!result.landmarks || result.landmarks.length === 0) {
      return [];
    }

    const detectedHands: DetectedHand[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const rawPoints = result.landmarks[i];
      const handednessCategory = result.handedness?.[i]?.[0];
      const rawHandedness = handednessCategory?.categoryName;

      // MediaPipe reports handedness from the camera's perspective.
      // When using the front-facing camera (selfie mode), the frame is
      // horizontally mirrored relative to the user, so MediaPipe's
      // "Left" actually corresponds to the user's physical right hand.
      // We invert the label to match the user's physical body frame.
      // For rear-facing (environment) camera, use MediaPipe's label as-is.
      const handedness: 'Left' | 'Right' | 'Unknown' = isFrontFacing
        ? (rawHandedness === 'Left' ? 'Right' : rawHandedness === 'Right' ? 'Left' : 'Unknown')
        : ((rawHandedness as 'Left' | 'Right') || 'Unknown');

      const score = handednessCategory?.score || 0.9;

      detectedHands.push({
        handedness,
        score,
        landmarks: rawPoints.map((pt) => ({
          x: pt.x,
          y: pt.y,
          z: pt.z,
        })),
      });
    }

    return detectedHands;
  } catch (err) {
    console.error('Hand tracking error:', err);
    return [];
  }
}

