/**
 * SignFlow Recognition State Machine & Utterance Accumulator
 * Implements stability checks, deduplication boundaries, and pause-based utterance building.
 */

import { PredictionEvent } from '@/types/contract';
import { CONFIG } from './config';

export interface StateMachineCallbacks {
  onCandidatePreview: (sign: string | null, confidence: number) => void;
  onSignConfirmed: (sign: string) => void;
  onUtteranceComplete: (utterance: string) => void;
  onStatusChange: (statusText: string) => void;
}

export class RecognitionStateMachine {
  private callbacks: StateMachineCallbacks;

  // Candidate tracking
  private currentCandidate: string | null = null;
  private candidateStartTime = 0;

  // Deduplication state
  private lastCommittedSign: string | null = null;
  private lastHandSeenTime = 0;

  // Utterance buffer
  private activeWords: string[] = [];
  private utteranceTimer: NodeJS.Timeout | null = null;

  constructor(callbacks: StateMachineCallbacks) {
    this.callbacks = callbacks;
  }

  public processPrediction(event: PredictionEvent) {
    const now = Date.now();

    // 1. Handle No Hands / Inactivity
    if (event.status === 'no_hands') {
      this.callbacks.onCandidatePreview(null, 0);

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
      this.callbacks.onCandidatePreview(null, 0);
      return;
    }

    const detectedSign = event.sign.toUpperCase();
    const confidence = event.confidence;

    // If confidence is below candidate threshold, ignore
    if (confidence < CONFIG.CANDIDATE_THRESHOLD) {
      return;
    }

    // 3. Candidate Preview
    this.callbacks.onCandidatePreview(detectedSign, confidence);

    // 4. Stability Check
    if (this.currentCandidate !== detectedSign) {
      // New candidate starts stability window
      this.currentCandidate = detectedSign;
      this.candidateStartTime = now;
      this.callbacks.onStatusChange(`Recognizing: ${detectedSign}...`);
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
    console.log(`[StateMachine] Confirmed PSL sign: ${sign}`);
    this.lastCommittedSign = sign;
    this.currentCandidate = null;

    // Add to active utterance buffer
    this.activeWords.push(sign);
    this.callbacks.onSignConfirmed(sign);
    this.callbacks.onStatusChange(`Confirmed: ${sign}`);

    // Reset and restart the utterance idle pause timer
    if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
    this.utteranceTimer = setTimeout(() => {
      this.finishUtterance();
    }, CONFIG.UTTERANCE_PAUSE_MS);
  }

  public finishUtterance() {
    if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
    if (this.activeWords.length === 0) return;

    const phrase = this.activeWords.join(' ');
    this.activeWords = [];
    this.callbacks.onUtteranceComplete(phrase);
    this.callbacks.onStatusChange('Ready to sign');
  }

  public reset() {
    if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
    this.currentCandidate = null;
    this.lastCommittedSign = null;
    this.activeWords = [];
    this.callbacks.onCandidatePreview(null, 0);
    this.callbacks.onStatusChange('Ready');
  }
}
