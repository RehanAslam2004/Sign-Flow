'use client';

import React, { useState } from 'react';
import { Volume2, Sparkles, Copy, Check, ArrowRight, Activity } from 'lucide-react';
import { formatSignDisplay } from '@/lib/urduMapping';

interface ContextualTranslationBlockProps {
  synthesizedSentence: string | null;
  candidateSign: string | null;
  activeUtterance: string[];
  isAiSynthesized: boolean;
  modelName: string;
  isTranslating: boolean;
  onSpeak: (text: string) => void;
  onClear?: () => void;
  handsDetected: boolean;
}

export default function ContextualTranslationBlock({
  synthesizedSentence,
  candidateSign,
  activeUtterance,
  isAiSynthesized,
  modelName,
  isTranslating,
  onSpeak,
  handsDetected,
}: ContextualTranslationBlockProps) {
  const [copied, setCopied] = useState(false);

  // Determine current active tokens
  const tokens = activeUtterance.length > 0
    ? activeUtterance
    : candidateSign
    ? [candidateSign]
    : [];

  const displayText = synthesizedSentence || (tokens.length > 0 ? tokens.join(' ') : null);

  const handleCopy = () => {
    if (!displayText) return;
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 transition-all"
      aria-live="polite"
    >
      {/* Header bar: Status + AI Model Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#068D9D]">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
              Live AI Translation
            </span>
            <span className="hidden sm:inline-block ml-1.5 text-[10px] text-slate-400 font-medium">
              (Contextual Grammar)
            </span>
          </div>
        </div>

        {/* Dynamic Model Engine Pill */}
        <div className="flex items-center gap-1.5">
          {isTranslating && (
            <span className="flex items-center gap-1 text-[10px] text-[#068D9D] font-semibold animate-pulse">
              <Activity className="w-3 h-3 animate-spin" />
              <span>Synthesizing...</span>
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
              isAiSynthesized
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAiSynthesized ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              aria-hidden="true"
            />
            <span>{isAiSynthesized ? modelName : 'Edge AI Engine'}</span>
          </span>
        </div>
      </div>

      {/* Main Translation Sentence Box */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200/70 min-h-[76px] flex flex-col justify-center">
        {displayText ? (
          <div className="space-y-1">
            <p className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug break-words">
              &ldquo;{displayText}&rdquo;
            </p>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed italic">
            {handsDetected
              ? 'Hands detected — perform an ASL sign to begin live translation...'
              : 'Position hands in front of the camera to start signing...'}
          </p>
        )}
      </div>

      {/* Token Trail & Active Actions Row */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        {/* Token Trail Badges */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Tokens:
          </span>
          {tokens.length > 0 ? (
            tokens.map((tok, idx) => (
              <React.Fragment key={`${tok}-${idx}`}>
                {idx > 0 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-[#068D9D] border border-teal-200/80">
                  {formatSignDisplay(tok)}
                </span>
              </React.Fragment>
            ))
          ) : (
            <span className="text-[11px] text-slate-400 font-mono">None</span>
          )}
        </div>

        {/* Action Buttons: Audio Speak & Copy */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {displayText && (
            <>
              <button
                type="button"
                onClick={() => onSpeak(displayText)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D]"
                title="Speak translated sentence"
                aria-label="Speak translated sentence"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#068D9D]" aria-hidden="true" />
                <span className="hidden sm:inline">Speak</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D]"
                title="Copy translated text"
                aria-label="Copy translated text"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-700 text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
