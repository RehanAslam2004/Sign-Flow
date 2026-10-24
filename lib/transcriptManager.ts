/**
 * SignFlow Two-Tier Transcript Reconciliation Manager
 *
 * Implements:
 * 1. Provisional live clause streaming (in-flight signing updates without flickering).
 * 2. Prefix-suffix overlap alignment to merge overlapping interpretation windows seamlessly without duplicate words.
 * 3. Out-of-order sequence ID and timestamp protection.
 * 4. Boundary pause and complete clause commitment into confirmed conversation history.
 * 5. Strict deduplication against repeated speech synthesis.
 */

import { PredictionEvent } from '@/types/contract';

export interface TranscriptCallbacks {
  onProvisionalUpdate: (provisionalText: string | null) => void;
  onSentenceConfirmed: (confirmedSentence: string, alternatives?: string[]) => void;
  onStatusChange?: (statusText: string) => void;
}

export class TranscriptManager {
  private callbacks: TranscriptCallbacks;
  private provisionalClause: string = '';
  private lastProcessedTimestamp: number = 0;
  private lastCommittedSentence: string | null = null;
  private boundaryPauseTimer: NodeJS.Timeout | null = null;
  private activeSessionId: string | null = null;

  constructor(callbacks: TranscriptCallbacks, sessionId?: string | null) {
    this.callbacks = callbacks;
    this.activeSessionId = sessionId || null;
  }

  public setSessionId(newSessionId: string | null) {
    this.reset();
    this.activeSessionId = newSessionId;
  }

  /**
   * Merges two overlapping word phrases by identifying the longest common
   * token suffix in existingText and token prefix in incomingText.
   */
  public static reconcileOverlap(existingText: string, incomingText: string): string {
    const existing = existingText.trim();
    const incoming = incomingText.trim();

    if (!existing) return incoming;
    if (!incoming) return existing;

    // Direct containment: if incoming already contains existing
    if (incoming.toLowerCase().includes(existing.toLowerCase())) {
      return incoming;
    }

    // If existing contains incoming, keep existing
    if (existing.toLowerCase().includes(incoming.toLowerCase())) {
      return existing;
    }

    const existWords = existing.split(/\s+/);
    const incWords = incoming.split(/\s+/);

    // Look for matching overlap of up to min(existWords.length, incWords.length) tokens
    const maxOverlap = Math.min(existWords.length, incWords.length);
    let bestOverlapLen = 0;

    for (let len = maxOverlap; len >= 1; len--) {
      const suffix = existWords.slice(existWords.length - len).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const prefix = incWords.slice(0, len).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (suffix.join(' ') === prefix.join(' ')) {
        bestOverlapLen = len;
        break;
      }
    }

    if (bestOverlapLen > 0) {
      // Append only the new tokens from incoming after the overlap
      const remainder = incWords.slice(bestOverlapLen).join(' ');
      return remainder ? `${existing} ${remainder}` : existing;
    }

    // No direct overlap found: join with space if distinct
    return `${existing} ${incoming}`;
  }

  /**
   * Processes a Gemini continuous ASL prediction event from the backend.
   */
  public processPrediction(event: PredictionEvent) {
    // Session isolation guard
    if (this.activeSessionId && event.session_id && event.session_id !== this.activeSessionId) {
      return;
    }

    // Ignore buffering heartbeats
    if (event.status === 'buffering') {
      return;
    }

    // Out-of-order response guard
    const eventTimestamp = event.end_timestamp_ms || event.timestamp;
    if (eventTimestamp < this.lastProcessedTimestamp) {
      console.warn(`[TranscriptManager] Dropped out-of-order prediction (${eventTimestamp} < ${this.lastProcessedTimestamp})`);
      return;
    }
    this.lastProcessedTimestamp = eventTimestamp;

    const text = (event.recognized_text || event.sign || '').trim();

    // If model returned uncertain or no recognized text
    if (event.status === 'uncertain' || !text) {
      if (event.uncertainty_reason) {
        const raw = event.uncertainty_reason.toLowerCase();
        let displayStatus = 'Ready to sign';
        if (raw.includes('503') || raw.includes('busy') || raw.includes('high demand') || raw.includes('unavailable')) {
          displayStatus = 'Cloud AI busy — retrying next window';
        } else if (raw.includes('429') || raw.includes('quota') || raw.includes('rate_limit')) {
          displayStatus = 'Rate limit reached — pausing briefly';
        } else if (raw.includes('timeout')) {
          displayStatus = 'Network timeout — retrying';
        } else if (raw.includes('static') || raw.includes('ambiguous') || raw.includes('trajectory') || raw.includes('lexical')) {
          displayStatus = 'Hold sign steady or start signing...';
        } else if (raw.includes('waiting') || raw.includes('analyzing') || raw.includes('retrying')) {
          displayStatus = event.uncertainty_reason;
        } else if (!raw.includes('{') && !raw.includes('error') && event.uncertainty_reason.length < 50) {
          displayStatus = event.uncertainty_reason;
        }
        this.callbacks.onStatusChange?.(displayStatus);
      }
      return;
    }

    if (event.status === 'partial') {
      // Merge into live provisional clause
      this.provisionalClause = TranscriptManager.reconcileOverlap(this.provisionalClause, text);
      this.callbacks.onProvisionalUpdate(this.provisionalClause);
      this.callbacks.onStatusChange?.(`Signing: ${this.provisionalClause}...`);

      // Arm boundary pause fallback (if hands pause for >1000ms after a partial)
      this.armBoundaryPauseCommit(1200);

    } else if (event.status === 'complete' || event.status === 'recognized') {
      // Complete thought recognized
      const fullText = TranscriptManager.reconcileOverlap(this.provisionalClause, text);
      this.commitSentence(fullText, event.alternatives);
    }
  }

  /**
   * Triggers boundary pause flush when hands drop or camera goes idle.
   */
  public handleBoundaryPause() {
    if (this.provisionalClause.trim().length > 0) {
      this.commitSentence(this.provisionalClause);
    }
  }

  private armBoundaryPauseCommit(delayMs: number) {
    if (this.boundaryPauseTimer) {
      clearTimeout(this.boundaryPauseTimer);
    }
    this.boundaryPauseTimer = setTimeout(() => {
      this.handleBoundaryPause();
    }, delayMs);
  }

  /**
   * Finalizes an active provisional clause into a confirmed, punctuated English sentence.
   */
  public commitSentence(rawText: string, alternatives?: string[]) {
    if (this.boundaryPauseTimer) {
      clearTimeout(this.boundaryPauseTimer);
      this.boundaryPauseTimer = null;
    }

    let text = rawText.trim();
    if (!text) return;

    // Capitalize first character
    text = text.charAt(0).toUpperCase() + text.slice(1);

    // Ensure terminal punctuation
    if (!/[.!?]$/.test(text)) {
      text += '.';
    }

    // Deduplication check against the immediate previous sentence
    if (this.lastCommittedSentence && this.lastCommittedSentence.toLowerCase() === text.toLowerCase()) {
      // Already committed, clear provisional
      this.provisionalClause = '';
      this.callbacks.onProvisionalUpdate(null);
      return;
    }

    this.lastCommittedSentence = text;
    this.provisionalClause = '';
    this.callbacks.onProvisionalUpdate(null);
    this.callbacks.onSentenceConfirmed(text, alternatives);
    this.callbacks.onStatusChange?.('Ready');
  }

  public getProvisionalClause(): string {
    return this.provisionalClause;
  }

  public reset() {
    if (this.boundaryPauseTimer) {
      clearTimeout(this.boundaryPauseTimer);
      this.boundaryPauseTimer = null;
    }
    this.provisionalClause = '';
    this.lastProcessedTimestamp = 0;
    this.lastCommittedSentence = null;
    this.callbacks.onProvisionalUpdate(null);
    this.callbacks.onStatusChange?.('Ready');
  }
}
