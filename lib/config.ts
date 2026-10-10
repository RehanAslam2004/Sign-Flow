/**
 * SignFlow Global Configuration & Tuning Constants
 */

export const CONFIG = {
  // WebSocket server URL for Python CV service
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws/predict',

  // Recognition state machine tuning (in milliseconds)
  STABILITY_WINDOW_MS: 600, // Duration a sign candidate must be held consistently
  GESTURE_RESET_TIMEOUT_MS: 400, // Inactivity / rest window before re-arming same sign
  UTTERANCE_PAUSE_MS: 1200, // Pause without signing before auto-speaking the accumulated phrase

  // Confidence thresholds
  CONFIDENCE_THRESHOLD: 0.70, // Minimum confidence to accept a sign as confirmed
  CANDIDATE_THRESHOLD: 0.50, // Minimum confidence to display as subtle candidate preview

  // Frame processing
  TARGET_FPS: 25, // Throttling interval ~40ms between sent WebSocket frames
};
