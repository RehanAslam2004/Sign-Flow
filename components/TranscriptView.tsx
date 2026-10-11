'use client';

import React, { useState } from 'react';
import { Volume2, Copy, Check, MessageSquare } from 'lucide-react';
import { ConversationMessage } from '@/types/app';
import { speechEngine } from '@/lib/speech';

interface TranscriptViewProps {
  messages: ConversationMessage[];
  onReplay?: (text: string) => void;
}

export default function TranscriptView({ messages, onReplay }: TranscriptViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string) => {
    if (onReplay) {
      onReplay(text);
    } else {
      speechEngine.speak(text);
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
            Signs recognized by the camera will accumulate into phrases, be spoken aloud, and stay readable here.
          </p>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[340px] sm:max-h-[380px]"
          aria-live="polite"
          aria-atomic="false"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 shadow-xs flex items-start justify-between gap-3 group hover:border-[#53599A]/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-slate-900 tracking-wide mb-1 break-words">
                  {msg.text}
                </p>
                <span className="text-[11px] font-medium text-slate-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleSpeak(msg.text)}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-600 hover:text-[#068D9D] hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-[#068D9D] transition-colors flex items-center justify-center"
                  aria-label={`Replay audio for: ${msg.text}`}
                  title="Replay audio"
                >
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  onClick={() => handleCopy(msg.id, msg.text)}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 focus-visible:ring-2 focus-visible:ring-[#068D9D] transition-colors flex items-center justify-center"
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
          ))}
        </div>
      )}
    </section>
  );
}
