/**
 * SignFlow Recognition State Machine & Utterance Accumulator
 * Implements stability checks, deduplication boundaries, and pause-based utterance building.
 */

import { PredictionEvent } from '@/types/contract';
import { CONFIG } from './config';

export interface StateMachineCallbacks {
  onCandidatePreview: (sign: string | null, confidence: number, sessionId?: string) => void;
  onSignConfirmed: (sign: string, sessionId?: string) => void;
  onUtteranceComplete: (utterance: string, sessionId?: string) => void;
  onStatusChange: (statusText: string, sessionId?: string) => void;
}

export class RecognitionStateMachine {
  private callbacks: StateMachineCallbacks;
  private sessionId: string | null = null;

  // Candidate tracking
  private currentCandidate: string | null = null;
  private candidateStartTime = 0;

  // Deduplication state
  private lastCommittedSign: string | null = null;
  private lastHandSeenTime = 0;

  // Utterance buffer
  private activeWords: string[] = [];
  private utteranceTimer: NodeJS.Timeout | null = null;

  constructor(callbacks: StateMachineCallbacks, initialSessionId?: string) {
    this.callbacks = callbacks;
    this.sessionId = initialSessionId || null;
  }

  public setSessionId(newSessionId: string | null) {
    this.reset(newSessionId);
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public processPrediction(event: PredictionEvent) {
    // 0. Drop stale or mismatched session predictions
    if (this.sessionId && event.session_id && event.session_id !== this.sessionId) {
      return;
    }

    const now = Date.now();
    const currentSess = this.sessionId || event.session_id || '';

    // 1. Handle No Hands / Inactivity
    if (event.status === 'no_hands') {
      this.callbacks.onCandidatePreview(null, 0, currentSess);

      // If hands were missing for long enough, reset deduplication lock
      if (now - this.lastHandSeenTime > CONFIG.GESTURE_RESET_TIMEOUT_MS) {
        this.lastCommittedSign = null;
      }
      return;
    }

    this.lastHandSeenTime = now;

    // 2. Handle Uncertain or Unrecognized Sign
    if (event.status === 'uncertain' || !event.sign) {
      this.currentCandidate = null;
      this.callbacks.onCandidatePreview(null, 0, currentSess);
      return;
    }

    const detectedSign = event.sign.toUpperCase();
    const confidence = event.confidence;

    // If confidence is below candidate threshold, ignore
    if (confidence < CONFIG.CANDIDATE_THRESHOLD) {
      return;
    }

    // 3. Candidate Preview
    this.callbacks.onCandidatePreview(detectedSign, confidence, currentSess);

    // 4. Stability Check
    if (this.currentCandidate !== detectedSign) {
      // New candidate starts stability window
      this.currentCandidate = detectedSign;
      this.candidateStartTime = now;
      this.callbacks.onStatusChange(`Recognizing: ${detectedSign}...`, currentSess);
      return;
    }

    // Still same candidate: check duration
    const heldDuration = now - this.candidateStartTime;
    if (heldDuration >= CONFIG.STABILITY_WINDOW_MS && confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
      // Check deduplication boundary: is this the sign we just committed without resetting?
      if (this.lastCommittedSign === detectedSign) {
        // Holding same sign -> do not duplicate!
        return;
      }

      // Valid new confirmed sign!
      this.commitSign(detectedSign);
    }
  }

  private commitSign(sign: string) {
    console.log(`[StateMachine] Confirmed sign: ${sign}`);
    const currentSess = this.sessionId || '';
    this.lastCommittedSign = sign;
    this.currentCandidate = null;

    // Add to active utterance buffer
    this.activeWords.push(sign);
    this.callbacks.onSignConfirmed(sign, currentSess);
    this.callbacks.onStatusChange(`Confirmed: ${sign}`, currentSess);

    // Reset and restart the utterance idle pause timer
    if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
    this.utteranceTimer = setTimeout(() => {
      this.finishUtterance();
    }, CONFIG.UTTERANCE_PAUSE_MS);
  }

  private formatUtterance(tokens: string[]): string {
    if (tokens.length === 0) return '';
    let result = '';
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.length === 1) {
        // Individual fingerspelling letter/digit: concatenate into word
        result += token;
      } else {
        // Multi-letter word token: separate with space
        if (result.length > 0 && !result.endsWith(' ')) {
          result += ' ';
        }
        result += token;
      }
    }
    return result;
  }

  public finishUtterance() {
    if (this.utteranceTimer) {
      clearTimeout(this.utteranceTimer);
      this.utteranceTimer = null;
    }
    if (this.activeWords.length === 0) return;

    const phrase = this.formatUtterance(this.activeWords);
    const currentSess = this.sessionId || '';
    this.activeWords = [];
    this.callbacks.onUtteranceComplete(phrase, currentSess);
    this.callbacks.onStatusChange('Ready to sign', currentSess);
  }

  public reset(newSessionId?: string | null) {
    if (this.utteranceTimer) {
      clearTimeout(this.utteranceTimer);
      this.utteranceTimer = null;
    }
    this.currentCandidate = null;
    this.candidateStartTime = 0;
    this.lastCommittedSign = null;
    this.lastHandSeenTime = 0;
    this.activeWords = [];

    if (newSessionId !== undefined) {
      this.sessionId = newSessionId;
    }

    const currentSess = this.sessionId || '';
    this.callbacks.onCandidatePreview(null, 0, currentSess);
    this.callbacks.onStatusChange('Ready', currentSess);
  }
}
