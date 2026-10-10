'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, SwitchCamera, AlertCircle, RefreshCw, Hand } from 'lucide-react';
import { UsageMode } from '@/types/app';

interface CameraViewportProps {
  mode: UsageMode;
  onVideoReady?: (video: HTMLVideoElement) => void;
  statusText?: string;
  isRecognizing?: boolean;
  handsDetected?: boolean;
}

export default function CameraViewport({
  mode,
  onVideoReady,
  statusText = 'Ready',
  isRecognizing = false,
  handsDetected = false,
}: CameraViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    mode === 'partner' ? 'environment' : 'user'
  );
  const [errorState, setErrorState] = useState<'none' | 'denied' | 'unavailable'>('none');
  const [isInitializing, setIsInitializing] = useState(true);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    setIsInitializing(true);
    setErrorState('none');

    // Stop existing stream tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
        if (onVideoReady) {
          onVideoReady(videoRef.current);
        }
      }
      setIsInitializing(false);
    } catch (err: unknown) {
      console.error('Camera initialization error:', err);
      const error = err as { name?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setErrorState('denied');
      } else {
        setErrorState('unavailable');
      }
      setIsInitializing(false);
    }
  }, [onVideoReady, stream]);

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-md border border-slate-200">
      {/* Live Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          facingMode === 'user' ? 'scale-x-[-1]' : ''
        } ${errorState !== 'none' || isInitializing ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Subtle Hand-Framing Guide Overlay */}
      {errorState === 'none' && !isInitializing && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-3/4 h-3/4 border-2 border-dashed border-white/30 rounded-2xl flex flex-col justify-between p-4 transition-all duration-300">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-medium tracking-wide uppercase text-white/70 bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-sm">
                Signing Area
              </span>
              {handsDetected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-1 rounded-md backdrop-blur-sm">
                  <Hand className="w-3.5 h-3.5" />
                  Hands in frame
                </span>
              ) : (
                <span className="text-xs text-white/60 bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
                  Position hands here
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Status & Camera Switch Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-medium border border-white/10 shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              errorState !== 'none'
                ? 'bg-rose-500'
                : isRecognizing
                ? 'bg-[#068D9D] animate-ping'
                : 'bg-emerald-400'
            }`}
          />
          <span>{statusText}</span>
        </div>

        {errorState === 'none' && (
          <button
            onClick={toggleCamera}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-medium border border-white/10 shadow-sm transition-colors"
            title="Switch front/rear camera"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {facingMode === 'user' ? 'Switch to Rear' : 'Switch to Front'}
            </span>
          </button>
        )}
      </div>

      {/* Loading / Starting State */}
      {isInitializing && errorState === 'none' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/90 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#068D9D]" />
          <p className="text-sm font-medium text-slate-300">Initializing camera...</p>
        </div>
      )}

      {/* Permission Denied Empty State */}
      {errorState === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900 text-white">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-2">Camera access is needed</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
            SignFlow needs camera access to recognize signing. Please allow camera access in your browser settings, then click try again.
          </p>
          <button
            onClick={() => startCamera(facingMode)}
            className="px-5 py-2.5 rounded-xl bg-[#068D9D] hover:bg-[#05707d] text-white font-semibold text-xs transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Camera Unavailable Empty State */}
      {errorState === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900 text-white">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-2">Camera disconnected or unavailable</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
            Your camera stopped working or no video device was detected. Please check your connection or try another device.
          </p>
          <button
            onClick={() => startCamera(facingMode)}
            className="px-5 py-2.5 rounded-xl bg-[#53599A] hover:bg-[#434880] text-white font-semibold text-xs transition-colors"
          >
            Reconnect Camera
          </button>
        </div>
      )}
    </div>
  );
}
