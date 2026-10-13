/**
 * SignFlow Browser Speech Synthesis Engine
 * Wraps window.speechSynthesis with voice selection, session isolation, and error fallbacks
 */

export class SpeechEngine {
  private isAvailable: boolean;
  private activeSessionId: string | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public setActiveSessionId(sessionId: string | null) {
    this.activeSessionId = sessionId;
  }

  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  public speak(text: string, sessionId?: string, onEnd?: () => void): boolean {
    if (!this.isAvailable || !text.trim()) {
      onEnd?.();
      return false;
    }

    // Session isolation guard: if session ID provided and doesn't match active session, reject
    if (sessionId && this.activeSessionId && sessionId !== this.activeSessionId) {
      console.warn(`[SpeechEngine] Suppressed speech for stale session ${sessionId} (active: ${this.activeSessionId})`);
      return false;
    }

    try {
      // Cancel ongoing speech to prevent overlapping audio
      this.cancel();

      const targetSession = sessionId || this.activeSessionId;

      // Format words (e.g. "HELLO HELP" -> "Hello, Help.")
      const formatted = text
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(', ') + '.';

      const utterance = new SpeechSynthesisUtterance(formatted);
      this.currentUtterance = utterance;
      utterance.rate = 0.95; // slightly slower for clear, calm pronunciation
      utterance.pitch = 1.0;

      // Select available voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google'))
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        // Only trigger onEnd if still in the same active session
        if (!targetSession || targetSession === this.activeSessionId) {
          onEnd?.();
        }
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
      };

      utterance.onerror = (e) => {
        if (!targetSession || targetSession === this.activeSessionId) {
          onEnd?.();
        }
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('Speech playback failed:', err);
      onEnd?.();
      return false;
    }
  }

  public cancel() {
    if (this.currentUtterance) {
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
      this.currentUtterance = null;
    }
    if (this.isAvailable) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechEngine = new SpeechEngine();
