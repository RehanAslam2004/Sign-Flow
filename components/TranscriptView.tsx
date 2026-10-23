'use client';

import React, { useState } from 'react';
import { Volume2, Copy, Check, MessageSquare, Sparkles, Layers } from 'lucide-react';
import { ConversationMessage } from '@/types/app';
import { speechEngine } from '@/lib/speech';

interface TranscriptViewProps {
  messages: ConversationMessage[];
  onReplay?: (text: string) => void;
}

export default function TranscriptView({ messages, onReplay }: TranscriptViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, msg: ConversationMessage) => {
    const textToCopy = msg.urduSentence
      ? `${msg.urduSentence}${msg.englishSentence ? `\n${msg.englishSentence}` : ''}`
      : msg.text;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (msg: ConversationMessage) => {
    // Prefer English translation for browser speech synthesis clarity
    const spoken = msg.englishSentence || msg.text;
    if (onReplay) {
      onReplay(spoken);
    } else {
      speechEngine.speak(spoken);
    }
  };

  return (
    <section className="flex flex-col h-full" aria-label="Conversation transcript">
      {/* Transcript Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
          <MessageSquare className="w-4 h-4 text-[#53599A]" aria-hidden="true" />
          <h2>Conversation Transcript</h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Transcript Messages List */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center text-slate-500">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5 text-slate-400">
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No translated signs yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Signs recognized by the camera will accumulate into complete sentences, be spoken aloud, and stay readable here.
          </p>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[340px] sm:max-h-[380px]"
          aria-live="polite"
          aria-atomic="false"
        >
          {messages.map((msg) => {
            const hasUrdu = Boolean(msg.urduSentence && msg.urduSentence.trim().length > 0);
            const hasRawDisplay = Boolean(msg.rawDisplay || (msg.rawTokens && msg.rawTokens.length > 0));
            const rawDisplayContent = msg.rawDisplay || (msg.rawTokens ? msg.rawTokens.join(' → ') : '');

            return (
              <div
                key={msg.id}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 shadow-xs flex flex-col gap-2.5 group hover:border-[#53599A]/50 transition-colors"
              >
                {/* Layer 1: Raw Tokens / Sign Sequence */}
                {hasRawDisplay && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium border-b border-slate-200/60 pb-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#53599A] shrink-0" aria-hidden="true" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Signs:</span>
                    <span className="truncate text-slate-600 font-mono text-[11px]">{rawDisplayContent}</span>
                  </div>
                )}

                {/* Layer 2: Natural Formatted Sentence (Bilingual Urdu + English) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    {hasUrdu ? (
                      <>
                        {/* Primary Urdu Sentence */}
                        <p
                          dir="rtl"
                          className="text-lg sm:text-xl font-bold text-slate-900 tracking-wide text-right font-serif leading-relaxed"
                        >
                          {msg.urduSentence}
                        </p>
                        {/* Secondary English Sentence */}
                        {msg.englishSentence && (
                          <p className="text-sm font-semibold text-slate-700 tracking-normal">
                            {msg.englishSentence}
                          </p>
                        )}
                      </>
                    ) : (
                      /* Monolingual / English / ASL Display */
                      <p className="text-base sm:text-lg font-bold text-slate-900 tracking-wide break-words">
                        {msg.englishSentence || msg.text}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleSpeak(msg)}
                      className="min-h-[40px] min-w-[40px] p-2 rounded-xl text-slate-600 hover:text-[#068D9D] hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-[#068D9D] transition-colors flex items-center justify-center"
                      aria-label={`Replay audio for: ${msg.englishSentence || msg.text}`}
                      title="Replay audio"
                    >
                      <Volume2 className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <button
                      onClick={() => handleCopy(msg.id, msg)}
                      className="min-h-[40px] min-w-[40px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 focus-visible:ring-2 focus-visible:ring-[#068D9D] transition-colors flex items-center justify-center"
                      aria-label={copiedId === msg.id ? "Copied text" : `Copy text: ${msg.text}`}
                      title="Copy text"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Copy className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Layer 3: Metadata Row (Grammar Badge, Confidence, Timestamp) */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {msg.isPatternMatched && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-[#068D9D] font-semibold text-[10px] border border-teal-200/50">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        Smart Grammar
                      </span>
                    )}
                    {msg.averageConfidence !== undefined && msg.averageConfidence > 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {Math.round(msg.averageConfidence * 100)}% conf
                      </span>
                    )}
                  </div>

                  <span className="font-medium text-slate-400 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
