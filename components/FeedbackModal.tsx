'use client';

import React, { useState } from 'react';
import { Flag, X, Check, AlertCircle, Shield } from 'lucide-react';
import { FeedbackSample, SignLanguageMode } from '@/types/contract';
import { PSL_EXTENDED_MAP } from '@/lib/urduMapping';
import { CONFIG } from '@/lib/config';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  predictedSign: string | null;
  confidence: number;
  margin?: number;
  language: SignLanguageMode;
  sessionId: string;
  features?: number[];
}

export default function FeedbackModal({
  isOpen,
  onClose,
  predictedSign,
  confidence,
  margin = 0,
  language,
  sessionId,
  features,
}: FeedbackModalProps) {
  const [trueLabel, setTrueLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [hasConsent, setHasConsent] = useState<boolean>(true);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Vocabulary suggestions from PSL Extended & standard greetings
  const suggestedLabels = Object.keys(PSL_EXTENDED_MAP);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trueLabel.trim()) {
      setErrorMessage('Please select or enter the correct sign label.');
      return;
    }
    if (!hasConsent) {
      setErrorMessage('Consent is required to store anonymous landmark coordinates.');
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);

    const sampleId = `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const samplePayload: FeedbackSample = {
      sample_id: sampleId,
      session_id: sessionId,
      timestamp: Date.now(),
      language,
      predicted_label: predictedSign,
      true_label: trueLabel.trim(),
      confidence,
      margin,
      review_status: 'pending_review',
      notes: notes.trim() || undefined,
      features: features && features.length === 63 ? features : undefined,
    };

    try {
      // 1. Submit to FastAPI backend feedback API
      const backendUrl = CONFIG.WS_URL.replace('/ws/predict', '').replace(/^ws/, 'http');
      const res = await fetch(`${backendUrl}/api/feedback/sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonSafeStringify(samplePayload),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        onClose();
      }, 1500);
    } catch (err: any) {
      console.warn('Backend feedback offline, saving sample to localStorage fallback:', err);
      // Fallback: Store locally in browser localStorage
      try {
        const key = 'signflow_pending_feedback_samples';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(samplePayload);
        localStorage.setItem(key, JSON.stringify(existing));
        setStatus('success');
        setTimeout(() => {
          setStatus('idle');
          onClose();
        }, 1500);
      } catch (storageErr) {
        setStatus('error');
        setErrorMessage('Failed to submit sample. Please verify connection.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Flag className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 id="feedback-modal-title" className="font-bold text-slate-900 text-sm sm:text-base">
                Report Recognition Failure
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Flag uncertain or incorrect predictions for dataset review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Captured Telemetry Preview */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Predicted Sign:</span>
              <span className="font-bold text-slate-800">{predictedSign || '(None / Uncertain)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Confidence / Margin:</span>
              <span className="font-mono text-slate-700">
                {Math.round(confidence * 100)}% ({margin > 0 ? `+${margin.toFixed(2)}` : 'ambiguous'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Language Mode:</span>
              <span className="font-semibold text-[#068D9D] uppercase text-[10px]">{language}</span>
            </div>
          </div>

          {/* Correct Label Input */}
          <div className="space-y-1.5">
            <label htmlFor="true-label-input" className="block text-xs font-bold text-slate-700">
              What was the actual intended sign? <span className="text-rose-500">*</span>
            </label>
            <input
              id="true-label-input"
              list="suggested-signs-datalist"
              type="text"
              value={trueLabel}
              onChange={(e) => setTrueLabel(e.target.value)}
              placeholder="e.g. Assalamulaikum, G Han, Barai Mehrbani, Alif..."
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#068D9D]"
              required
            />
            <datalist id="suggested-signs-datalist">
              {suggestedLabels.slice(0, 40).map((lbl) => (
                <option key={lbl} value={lbl} />
              ))}
            </datalist>
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label htmlFor="notes-input" className="block text-xs font-bold text-slate-700">
              Condition or Failure Context <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dim lighting, left hand, hand near boundary"
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#068D9D]"
            />
          </div>

          {/* Privacy & Consent Notice */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-start gap-2.5 text-[11px] text-slate-600">
            <Shield className="w-4 h-4 text-[#068D9D] shrink-0 mt-0.5" aria-hidden="true" />
            <label className="cursor-pointer select-none leading-relaxed">
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                className="mr-1.5 rounded text-[#068D9D] focus:ring-[#068D9D]"
              />
              Stores only 63 anonymous normalized landmark floats. <strong>Zero camera images or video footage</strong> are ever stored.
            </label>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={status === 'submitting'}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#068D9D] hover:bg-[#05727f] shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {status === 'submitting' ? (
                <span>Recording...</span>
              ) : status === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Reported!</span>
                </>
              ) : (
                <>
                  <Flag className="w-3.5 h-3.5" />
                  <span>Submit Sample</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function jsonSafeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'number' && !isFinite(value)) return null;
    return value;
  });
}
