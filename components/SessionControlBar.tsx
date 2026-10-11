'use client';

import React, { useState } from 'react';
import { SwitchCamera, Square, RotateCcw, ArrowLeft } from 'lucide-react';

interface SessionControlBarProps {
  onSwitchCamera: () => void;
  onEndSession: () => void;
  onClearTranscript: () => void;
  onChangeMode: () => void;
  hasMessages: boolean;
}

export default function SessionControlBar({
  onSwitchCamera,
  onEndSession,
  onClearTranscript,
  onChangeMode,
  hasMessages,
}: SessionControlBarProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearClick = () => {
    if (hasMessages) {
      setShowClearConfirm(true);
    } else {
      onClearTranscript();
    }
  };

  const confirmClear = () => {
    onClearTranscript();
    setShowClearConfirm(false);
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm text-xs"
      aria-label="Session controls"
    >
      {/* Primary Actions Group */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          onClick={onSwitchCamera}
          className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors font-semibold focus-visible:ring-2 focus-visible:ring-[#068D9D]"
          title="Switch front or rear camera"
          aria-label="Switch camera"
        >
          <SwitchCamera className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
          <span>Flip Camera</span>
        </button>

        {showClearConfirm ? (
          <div
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl animate-fadeIn"
            role="alert"
          >
            <span className="text-[11px] text-amber-900 font-semibold">Clear history?</span>
            <button
              onClick={confirmClear}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium text-xs transition-colors focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleClearClick}
            disabled={!hasMessages}
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors font-semibold focus-visible:ring-2 focus-visible:ring-[#068D9D] ${
              hasMessages
                ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                : 'text-slate-300 bg-slate-50 cursor-not-allowed'
            }`}
            title="Clear transcript history"
            aria-label="Clear conversation transcript"
          >
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Navigation & End Group */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          onClick={onEndSession}
          className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors font-semibold focus-visible:ring-2 focus-visible:ring-rose-500"
          title="End current translation session"
          aria-label="End session and stop camera"
        >
          <Square className="w-3.5 h-3.5 text-rose-600 fill-rose-600 shrink-0" aria-hidden="true" />
          <span>End Session</span>
        </button>

        <button
          onClick={onChangeMode}
          className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors font-semibold focus-visible:ring-2 focus-visible:ring-[#068D9D]"
          title="Change usage situation"
          aria-label="Change usage mode"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Mode</span>
        </button>
      </div>
    </nav>
  );
}
