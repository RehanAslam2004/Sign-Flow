'use client';

import React from 'react';
import { Activity, X, Flag, Zap, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DiagnosticsSnapshot } from '@/lib/stateMachine';
import { PredictionCandidate, SignLanguageMode } from '@/types/contract';

interface RecognitionDiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: DiagnosticsSnapshot | null;
  handsDetected: boolean;
  handedness?: string;
  handsCount?: number;
  topCandidates?: PredictionCandidate[];
  rawPrediction?: string | null;
  rawConfidence?: number;
  rawMargin?: number;
  selectedLanguage: SignLanguageMode;
  onFlagSample: () => void;
}

export default function RecognitionDiagnostics({
  isOpen,
  onClose,
  snapshot,
  handsDetected,
  handedness = 'Right',
  handsCount = 0,
  topCandidates = [],
  rawPrediction,
  rawConfidence = 0,
  rawMargin = 0,
  selectedLanguage,
  onFlagSample,
}: RecognitionDiagnosticsProps) {
  if (!isOpen) return null;

  const lifecycle = snapshot?.lifecycleState || (handsDetected ? 'tracking' : 'idle');
  const fps = snapshot?.effectiveFps || 0;
  const rejectionReason = snapshot?.rejectionReason;

  const getLifecycleColor = (state: string) => {
    switch (state) {
      case 'committed_hold':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'tracking':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'retracting':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-600/40';
    }
  };

  return (
    <aside
      className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-slate-900/95 text-slate-100 rounded-2xl border border-slate-700/80 shadow-2xl backdrop-blur-md overflow-hidden text-xs animate-in slide-in-from-bottom-5 duration-200"
      aria-label="Recognition developer diagnostics"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#068D9D] animate-pulse" aria-hidden="true" />
          <span className="font-bold tracking-wide uppercase text-[11px] text-slate-200">
            Recognition Diagnostics
          </span>
          <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-[10px] text-slate-400 font-mono">
            DEV
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onFlagSample}
            title="Flag current prediction as failure sample"
            className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-1 text-[10px] font-semibold"
          >
            <Flag className="w-3 h-3" />
            <span>Flag</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close diagnostics"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3.5 max-h-[420px] overflow-y-auto">
        {/* Row 1: Pipeline & Tracking Status */}
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block font-medium">Hands</span>
            <span className="font-bold text-slate-200">
              {handsDetected ? `${handsCount || 1} (${handedness})` : '0 (None)'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block font-medium">FPS</span>
            <span className="font-bold text-slate-200 font-mono">
              {fps > 0 ? `${fps} fps` : '~25 fps'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block font-medium">Model</span>
            <span className="font-bold text-[#068D9D] uppercase text-[10px] truncate block">
              {selectedLanguage}
            </span>
          </div>
        </div>

        {/* Row 2: Lifecycle State & Consensus */}
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Lifecycle:</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold capitalize ${getLifecycleColor(lifecycle)}`}>
              {lifecycle.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Consensus (350ms):</span>
            <span className="font-mono font-bold text-slate-200">
              {snapshot?.consensusSign || 'None'} ({Math.round((snapshot?.consensusRatio || 0) * 100)}%)
            </span>
          </div>
          {rejectionReason && (
            <div className="pt-1 border-t border-slate-700/50 flex items-center gap-1.5 text-amber-300/90 text-[10px]">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="font-mono">Filter: {rejectionReason}</span>
            </div>
          )}
        </div>

        {/* Row 3: Top-3 Probability Distribution & Margin */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Probability Distribution</span>
            <span className="font-mono text-slate-300">
              Margin: {rawMargin > 0 ? `+${rawMargin.toFixed(2)}` : '0.00'}
            </span>
          </div>

          {topCandidates.length > 0 ? (
            <div className="space-y-1.5">
              {topCandidates.slice(0, 3).map((c, i) => (
                <div key={c.sign} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium text-slate-200">
                      {i + 1}. {c.sign}
                    </span>
                    <span className="font-mono text-slate-400">
                      {Math.round(c.confidence * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        i === 0 ? 'bg-[#068D9D]' : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.round(c.confidence * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : rawPrediction ? (
            <div className="p-2 rounded-lg bg-slate-800/40 text-slate-300">
              <span>{rawPrediction}</span> ({Math.round(rawConfidence * 100)}%)
            </div>
          ) : (
            <p className="text-slate-500 italic text-[11px]">Waiting for hand landmarks...</p>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span>Press Shift+D to toggle HUD</span>
          <span>SignFlow Diagnostics v1.2</span>
        </div>
      </div>
    </aside>
  );
}
