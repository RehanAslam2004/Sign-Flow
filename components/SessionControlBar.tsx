'use client';

import React, { useState } from 'react';
import { SwitchCamera, Square, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';

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
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs">
      <div className="flex items-center gap-2">
        <button
          onClick={onSwitchCamera}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors font-medium"
        >
          <SwitchCamera className="w-3.5 h-3.5 text-slate-600" />
          <span>Flip Camera</span>
        </button>

        {showClearConfirm ? (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
            <span className="text-[11px] text-amber-800 font-medium">Clear transcript?</span>
            <button
              onClick={confirmClear}
              className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px]"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium text-[10px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleClearClick}
            disabled={!hasMessages}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
              hasMessages
                ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                : 'text-slate-300 bg-slate-50 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onEndSession}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-colors font-medium"
        >
          <Square className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
          <span>End Session</span>
        </button>

        <button
          onClick={onChangeMode}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Mode</span>
        </button>
      </div>
    </div>
  );
}
