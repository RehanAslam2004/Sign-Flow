import React from 'react';
import { Eye, CheckCircle2 } from 'lucide-react';
import { formatSignDisplay } from '@/lib/urduMapping';
import { SignLanguageMode } from '@/types/contract';

interface RecognitionStatusProps {
  statusText: string;
  candidateSign: string | null;
  candidateConfidence: number;
  lastConfirmedSign: string | null;
  serviceStatus: 'connecting' | 'connected' | 'disconnected' | 'edge_active';
  selectedLanguage?: SignLanguageMode;
}

export default function RecognitionStatus({
  statusText,
  candidateSign,
  lastConfirmedSign,
  serviceStatus,
  selectedLanguage = 'psl_extended',
}: RecognitionStatusProps) {
  const isOnline = serviceStatus === 'connected' || serviceStatus === 'edge_active';

  const getLanguageLabel = () => {
    switch (selectedLanguage) {
      case 'unified':
        return 'Universal Sign & Gesture Interpretation';
      case 'psl_extended':
        return 'PSL Extended (89 Signs & Greetings)';
      case 'psl_words':
        return 'PSL Words (12 Signs)';
      case 'psl_alphabets':
        return 'PSL Urdu Alphabets (37 Letters)';
      case 'asl':
        return 'ASL Model (36 Signs)';
      default:
        return 'Universal Sign & Gesture Interpretation';
    }
  };

  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      {/* Service Connection & Current State Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isOnline
                ? 'bg-emerald-500 ring-2 ring-emerald-100'
                : serviceStatus === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500'
            }`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-slate-700">
            {serviceStatus === 'connected'
              ? `Backend connected (${getLanguageLabel()})`
              : serviceStatus === 'edge_active'
              ? `AI Ready (In-Browser • ${getLanguageLabel()})`
              : serviceStatus === 'connecting'
              ? 'Connecting to service...'
              : 'Service offline'}
          </span>
        </div>

        <span className="text-[11px] font-medium text-slate-600 bg-slate-100/90 border border-slate-200/60 px-2.5 py-1 rounded-md">
          {statusText}
        </span>
      </div>

      {/* Candidate Live Tracking Box */}
      {candidateSign && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50/70 border border-cyan-200/70 transition-all">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-[#068D9D] shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#068D9D]">Analyzing:</span>
            <span className="text-sm font-bold text-slate-900 tracking-wide truncate">
              {formatSignDisplay(candidateSign)}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 shrink-0">
            Hold steady to confirm
          </span>
        </div>
      )}

      {/* Last Confirmed Sign Badge */}
      {lastConfirmedSign && !candidateSign && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-emerald-200/70">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>
            Last recognized: <strong className="text-slate-900">{formatSignDisplay(lastConfirmedSign)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

