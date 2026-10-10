'use client';

import React from 'react';
import { Volume2, Copy, Check, MessageSquare } from 'lucide-react';
import { ConversationMessage } from '@/types/app';
import { speechEngine } from '@/lib/speech';

interface TranscriptViewProps {
  messages: ConversationMessage[];
  onReplay?: (text: string) => void;
}

export default function TranscriptView({ messages, onReplay }: TranscriptViewProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <MessageSquare className="w-3.5 h-3.5 text-[#53599A]" />
          <span>Conversation Transcript</span>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <p className="text-sm font-medium">No translated signs yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Signs recognized by the camera will appear here and remain visible for both conversation partners.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[360px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start justify-between gap-3 group hover:border-[#53599A]/40 transition-colors"
            >
              <div className="flex-1">
                <p className="text-base font-bold text-slate-900 tracking-wide mb-1">
                  {msg.text}
                </p>
                <span className="text-[11px] font-medium text-slate-400">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleSpeak(msg.text)}
                  className="p-2 rounded-lg text-slate-500 hover:text-[#068D9D] hover:bg-cyan-50 transition-colors"
                  title="Replay audio"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleCopy(msg.id, msg.text)}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Copy text"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
