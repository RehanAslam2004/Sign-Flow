/**
 * SignFlow Asynchronous Translation Client
 *
 * Implements Step 4: AI Translation (LLM Engine)
 * Triggers asynchronous HTTP POST requests to /api/translate,
 * caches recent translations to prevent redundant upstream queries,
 * and handles cancellation of in-flight requests.
 */

import { TranslateResponse } from '@/app/api/translate/route';

interface TranslateOptions {
  language?: string;
  previousContext?: string;
  sessionId?: string;
}

class TranslationClient {
  private activeController: AbortController | null = null;
  private cache: Map<string, TranslateResponse> = new Map();
  private maxCacheSize = 50;

  /**
   * Translates a sequence of recognized gesture tokens into a fluid natural sentence.
   */
  async translateTokens(
    tokens: string[],
    options?: TranslateOptions
  ): Promise<TranslateResponse | null> {
    if (!tokens || tokens.length === 0) {
      return null;
    }

    const cleanTokens = tokens.map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (cleanTokens.length === 0) {
      return null;
    }

    const cacheKey = `${options?.sessionId || ''}:${options?.language || 'asl'}:${cleanTokens.join('|')}:${options?.previousContext || ''}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Cancel any previous in-flight translation request
    if (this.activeController) {
      this.activeController.abort();
    }
    this.activeController = new AbortController();

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: cleanTokens,
          language: options?.language || 'asl',
          previousContext: options?.previousContext,
          sessionId: options?.sessionId,
        }),
        signal: this.activeController.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from /api/translate`);
      }

      const data: TranslateResponse = await res.json();

      // Update cache
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, data);

      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Aborted cleanly for newer token sequence
        return null;
      }
      console.warn('[translationClient] Translation request failed:', err);
      return null;
    } finally {
      this.activeController = null;
    }
  }

  /**
   * Clears in-flight requests and translation cache on session reset/end.
   */
  clear() {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
    this.cache.clear();
  }
}

export const translationClient = new TranslationClient();
