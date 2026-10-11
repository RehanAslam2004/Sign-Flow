'use client';

import React, { useEffect, useRef } from 'react';
import { ArrowLeft, BookOpen, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SuggestedReply } from '@/types/app';

interface SignReferenceModalProps {
  reply: SuggestedReply | null;
  onClose: () => void;
}

export default function SignReferenceModal({
  reply,
  onClose,
}: SignReferenceModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!reply || !reply.reference) {
    return null;
  }

  const ref = reply.reference;
  const hasMedia = Boolean(ref.mediaUrl);
  const isPending = ref.validationStatus === 'pending_verification';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/90 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200"
      >
        {/* Header with Back Button */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 shadow-2xs transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D]"
            aria-label="Back to conversation"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Back to Conversation</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-50 text-[#068D9D] border border-cyan-200/60">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>PSL Reference</span>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Complete Suggested Reply */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Suggested English Reply
            </span>
            <h3
              id="ref-modal-title"
              className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight"
            >
              “{reply.text}”
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              {ref.explanation}
            </p>
          </div>

          {/* Corresponding PSL Phrase Label */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                PSL Sign Label
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#53599A]">
                {ref.pslLabel}
              </span>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
              {ref.intent.replace('_', ' ')}
            </span>
          </div>

          {/* Visual Demonstration or Honest Pending Notice */}
          <div className="space-y-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Visual Demonstration
            </span>

            {hasMedia ? (
              <div className="aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-200">
                <video
                  src={ref.mediaUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-start gap-3">
                <AlertCircle
                  className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-xs sm:text-sm leading-relaxed">
                  <p className="font-bold text-amber-900">
                    Verified sign demonstration not available yet
                  </p>
                  <p className="text-amber-800/90 mt-0.5">
                    Visual video recording for this specific phrase is pending certified PSL
                    expert validation. Follow the verified step-by-step hand guidance below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step-by-Step Signing Guide */}
          {ref.stepByStep && ref.stepByStep.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Step-by-Step Hand Guidance
              </span>
              <ol className="space-y-2">
                {ref.stepByStep.map((step, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed flex items-start gap-2.5"
                  >
                    <CheckCircle2
                      className="w-4 h-4 text-[#068D9D] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Usage Notes */}
          {ref.usageNotes && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70 text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-700 block mb-1">
                PSL Cultural & Facial Grammar Note:
              </span>
              {ref.usageNotes}
            </div>
          )}

          {/* Source and Provenance Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="truncate">Source: {ref.source}</span>
            <span className="shrink-0">{ref.license}</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#068D9D] hover:bg-[#05707d] transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D] shadow-2xs"
          >
            I Got It, Return
          </button>
        </div>
      </div>
    </div>
  );
}
