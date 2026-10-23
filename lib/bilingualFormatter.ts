/**
 * SignFlow Bilingual Sentence Formatter
 *
 * Takes grammar engine output and formats it for display and TTS,
 * producing a complete FormattedSentence with all layers needed
 * by the dual-layer transcript UI.
 */

import { buildSentence, SentenceResult } from './grammarEngine';
import { getSignSpokenText, formatSignDisplay } from './urduMapping';
import { SignLanguageMode } from '@/types/contract';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormattedSentence {
  /** Original recognized sign labels */
  rawTokens: string[];
  /** Arrow-separated display of raw tokens (e.g. "Assalamulaikum → Ap → Kesay") */
  rawDisplay: string;
  /** Generated Urdu sentence */
  urduSentence: string;
  /** Generated English sentence */
  englishSentence: string;
  /** Optimized text for TTS pronunciation */
  spokenText: string;
  /** Average confidence of the component signs (0–1) */
  confidence: number;
  /** True if a grammar rule matched, false if fallback was used */
  isPatternMatched: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the arrow-separated raw token display string.
 * Applies bilingual annotation for PSL signs (e.g. "السلام علیکم (Assalam-o-Alaikum)")
 */
function buildRawDisplay(tokens: string[]): string {
  return tokens.map((t) => formatSignDisplay(t)).join(' → ');
}

/**
 * Builds an optimized spoken text string for browser TTS.
 * Prefers English pronunciation for clarity in browser speech synthesis.
 */
function buildSpokenText(result: SentenceResult, language: SignLanguageMode): string {
  // Use the English sentence for TTS (browser voices handle English best)
  const english = result.english;
  if (english && english.trim().length > 0) {
    return english;
  }

  // Fallback: build spoken text from individual token pronunciations
  return result.rawTokens
    .map((t) => getSignSpokenText(t))
    .join(', ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Processes an array of confirmed sign tokens into a fully formatted
 * bilingual sentence ready for transcript display and TTS.
 *
 * @param tokens - Array of confirmed sign labels
 * @param language - Active sign language mode (affects output strategy)
 * @param confidences - Optional array of confidence values for each token
 * @returns Complete formatted sentence for UI consumption
 */
export function formatSentence(
  tokens: string[],
  language: SignLanguageMode,
  confidences?: number[]
): FormattedSentence {
  if (!tokens || tokens.length === 0) {
    return {
      rawTokens: [],
      rawDisplay: '',
      urduSentence: '',
      englishSentence: '',
      spokenText: '',
      confidence: 0,
      isPatternMatched: false,
    };
  }

  // Run grammar engine
  const result = buildSentence(tokens);

  // Calculate average confidence
  const avgConfidence = confidences && confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  // Build raw display
  const rawDisplay = buildRawDisplay(tokens);

  // Determine bilingual output based on language mode
  let urduSentence = result.urdu;
  let englishSentence = result.english;

  // For ASL mode, Urdu sentence is empty (English only)
  if (language === 'asl') {
    urduSentence = '';
  }

  // Build TTS text
  const spokenText = buildSpokenText(result, language);

  return {
    rawTokens: tokens,
    rawDisplay,
    urduSentence,
    englishSentence,
    spokenText,
    confidence: Math.round(avgConfidence * 100) / 100,
    isPatternMatched: result.isPatternMatched,
  };
}

/**
 * Formats a preview sentence for the "Current Translation" display
 * while tokens are still being accumulated.
 */
export function formatPreview(
  tokens: string[],
  language: SignLanguageMode
): { rawDisplay: string; previewUrdu: string; previewEnglish: string } {
  if (!tokens || tokens.length === 0) {
    return { rawDisplay: '', previewUrdu: '', previewEnglish: '' };
  }

  const result = buildSentence(tokens);

  return {
    rawDisplay: buildRawDisplay(tokens),
    previewUrdu: language === 'asl' ? '' : result.urdu,
    previewEnglish: result.english,
  };
}
