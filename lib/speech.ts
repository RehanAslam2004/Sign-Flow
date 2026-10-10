/**
 * SignFlow Browser Speech Synthesis Engine
 * Wraps window.speechSynthesis with voice selection and error fallbacks
 */

export class SpeechEngine {
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public speak(text: string, onEnd?: () => void): boolean {
    if (!this.isAvailable || !text.trim()) {
      onEnd?.();
      return false;
    }

    try {
      // Cancel ongoing speech to prevent overlapping audio
      window.speechSynthesis.cancel();

      // Format words (e.g. "HELLO HELP" -> "Hello, Help.")
      const formatted = text
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(', ') + '.';

      const utterance = new SpeechSynthesisUtterance(formatted);
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
        onEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        onEnd?.();
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
    if (this.isAvailable) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechEngine = new SpeechEngine();
