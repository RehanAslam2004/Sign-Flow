'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, SwitchCamera, AlertCircle, RefreshCw, Hand, VideoOff } from 'lucide-react';
import { UsageMode } from '@/types/app';

interface CameraViewportProps {
  mode: UsageMode;
  onVideoReady?: (video: HTMLVideoElement) => void;
  statusText?: string;
  isRecognizing?: boolean;
  handsDetected?: boolean;
  facingMode?: 'user' | 'environment';
  onToggleFacingMode?: () => void;
  children?: React.ReactNode;
}

export default function CameraViewport({
  mode,
  onVideoReady,
  statusText = 'Ready',
  isRecognizing = false,
  handsDetected = false,
  facingMode: externalFacingMode,
  onToggleFacingMode,
  children,
}: CameraViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onVideoReadyRef = useRef(onVideoReady);

  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
  }, [onVideoReady]);

  const [internalFacingMode, setInternalFacingMode] = useState<'user' | 'environment'>(
    mode === 'partner' ? 'environment' : 'user'
  );

  const activeFacingMode = externalFacingMode !== undefined ? externalFacingMode : internalFacingMode;

  const [errorState, setErrorState] = useState<'none' | 'denied' | 'in_use' | 'unavailable'>('none');
  const [isInitializing, setIsInitializing] = useState(true);
  const currentFacingRef = useRef<'user' | 'environment' | null>(null);

  // Reliably release hardware camera lock
  const stopCurrentStream = useCallback(() => {
    currentFacingRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Error stopping track:', err);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: 'user' | 'environment') => {
      // If we already have a live, playing stream with the same facing mode, do not reload
      if (
        currentFacingRef.current === facing &&
        streamRef.current &&
        streamRef.current.active &&
        streamRef.current.getVideoTracks().some((t) => t.readyState === 'live') &&
        videoRef.current &&
        videoRef.current.srcObject
      ) {
        setIsInitializing(false);
        return;
      }

      setIsInitializing(true);
      setErrorState('none');

      // Stop any prior active stream to release hardware device lock
      stopCurrentStream();

      let acquiredStream: MediaStream | null = null;

      try {
        // Primary attempt: preferred facing mode and resolution
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (constraintErr: any) {
          // If preferred facing mode or resolution fails on desktop webcams, fallback to basic video
          if (
            constraintErr?.name === 'OverconstrainedError' ||
            constraintErr?.name === 'ConstraintNotSatisfiedError' ||
            constraintErr?.name === 'NotFoundError'
          ) {
            acquiredStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } else {
            throw constraintErr;
          }
        }

        streamRef.current = acquiredStream;
        currentFacingRef.current = facing;

        if (videoRef.current && acquiredStream) {
          videoRef.current.srcObject = acquiredStream;
          try {
            await videoRef.current.play();
          } catch (playErr: any) {
            if (playErr?.name === 'AbortError') {
              // Harmless play interruption, do not crash camera
              setIsInitializing(false);
              return;
            }
            throw playErr;
          }

          if (onVideoReadyRef.current) {
            onVideoReadyRef.current(videoRef.current);
          }
        }
        setIsInitializing(false);
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };

        // AbortError on play() is benign and should never enter error state
        if (error?.name === 'AbortError') {
          setIsInitializing(false);
          return;
        }

        console.error('Camera initialization error:', err);

        if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
          setErrorState('denied');
        } else if (
          error?.name === 'NotReadableError' ||
          error?.name === 'TrackStartError' ||
          (error?.message && error.message.toLowerCase().includes('device in use'))
        ) {
          // Hardware camera is locked by another tab, browser window, or application
          setErrorState('in_use');
        } else {
          setErrorState('unavailable');
        }
        setIsInitializing(false);
      }
    },
    [stopCurrentStream]
  );

  // Initialize camera and cleanup reliably ONLY when activeFacingMode changes or on unmount
  useEffect(() => {
    startCamera(activeFacingMode);

    return () => {
      stopCurrentStream();
    };
  }, [activeFacingMode, startCamera, stopCurrentStream]);

  // Release camera hardware immediately when tab unloads, hides, or reloads
  useEffect(() => {
    const handleRelease = () => {
      stopCurrentStream();
    };
    window.addEventListener('beforeunload', handleRelease);
    window.addEventListener('pagehide', handleRelease);

    return () => {
      window.removeEventListener('beforeunload', handleRelease);
      window.removeEventListener('pagehide', handleRelease);
    };
  }, [stopCurrentStream]);

  const handleToggle = () => {
    if (onToggleFacingMode) {
      onToggleFacingMode();
    } else {
      setInternalFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    }
  };

  return (
    <div
      className="relative w-full aspect-[4/3] sm:aspect-video max-h-[38vh] sm:max-h-[460px] lg:max-h-[520px] bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200/80"
      aria-label="Camera signing preview"
    >
      {/* Live Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        aria-hidden="true"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          activeFacingMode === 'user' ? 'scale-x-[-1]' : ''
        } ${errorState !== 'none' || isInitializing ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Subtle Hand-Framing Guide Overlay */}
      {errorState === 'none' && !isInitializing && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3 sm:p-5">
          <div className="w-full h-full max-w-[85%] max-h-[85%] border-2 border-dashed border-white/40 rounded-xl sm:rounded-2xl flex flex-col justify-between p-3 sm:p-4 transition-all duration-300">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-white/90 bg-black/50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur-sm">
                Signing Area
              </span>
              {handsDetected ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-md backdrop-blur-sm">
                  <Hand className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Hands detected</span>
                </span>
              ) : (
                <span className="text-[11px] sm:text-xs text-white/80 bg-black/50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur-sm">
                  Position hands here
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Status & Camera Switch Bar */}
      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 flex items-center justify-between pointer-events-auto gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-xs font-medium border border-white/10 shadow-sm">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              errorState !== 'none'
                ? 'bg-rose-500'
                : isRecognizing
                ? 'bg-[#068D9D]'
                : 'bg-emerald-400'
            }`}
            aria-hidden="true"
          />
          <span className="truncate max-w-[150px] sm:max-w-none">{statusText}</span>
        </div>

        {errorState === 'none' && (
          <button
            onClick={handleToggle}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white text-xs font-semibold border border-white/10 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D]"
            aria-label={`Switch camera, currently using ${activeFacingMode === 'user' ? 'front' : 'rear'} camera`}
            title="Switch front/rear camera"
          >
            <SwitchCamera className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {activeFacingMode === 'user' ? 'Use Rear' : 'Use Front'}
            </span>
          </button>
        )}
      </div>

      {/* Loading / Starting State */}
      {isInitializing && errorState === 'none' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/95 gap-3 p-4">
          <RefreshCw className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-[#068D9D]" aria-hidden="true" />
          <p className="text-xs sm:text-sm font-medium text-slate-300 text-center">Starting camera feed...</p>
        </div>
      )}

      {/* Permission Denied Empty State */}
      {errorState === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 sm:p-6 bg-slate-900 text-white">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
            <Camera className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-1.5 text-white">Camera access is needed</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mb-5 leading-relaxed">
            SignFlow needs camera access to recognize signing. Please allow camera access in your browser settings, then try again.
          </p>
          <button
            onClick={() => startCamera(activeFacingMode)}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#068D9D] hover:bg-[#05707d] text-white font-semibold text-xs sm:text-sm transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-white"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Camera In Use by Another Tab or App Empty State */}
      {errorState === 'in_use' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 sm:p-6 bg-slate-900 text-white z-20">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <VideoOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-1.5 text-white">Camera is in use</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mb-5 leading-relaxed">
            Another browser tab, window, or application is currently locking your webcam. Please close any other open SignFlow tabs, then click Retry.
          </p>
          <button
            onClick={() => startCamera(activeFacingMode)}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#068D9D] hover:bg-[#05707d] text-white font-semibold text-xs sm:text-sm transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          >
            Retry Camera
          </button>
        </div>
      )}

      {/* Camera Unavailable Empty State */}
      {errorState === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 sm:p-6 bg-slate-900 text-white">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-1.5 text-white">Camera unavailable</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mb-5 leading-relaxed">
            Your camera stopped working or no video device was detected. Please check your connection or choose another camera.
          </p>
          <button
            onClick={() => startCamera(activeFacingMode)}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#53599A] hover:bg-[#434880] text-white font-semibold text-xs sm:text-sm transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-white"
          >
            Reconnect Camera
          </button>
        </div>
      )}

      {/* AR Overlays (e.g. Ghost Hand Guide) */}
      {children}
    </div>
  );
}
