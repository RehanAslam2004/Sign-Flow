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

export type SignLanguageMode = 'unified' | 'psl_extended' | 'psl_words' | 'psl_alphabets' | 'asl' | 'asl_continuous';

export interface FramePayload {
  schema_version: '1.0' | '2.0';
  session_id: string;
  frame_id: number;
  timestamp: number;
  image_width: number;
  image_height: number;
  hands_detected: number;
  hands: DetectedHand[];
  language?: SignLanguageMode;
  // Gemini temporal frame extensions
  image_data?: string; // Base64 JPEG frame for multimodal sequence analysis
  is_boundary_pause?: boolean;
  context_sentence?: string;
  sequence_id?: string;
}

export type RecognitionStatus =
  | 'recognized'
  | 'candidate'
  | 'uncertain'
  | 'no_hands'
  | 'error'
  | 'buffering'
  | 'partial'
  | 'complete';

export interface PredictionCandidate {
  sign: string;
  confidence: number;
}

export interface PredictionEvent {
  schema_version: '1.0' | '2.0';
  session_id: string;
  frame_id: number;
  timestamp: number;
  status: RecognitionStatus;
  sign: string | null;
  confidence: number;
  is_candidate: boolean;
  message?: string | null;
  language?: SignLanguageMode | string;
  // Gemini temporal interpretation fields:
  recognized_text?: string;
  sequence_id?: string;
  alternatives?: string[];
  uncertainty_reason?: string | null;
  observations?: string[];
  start_timestamp_ms?: number;
  end_timestamp_ms?: number;
  backend?: string;
  model?: string;
  buffered_frames?: number;
  // Enhanced reliability & diagnostics fields:
  margin?: number;
  top_candidates?: PredictionCandidate[];
  rejection_reason?: string | null;
  hands_count?: number;
  handedness?: string;
  inference_latency_ms?: number;
}


export interface FeedbackSample {
  sample_id: string;
  session_id: string;
  timestamp: number;
  language: SignLanguageMode | string;
  predicted_label: string | null;
  true_label: string;
  confidence: number;
  margin?: number;
  review_status: 'pending_review' | 'verified' | 'rejected';
  notes?: string;
  features?: number[];
  landmarks?: LandmarkPoint[];
}


