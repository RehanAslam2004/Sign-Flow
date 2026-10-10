/**
 * SignFlow WebSocket Contract v1.0
 * Shared interface between Next.js frontend and Python FastAPI service
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  handedness: 'Left' | 'Right' | 'Unknown';
  score: number;
  landmarks: LandmarkPoint[]; // 21 MediaPipe hand landmarks in order
}

export interface FramePayload {
  schema_version: '1.0';
  session_id: string;
  frame_id: number;
  timestamp: number;
  image_width: number;
  image_height: number;
  hands_detected: number;
  hands: DetectedHand[];
}

export type RecognitionStatus =
  | 'recognized'
  | 'candidate'
  | 'uncertain'
  | 'no_hands'
  | 'error';

export interface PredictionEvent {
  schema_version: '1.0';
  session_id: string;
  frame_id: number;
  timestamp: number;
  status: RecognitionStatus;
  sign: string | null;
  confidence: number;
  is_candidate: boolean;
  message?: string | null;
}
