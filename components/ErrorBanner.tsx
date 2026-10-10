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
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
        <div className="flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>AI Engine Disconnected:</strong> The local Python inference service is not running on port 8000. Start it with <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">npm run dev</code>.
          </span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 font-semibold text-[11px] transition-colors ml-2 shrink-0"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  if (type === 'camera-error') {
    return (
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
        <span>
          <strong>Camera Unavailable:</strong> Please check your camera permissions or device connection.
        </span>
      </div>
    );
  }

  return null;
}
