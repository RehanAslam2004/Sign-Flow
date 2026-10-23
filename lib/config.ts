/**
 * SignFlow Global Configuration & Tuning Constants
 */

/**
 * Normalizes any entered URL into a valid WebSocket URL.
 * Converts http/https to ws/wss, appends /ws/predict if missing,
 * and upgrades to wss if running on an HTTPS page.
 */
export function normalizeWsUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url) return '';

  // If user pasted an HTTP/HTTPS URL, convert protocol to WebSocket
  if (url.startsWith('https://')) {
    url = 'wss://' + url.slice(8);
  } else if (url.startsWith('http://')) {
    url = 'ws://' + url.slice(7);
  }

  // If no protocol was provided at all, infer from context
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    url = (isHttps ? 'wss://' : 'ws://') + url;
  }

  // If user gave only a hostname (e.g. wss://signflow-cv.onrender.com), append /ws/predict
  try {
    const parsed = new URL(url.replace('ws://', 'http://').replace('wss://', 'https://'));
    if (parsed.pathname === '/' || parsed.pathname === '') {
      url = url.replace(/\/$/, '') + '/ws/predict';
    }
  } catch {
    // If URL parsing fails, keep user string
  }

  // If running on an HTTPS origin, insecure ws:// (except localhost) is blocked by browser mixed-content policy
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (url.startsWith('ws://') && !url.includes('127.0.0.1') && !url.includes('localhost')) {
      url = 'wss://' + url.slice(5);
    }
  }

  return url;
}

/**
 * Resolves the active WebSocket URL:
 * 1. User manual override stored in localStorage ('signflow_custom_ws_url')
 * 2. NEXT_PUBLIC_WS_URL environment variable
 * 3. Default local development server ws://127.0.0.1:8000/ws/predict
 */
export function getResolvedWsUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const customUrl = localStorage.getItem('signflow_custom_ws_url');
      if (customUrl) {
        return normalizeWsUrl(customUrl);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  if (process.env.NEXT_PUBLIC_WS_URL) {
    return normalizeWsUrl(process.env.NEXT_PUBLIC_WS_URL);
  }

  return 'ws://127.0.0.1:8000/ws/predict';
}

export function setCustomWsUrl(url: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (url) {
      localStorage.setItem('signflow_custom_ws_url', normalizeWsUrl(url));
    } else {
      localStorage.removeItem('signflow_custom_ws_url');
    }
  } catch {
    // Ignore
  }
}

export const CONFIG = {
  // Dynamic getter for WebSocket URL
  get WS_URL() {
    return getResolvedWsUrl();
  },

  // Recognition state machine tuning (in milliseconds)
  STABILITY_WINDOW_MS: 600, // Duration a sign candidate must be held consistently
  GESTURE_RESET_TIMEOUT_MS: 400, // Inactivity / rest window before re-arming same sign
  UTTERANCE_PAUSE_MS: 1200, // Pause without signing before auto-speaking the accumulated phrase

  // Confidence thresholds
  CONFIDENCE_THRESHOLD: 0.70, // Minimum confidence to accept a sign as confirmed
  CANDIDATE_THRESHOLD: 0.50, // Minimum confidence to display as subtle candidate preview
  MIN_MARGIN_THRESHOLD: 0.12, // Minimum margin between top-1 and top-2 candidates to reject ambiguous ambiguity

  // Temporal stabilization tuning
  TEMPORAL_WINDOW_MS: 350, // Sliding window for time-decayed consensus
  GESTURE_REARM_MS: 250, // Retraction / rest duration required before re-arming the exact same sign

  // Frame processing
  TARGET_FPS: 25, // Throttling interval ~40ms between sent WebSocket frames
};
