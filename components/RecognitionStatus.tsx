'use client';

import React from 'react';
import { Sparkles, Eye, CheckCircle2, Hand } from 'lucide-react';

interface RecognitionStatusProps {
  statusText: string;
  candidateSign: string | null;
  candidateConfidence: number;
  lastConfirmedSign: string | null;
  serviceStatus: 'connecting' | 'connected' | 'disconnected';
}

export default function RecognitionStatus({
  statusText,
  candidateSign,
  candidateConfidence,
  lastConfirmedSign,
  serviceStatus,
}: RecognitionStatusProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Service Connection & Current State Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              serviceStatus === 'connected'
                ? 'bg-emerald-500 ring-2 ring-emerald-200'
                : serviceStatus === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-xs font-semibold text-slate-700">
            {serviceStatus === 'connected'
              ? 'AI Engine Online'
              : serviceStatus === 'connecting'
              ? 'Connecting to AI Engine...'
              : 'AI Engine Offline'}
          </span>
        </div>

        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
          {statusText}
        </span>
      </div>

      {/* Candidate Live Preview Box */}
      {candidateSign && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50/80 border border-cyan-100 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#068D9D] animate-pulse" />
            <span className="text-xs font-semibold text-[#068D9D]">Tracking:</span>
            <span className="text-sm font-bold text-slate-900 tracking-wide">{candidateSign}</span>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {Math.round(candidateConfidence * 100)}% match
          </span>
        </div>
      )}

      {/* Last Confirmed Sign Badge */}
      {lastConfirmedSign && !candidateSign && (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Last detected: <strong>{lastConfirmedSign}</strong></span>
        </div>
      )}
    </div>
  );
}
