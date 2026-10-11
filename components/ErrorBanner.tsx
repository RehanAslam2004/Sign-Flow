'use client';

import React from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';

interface ErrorBannerProps {
  type: 'backend-offline' | 'camera-error' | 'speech-error';
  onRetry?: () => void;
}

export default function ErrorBanner({ type, onRetry }: ErrorBannerProps) {
  if (type === 'backend-offline') {
    return (
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-950 text-xs sm:text-sm shadow-xs"
        role="alert"
      >
        <div className="flex items-start sm:items-center gap-2.5">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span className="leading-relaxed">
            <strong className="font-semibold text-amber-900">Inference service disconnected:</strong> The local Python service is not running on port 8000. Start both services using <code className="bg-amber-100/90 text-amber-950 px-1.5 py-0.5 rounded font-mono text-xs">npm run dev</code>.
          </span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-xs transition-colors self-start sm:self-auto shrink-0 focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  if (type === 'camera-error') {
    return (
      <div
        className="flex items-center gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs sm:text-sm shadow-xs"
        role="alert"
      >
        <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
        <span className="leading-relaxed">
          <strong className="font-semibold text-rose-900">Camera unavailable:</strong> Please check your camera permissions in browser settings or verify device connection.
        </span>
      </div>
    );
  }

  return null;
}
