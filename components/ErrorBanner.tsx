'use client';

import React, { useState } from 'react';
import { AlertCircle, WifiOff, Settings, Check, RotateCcw, ExternalLink } from 'lucide-react';
import { getResolvedWsUrl, setCustomWsUrl } from '@/lib/config';

interface ErrorBannerProps {
  type: 'backend-offline' | 'camera-error' | 'speech-error';
  onRetry?: () => void;
}

export default function ErrorBanner({ type, onRetry }: ErrorBannerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeUrl = typeof window !== 'undefined' ? getResolvedWsUrl() : '';
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocalTarget = activeUrl.includes('127.0.0.1') || activeUrl.includes('localhost');

  const handleOpenSettings = () => {
    setCustomInput(activeUrl);
    setShowSettings(true);
    setSavedSuccess(false);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      setCustomWsUrl(customInput.trim());
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setShowSettings(false);
        onRetry?.();
      }, 500);
    }
  };

  const handleResetDefault = () => {
    setCustomWsUrl(null);
    setCustomInput(getResolvedWsUrl());
    onRetry?.();
    setShowSettings(false);
  };

  if (type === 'backend-offline') {
    return (
      <div
        className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50/95 border border-amber-300/80 text-amber-950 text-xs sm:text-sm shadow-xs"
        role="alert"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <div className="leading-relaxed">
              <strong className="font-semibold text-amber-900">Inference service disconnected:</strong>{' '}
              {isHttps && isLocalTarget ? (
                <span>
                  This app is hosted on HTTPS, but trying to reach local <code className="bg-amber-100/90 text-amber-950 px-1 py-0.5 rounded font-mono text-xs">{activeUrl}</code>. Deploy the Python CV service on Render or configure your server URL.
                </span>
              ) : (
                <span>
                  Unable to connect to computer vision backend at <code className="bg-amber-100/90 text-amber-950 px-1 py-0.5 rounded font-mono text-xs">{activeUrl || 'ws://127.0.0.1:8000/ws/predict'}</code>.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              onClick={handleOpenSettings}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200/90 text-amber-900 font-semibold text-xs transition-colors focus-visible:ring-2 focus-visible:ring-amber-600"
              title="Configure Python backend URL"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Configure Server</span>
            </button>

            {onRetry && (
              <button
                onClick={onRetry}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-200/90 hover:bg-amber-300 text-amber-950 font-bold text-xs transition-colors focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                Retry Connection
              </button>
            )}
          </div>
        </div>

        {/* Inline URL configuration modal/drawer */}
        {showSettings && (
          <form
            onSubmit={handleSaveUrl}
            className="pt-3 mt-1 border-t border-amber-200/80 flex flex-col gap-2.5 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-900 text-xs">
                Python Computer Vision Backend URL:
              </span>
              <button
                type="button"
                onClick={handleResetDefault}
                className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset default
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="wss://your-service.onrender.com/ws/predict"
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-amber-300 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#068D9D]"
                autoFocus
              />
              <button
                type="submit"
                className="min-h-[36px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#068D9D] hover:bg-[#05707d] text-white font-semibold text-xs shadow-xs transition-colors"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save & Connect</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="min-h-[36px] px-3 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-medium text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Tip: If you deployed the Python service to Render (e.g. <code>https://signflow-cv.onrender.com</code>), paste that URL above. It will automatically connect over secure WebSocket (<code>wss://</code>).
            </p>
          </form>
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
