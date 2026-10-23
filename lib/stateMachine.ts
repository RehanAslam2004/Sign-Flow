/**
 * SignFlow Recognition State Machine v3
 *
 * Enhanced with:
 * 1. Time-decayed sliding window consensus (350ms timestamp-based window, FPS-independent).
 * 2. Exponential recency weighting: w_i = exp(-3 * dt / window) * confidence.
 * 3. Confidence margin hysteresis: P_top1 - P_top2 >= 0.12 to eliminate ambiguous flickering.
 * 4. Gesture Lifecycle State Machine (IDLE -> TRACKING -> COMMITTED_HOLD -> RETRACTING).
 * 5. Instant transition between distinct signs; distinct re-arming for repeated same sign.
 * 6. Semantic boundary auto-flush on conversational category transitions.
 * 7. Live diagnostics telemetry snapshot for developer mode.
 */

import { PredictionEvent } from '@/types/contract';
import { CONFIG } from './config';
import { getSignCategory, isBoundaryTransition, SignCategory } from './signSemantics';

export interface StateMachineCallbacks {
  onCandidatePreview: (sign: string | null, confidence: number, sessionId?: string) => void;
  onSignConfirmed: (sign: string, sessionId?: string) => void;
  onUtteranceComplete: (utterance: string, rawTokens: string[], sessionId?: string) => void;
  onStatusChange: (statusText: string, sessionId?: string) => void;
}

export type GestureLifecycleState =
  | 'idle'           // No active hand or resting
  | 'tracking'       // Accumulating stability evidence on a candidate sign
  | 'committed_hold' // Sign confirmed and being held; duplicate commits suppressed
  | 'retracting';    // Hand relaxing or in transit; re-arming same sign

export interface TemporalVoteEntry {
  sign: string;
  confidence: number;
  margin: number;
  timestamp: number;
}

export interface DiagnosticsSnapshot {
  lifecycleState: GestureLifecycleState;
  currentCandidate: string | null;
  candidateElapsedMs: number;
  requiredStabilityMs: number;
  consensusSign: string | null;
  consensusRatio: number;
  temporalBufferSize: number;
  rejectionReason: string | null;
  lastCommittedSign: string | null;
  effectiveFps: number;
  activeLanguage: string;
}

const HIGH_CONFIDENCE_BYPASS = 0.90;
const HIGH_MARGIN_BYPASS = 0.25;

export class RecognitionStateMachine {
  private callbacks: StateMachineCallbacks;
  private sessionId: string | null = null;

  // Lifecycle state
  private lifecycleState: GestureLifecycleState = 'idle';

  // Candidate tracking
  private currentCandidate: string | null = null;
  private candidateStartTime = 0;

  // Time-decayed temporal vote buffer
  private voteBuffer: TemporalVoteEntry[] = [];

  // Deduplication & re-arming state
  private lastCommittedSign: string | null = null;
  private lastCommittedCategory: SignCategory = 'unknown';
  private lastHandSeenTime = 0;
  private restStartTime = 0;

  // Utterance buffer
  private activeWords: string[] = [];
  private activeConfidences: number[] = [];
  private utteranceTimer: NodeJS.Timeout | null = null;

  // Diagnostics & telemetry tracking
  private lastPredictionTime = 0;
  private frameIntervals: number[] = [];
  private currentRejectionReason: string | null = null;
  private lastConsensusSign: string | null = null;
  private lastConsensusRatio = 0.0;
  private activeLanguage = 'psl_extended';

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

  // -------------------------------------------------------------------------
  // Adaptive Stability Window
  // -------------------------------------------------------------------------

  private getAdaptiveStabilityMs(confidence: number, margin: number): number {
    // High confidence + high separation -> fast confirmation (350ms)
    if (confidence >= 0.90 && margin >= 0.30) return 350;
    if (confidence >= 0.85 && margin >= 0.20) return 450;
    if (confidence >= 0.75 && margin >= 0.15) return 550;
    return 750;
  }

  // -------------------------------------------------------------------------
  // Time-Decayed Weighted Vote Consensus
  // -------------------------------------------------------------------------

  /**
   * Cleans entries older than TEMPORAL_WINDOW_MS and calculates
   * exponentially decayed vote consensus weighted by recency and confidence.
   */
  private evaluateTemporalConsensus(now: number): { bestSign: string | null; ratio: number; avgConf: number } {
    // 1. Prune expired entries
    const cutoff = now - CONFIG.TEMPORAL_WINDOW_MS;
    this.voteBuffer = this.voteBuffer.filter((e) => e.timestamp >= cutoff);

    if (this.voteBuffer.length === 0) {
      return { bestSign: null, ratio: 0, avgConf: 0 };
    }

    // 2. Exponential time decay: w_i = exp(-3 * dt / window) * confidence
    const windowMs = CONFIG.TEMPORAL_WINDOW_MS;
    const voteTotals = new Map<string, { weightedSum: number; totalConf: number; count: number }>();
    let totalWeight = 0;

    for (const entry of this.voteBuffer) {
      const dt = Math.max(0, now - entry.timestamp);
      const recencyWeight = Math.exp((-3 * dt) / windowMs);
      const weight = recencyWeight * entry.confidence;
      totalWeight += weight;

      const existing = voteTotals.get(entry.sign) || { weightedSum: 0, totalConf: 0, count: 0 };
      existing.weightedSum += weight;
      existing.totalConf += entry.confidence;
      existing.count += 1;
      voteTotals.set(entry.sign, existing);
    }

    let bestSign: string | null = null;
    let maxWeight = 0;
    let bestAvgConf = 0;

    voteTotals.forEach((data, sign) => {
      if (data.weightedSum > maxWeight) {
        maxWeight = data.weightedSum;
        bestSign = sign;
        bestAvgConf = data.totalConf / data.count;
      }
    });

    const ratio = totalWeight > 0 ? maxWeight / totalWeight : 0;
    return { bestSign, ratio, avgConf: bestAvgConf };
  }

  // -------------------------------------------------------------------------
  // Core Prediction Processing Loop
  // -------------------------------------------------------------------------

  public processPrediction(event: PredictionEvent) {
    // 0. Drop stale or mismatched session predictions
    if (this.sessionId && event.session_id && event.session_id !== this.sessionId) {
      return;
    }

    const eventTime = event.timestamp || Date.now();
    const now = (event.timestamp && event.timestamp > this.lastPredictionTime)
      ? event.timestamp
      : Math.max(eventTime, Date.now());
    const currentSess = this.sessionId || event.session_id || '';

    // Track FPS metrics
    if (this.lastPredictionTime > 0) {
      const dt = now - this.lastPredictionTime;
      this.frameIntervals.push(dt);
      if (this.frameIntervals.length > 20) this.frameIntervals.shift();
    }
    this.lastPredictionTime = now;
    if (event.language) this.activeLanguage = String(event.language);

    // 1. Handle No Hands / Inactivity
    if (event.status === 'no_hands') {
      this.lifecycleState = 'idle';
      this.currentCandidate = null;
      this.currentRejectionReason = 'no_hands';
      this.callbacks.onCandidatePreview(null, 0, currentSess);

      // Inactivity timeout: reset deduplication lock
      if (now - this.lastHandSeenTime > CONFIG.GESTURE_RESET_TIMEOUT_MS) {
        this.lastCommittedSign = null;
        this.voteBuffer = [];
      }
      return;
    }

    this.lastHandSeenTime = now;

    // 2. Handle Uncertain or Unrecognized Sign
    if (event.status === 'uncertain' || !event.sign) {
      this.currentCandidate = null;
      this.currentRejectionReason = event.rejection_reason || 'uncertain_prediction';
      this.callbacks.onCandidatePreview(null, 0, currentSess);

      // If hand enters rest posture / uncertainty, count toward re-arming the previous sign
      if (this.restStartTime === 0) this.restStartTime = now;
      if (now - this.restStartTime >= CONFIG.GESTURE_REARM_MS) {
        if (this.lifecycleState === 'committed_hold') {
          this.lifecycleState = 'retracting';
        }
        this.lastCommittedSign = null; // Re-armed!
      }
      return;
    }

    // Valid hand with non-empty sign prediction
    this.restStartTime = 0;
    const detectedSign = event.sign;
    const confidence = event.confidence;
    const margin = event.margin !== undefined ? event.margin : 0.20;

    // Reject weak candidates
    if (confidence < CONFIG.CANDIDATE_THRESHOLD) {
      this.currentRejectionReason = 'low_confidence';
      return;
    }

    // Reject ambiguous margin if top 2 are too close
    if (margin < CONFIG.MIN_MARGIN_THRESHOLD && confidence < HIGH_CONFIDENCE_BYPASS) {
      this.currentRejectionReason = 'ambiguous_margin';
      this.callbacks.onCandidatePreview(detectedSign, confidence, currentSess);
      this.callbacks.onStatusChange(`Ambiguous sign: ${detectedSign} (margin: ${margin.toFixed(2)})`, currentSess);
      return;
    }

    // 3. Update Temporal Vote Buffer
    this.voteBuffer.push({
      sign: detectedSign,
      confidence,
      margin,
      timestamp: now,
    });

    const { bestSign, ratio, avgConf } = this.evaluateTemporalConsensus(now);
    this.lastConsensusSign = bestSign;
    this.lastConsensusRatio = ratio;

    // 4. Candidate Preview
    this.callbacks.onCandidatePreview(detectedSign, confidence, currentSess);

    // 5. Deduplication check: continuing to hold the already committed sign
    if (this.lastCommittedSign === detectedSign) {
      this.lifecycleState = 'committed_hold';
      this.currentRejectionReason = 'duplicate_hold_locked';
      return;
    }

    // 6. High-confidence fast bypass
    const isHighConfidenceBypass =
      confidence >= HIGH_CONFIDENCE_BYPASS && margin >= HIGH_MARGIN_BYPASS;

    // 7. Transition handling
    if (this.currentCandidate !== detectedSign) {
      // New candidate starts stability window
      this.currentCandidate = detectedSign;
      this.candidateStartTime = now;
      this.lifecycleState = 'tracking';
      this.currentRejectionReason = 'accumulating_stability';
      this.callbacks.onStatusChange(`Recognizing: ${detectedSign}...`, currentSess);
      return;
    }

    // 7. Same candidate: check temporal stability requirement
    const heldDuration = now - this.candidateStartTime;
    const requiredStability = this.getAdaptiveStabilityMs(confidence, margin);

    if (heldDuration >= requiredStability && confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
      // Require consensus agreement unless high-confidence bypass
      if (bestSign !== detectedSign && !isHighConfidenceBypass) {
        this.currentRejectionReason = 'temporal_consensus_waiting';
        return;
      }

      // Check deduplication lock: are we holding the sign we just committed?
      if (this.lastCommittedSign === detectedSign) {
        this.lifecycleState = 'committed_hold';
        this.currentRejectionReason = 'duplicate_hold_locked';
        return;
      }

      // Valid new confirmed sign!
      this.commitSign(detectedSign, confidence);
    } else {
      this.currentRejectionReason = `stabilizing (${heldDuration}ms / ${requiredStability}ms)`;
    }
  }

  // -------------------------------------------------------------------------
  // Sign Commitment with Semantic Boundary Detection
  // -------------------------------------------------------------------------

  private commitSign(sign: string, confidence: number) {
    console.log(`[StateMachine v3] Confirmed sign: ${sign} (conf: ${confidence.toFixed(3)})`);
    const currentSess = this.sessionId || '';

    // Semantic boundary detection: check if we need to flush before committing
    const newCategory = getSignCategory(sign);
    if (
      this.activeWords.length > 0 &&
      this.lastCommittedCategory !== 'unknown' &&
      isBoundaryTransition(this.lastCommittedCategory, newCategory)
    ) {
      console.log(`[StateMachine v3] Boundary transition: ${this.lastCommittedCategory} → ${newCategory}, auto-flushing`);
      this.finishUtterance();
    }

    this.lastCommittedSign = sign;
    this.lastCommittedCategory = newCategory;
    this.lifecycleState = 'committed_hold';
    this.currentCandidate = null;
    this.currentRejectionReason = null;
    this.voteBuffer = [];

    // Add to active utterance buffer
    this.activeWords.push(sign);
    this.activeConfidences.push(confidence);
    this.callbacks.onSignConfirmed(sign, currentSess);
    this.callbacks.onStatusChange(`Confirmed: ${sign}`, currentSess);

    // Reset and restart utterance idle pause timer
    if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
    this.utteranceTimer = setTimeout(() => {
      this.finishUtterance();
    }, CONFIG.UTTERANCE_PAUSE_MS);
  }

  // -------------------------------------------------------------------------
  // Utterance Formatting & Completion
  // -------------------------------------------------------------------------

  private formatUtterance(tokens: string[]): string {
    if (tokens.length === 0) return '';
    let result = '';
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.length === 1) {
        result += token;
      } else {
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
    const rawTokens = [...this.activeWords];
    const currentSess = this.sessionId || '';

    this.activeWords = [];
    this.activeConfidences = [];
    this.lastCommittedCategory = 'unknown';

    this.callbacks.onUtteranceComplete(phrase, rawTokens, currentSess);
    this.callbacks.onStatusChange('Ready to sign', currentSess);
  }

  // -------------------------------------------------------------------------
  // Telemetry & Diagnostics API
  // -------------------------------------------------------------------------

  public getDiagnosticsSnapshot(): DiagnosticsSnapshot {
    const now = Date.now();
    const candidateElapsed = this.currentCandidate && this.candidateStartTime > 0
      ? now - this.candidateStartTime
      : 0;

    let fps = 0;
    if (this.frameIntervals.length > 0) {
      const avgInterval = this.frameIntervals.reduce((a, b) => a + b, 0) / this.frameIntervals.length;
      fps = avgInterval > 0 ? Math.round(1000 / avgInterval) : 0;
    }

    return {
      lifecycleState: this.lifecycleState,
      currentCandidate: this.currentCandidate,
      candidateElapsedMs: candidateElapsed,
      requiredStabilityMs: 500,
      consensusSign: this.lastConsensusSign,
      consensusRatio: Math.round(this.lastConsensusRatio * 100) / 100,
      temporalBufferSize: this.voteBuffer.length,
      rejectionReason: this.currentRejectionReason,
      lastCommittedSign: this.lastCommittedSign,
      effectiveFps: fps,
      activeLanguage: this.activeLanguage,
    };
  }

  public getActiveTokens(): string[] {
    return [...this.activeWords];
  }

  public getActiveConfidences(): number[] {
    return [...this.activeConfidences];
  }

  public reset(newSessionId?: string | null) {
    if (this.utteranceTimer) {
      clearTimeout(this.utteranceTimer);
      this.utteranceTimer = null;
    }
    this.lifecycleState = 'idle';
    this.currentCandidate = null;
    this.candidateStartTime = 0;
    this.lastCommittedSign = null;
    this.lastCommittedCategory = 'unknown';
    this.lastHandSeenTime = 0;
    this.restStartTime = 0;
    this.activeWords = [];
    this.activeConfidences = [];
    this.voteBuffer = [];
    this.currentRejectionReason = null;
    this.lastConsensusSign = null;
    this.lastConsensusRatio = 0.0;
    this.frameIntervals = [];

    if (newSessionId !== undefined) {
      this.sessionId = newSessionId;
    }

    const currentSess = this.sessionId || '';
    this.callbacks.onCandidatePreview(null, 0, currentSess);
    this.callbacks.onStatusChange('Ready', currentSess);
  }
}
