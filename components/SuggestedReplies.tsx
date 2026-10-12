'use client';

import React from 'react';
import { Sparkles, ArrowRight, Loader2, Info } from 'lucide-react';
import { SuggestedReply, UsageMode } from '@/types/app';

interface SuggestedRepliesProps {
  mode: UsageMode;
  suggestions: SuggestedReply[];
  isLoading: boolean;
  error: string | null;
  onSelectReply: (reply: SuggestedReply) => void;
  latestIncomingText?: string;
  activeReplyId?: string | null;
}

export default function SuggestedReplies({
  mode,
  suggestions,
  isLoading,
  error,
  onSelectReply,
  latestIncomingText,
  activeReplyId,
}: SuggestedRepliesProps) {
  // STRICT MODE GATING: Never display or render in 'signing' mode or when no mode is selected
  if (mode !== 'partner') {
    return null;
  }

  // Only display once an incoming message has arrived or is actively loading
  if (!latestIncomingText && !isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <section
      className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs transition-all"
      aria-label="Suggested sign replies"
    >
      {/* Section Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#53599A]">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <h3 className="font-extrabold">Suggested replies</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose a response, then learn how to sign it.
          </p>
        </div>

        {isLoading && (
          <div
            className="flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0 animate-pulse"
            aria-live="polite"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#068D9D]" aria-hidden="true" />
            <span className="hidden sm:inline">Finding useful replies…</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && suggestions.length === 0 && (
        <div className="py-4 text-center text-xs text-slate-500 font-medium">
          <p>Finding useful replies…</p>
        </div>
      )}

      {/* Error / Service Unavailable State */}
      {error && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span>Suggestions are temporarily unavailable. Translation continues normally.</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && suggestions.length === 0 && latestIncomingText && (
        <div className="py-3 text-center text-xs text-slate-500">
          <p>No suggested reply available for this message.</p>
        </div>
      )}

      {/* Available Suggestions List */}
      {!isLoading && suggestions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {suggestions.map((reply) => {
            const isActive = activeReplyId === reply.id;
            return (
              <button
                key={reply.id}
                onClick={() => onSelectReply(reply)}
                className={`min-h-[48px] p-3 rounded-xl border text-left transition-all group flex items-center justify-between gap-2.5 shadow-2xs hover:shadow-xs focus-visible:ring-2 focus-visible:ring-[#068D9D] ${
                  isActive
                    ? 'border-[#068D9D] bg-cyan-50/70 ring-1 ring-[#068D9D]/50'
                    : 'border-slate-200/90 hover:border-[#068D9D] bg-slate-50/60 hover:bg-white'
                }`}
                aria-label={`Suggested reply: ${reply.text}. ${
                  isActive ? 'Currently demonstrating in camera.' : 'Click to view ghost-hand guide in camera.'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs sm:text-sm font-bold block truncate ${
                        isActive ? 'text-[#068D9D]' : 'text-slate-800 group-hover:text-slate-900'
                      }`}
                    >
                      “{reply.text}”
                    </span>
                    {isActive && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-white bg-[#068D9D] px-1.5 py-0.5 rounded-full">
                        In Camera
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 capitalize block mt-0.5">
                    {reply.intent.replace('_', ' ')} • {reply.reference?.pslLabel || 'PSL'}
                  </span>
                </div>

                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#068D9D] text-white'
                      : 'bg-slate-100 group-hover:bg-cyan-50 text-slate-400 group-hover:text-[#068D9D]'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
