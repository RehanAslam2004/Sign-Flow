'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Sparkles, Volume2, Hand, RotateCcw } from 'lucide-react';
import LandingSurface from '@/components/LandingSurface';
import CameraViewport from '@/components/CameraViewport';
import RecognitionStatus from '@/components/RecognitionStatus';
import TranscriptView from '@/components/TranscriptView';
import SessionControlBar from '@/components/SessionControlBar';
import ErrorBanner from '@/components/ErrorBanner';

import { UsageMode, ConversationMessage } from '@/types/app';
import { FramePayload } from '@/types/contract';
import { initHandLandmarker, extractLandmarksFromVideo } from '@/lib/mediapipe';
import { SignFlowWebSocketClient, ConnectionStatus } from '@/lib/websocketClient';
import { RecognitionStateMachine } from '@/lib/stateMachine';
import { speechEngine } from '@/lib/speech';
import { CONFIG } from '@/lib/config';

export default function SignFlowHome() {
  const [mode, setMode] = useState<UsageMode>(null);

  // Connection & Recognition UI state
  const [serviceStatus, setServiceStatus] = useState<ConnectionStatus>('connecting');
  const [statusText, setStatusText] = useState<string>('Ready to sign');
  const [candidateSign, setCandidateSign] = useState<string | null>(null);
  const [candidateConfidence, setCandidateConfidence] = useState<number>(0);
  const [lastConfirmedSign, setLastConfirmedSign] = useState<string | null>(null);
  const [handsDetected, setHandsDetected] = useState<boolean>(false);
  const [autoSpeechEnabled, setAutoSpeechEnabled] = useState<boolean>(true);
  const [activeUtterance, setActiveUtterance] = useState<string[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Refs for loop & services
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const wsClientRef = useRef<SignFlowWebSocketClient | null>(null);
  const stateMachineRef = useRef<RecognitionStateMachine | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const sessionIdRef = useRef<string>(`sess_${Date.now()}`);

  // 1. Initialize State Machine
  useEffect(() => {
    stateMachineRef.current = new RecognitionStateMachine({
      onCandidatePreview: (sign, confidence) => {
        setCandidateSign(sign);
        setCandidateConfidence(confidence);
      },
      onSignConfirmed: (sign) => {
        setLastConfirmedSign(sign);
        setActiveUtterance((prev) => [...prev, sign]);
      },
      onUtteranceComplete: (phrase) => {
        // Add to transcript
        const newMessage: ConversationMessage = {
          id: `msg_${Date.now()}`,
          text: phrase,
          timestamp: Date.now(),
          spoken: autoSpeechEnabled,
        };
        setMessages((prev) => [newMessage, ...prev]);
        setActiveUtterance([]);

        // Speak aloud
        if (autoSpeechEnabled) {
          speechEngine.speak(phrase);
        }
      },
      onStatusChange: (text) => {
        setStatusText(text);
      },
    });

    return () => {
      stateMachineRef.current?.reset();
    };
  }, [autoSpeechEnabled]);

  // 2. Initialize MediaPipe & WebSocket when in active mode
  useEffect(() => {
    if (mode === null) {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
      return;
    }

    let isMounted = true;

    // Load MediaPipe
    initHandLandmarker()
      .then((landmarker) => {
        if (isMounted) {
          landmarkerRef.current = landmarker;
        }
      })
      .catch((err) => {
        console.error('Failed to initialize MediaPipe:', err);
      });

    // Connect WebSocket
    const client = new SignFlowWebSocketClient();
    wsClientRef.current = client;

    client.connect(
      (prediction) => {
        stateMachineRef.current?.processPrediction(prediction);
      },
      (status) => {
        setServiceStatus(status);
      }
    );

    return () => {
      isMounted = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      client.disconnect();
    };
  }, [mode]);

  // 3. Real-time Video Landmark Processing Loop
  const processVideoFrame = useCallback(() => {
    const video = videoElementRef.current;
    const landmarker = landmarkerRef.current;
    const wsClient = wsClientRef.current;

    if (video && video.readyState >= 2 && landmarker && wsClient) {
      const now = performance.now();
      const throttleInterval = 1000 / CONFIG.TARGET_FPS;

      if (now - lastFrameTimeRef.current >= throttleInterval) {
        lastFrameTimeRef.current = now;
        frameCounterRef.current += 1;

        // Extract raw 21 landmarks in browser
        const hands = extractLandmarksFromVideo(landmarker, video, now);
        const hasHands = hands.length > 0;
        setHandsDetected(hasHands);

        // Send payload over WebSocket
        const payload: FramePayload = {
          schema_version: '1.0',
          session_id: sessionIdRef.current,
          frame_id: frameCounterRef.current,
          timestamp: Date.now(),
          image_width: video.videoWidth || 1280,
          image_height: video.videoHeight || 720,
          hands_detected: hands.length,
          hands: hands,
        };

        wsClient.sendFrame(payload);
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(processVideoFrame);
  }, []);

  const handleVideoReady = (video: HTMLVideoElement) => {
    videoElementRef.current = video;
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(processVideoFrame);
  };

  // Actions
  const handleEndSession = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    speechEngine.cancel();
    stateMachineRef.current?.reset();
    setMode(null);
  };

  const handleClearTranscript = () => {
    setMessages([]);
    setActiveUtterance([]);
    stateMachineRef.current?.reset();
  };

  const handleFinishAndSpeak = () => {
    stateMachineRef.current?.finishUtterance();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#068D9D] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              S
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">
                SignFlow
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-500 font-medium border-l border-slate-200 pl-2">
                Pakistan Sign Language Bridge
              </span>
            </div>
          </div>

          {mode !== null && (
            <div className="flex items-center gap-2">
              <label className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSpeechEnabled}
                  onChange={(e) => setAutoSpeechEnabled(e.target.checked)}
                  className="rounded text-[#068D9D] focus:ring-[#068D9D]"
                />
                <span>Auto-speech</span>
              </label>

              <button
                onClick={() => setMode(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Mode</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {mode === null ? (
          <LandingSurface onSelectMode={(selectedMode) => setMode(selectedMode)} />
        ) : (
          <div className="max-w-6xl mx-auto w-full px-4 py-6 flex-1 flex flex-col gap-5">
            {/* Backend Offline Warning Banner if disconnected */}
            {serviceStatus === 'disconnected' && (
              <ErrorBanner
                type="backend-offline"
                onRetry={() => {
                  wsClientRef.current?.connect(
                    (pred) => stateMachineRef.current?.processPrediction(pred),
                    (status) => setServiceStatus(status)
                  );
                }}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
              {/* Left Column: Live Camera Viewport */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <CameraViewport
                  mode={mode}
                  onVideoReady={handleVideoReady}
                  statusText={statusText}
                  isRecognizing={candidateSign !== null}
                  handsDetected={handsDetected}
                />

                {/* Session Control Toolbar */}
                <SessionControlBar
                  onSwitchCamera={() => {
                    // Handled automatically via CameraViewport flip button
                  }}
                  onEndSession={handleEndSession}
                  onClearTranscript={handleClearTranscript}
                  onChangeMode={() => setMode(null)}
                  hasMessages={messages.length > 0}
                />
              </div>

              {/* Right Column: Active Translation, Utterance Builder, and Transcript */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Active Translation Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="mb-4">
                      <RecognitionStatus
                        statusText={statusText}
                        candidateSign={candidateSign}
                        candidateConfidence={candidateConfidence}
                        lastConfirmedSign={lastConfirmedSign}
                        serviceStatus={serviceStatus}
                      />
                    </div>

                    {/* Active Utterance Building Display */}
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 min-h-[110px] flex flex-col justify-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Current Message
                      </span>
                      {activeUtterance.length > 0 ? (
                        <p className="text-2xl font-extrabold text-slate-900 tracking-wide">
                          {activeUtterance.join(' ')}
                        </p>
                      ) : (
                        <p className="text-slate-400 text-sm">
                          {handsDetected
                            ? 'Ready — perform a verified sign...'
                            : 'Position your hands in the camera frame to sign...'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Speech Controls */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      onClick={handleFinishAndSpeak}
                      disabled={activeUtterance.length === 0}
                      className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        activeUtterance.length > 0
                          ? 'bg-[#068D9D] hover:bg-[#05707d] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Finish & Speak</span>
                    </button>
                  </div>
                </div>

                {/* Conversation Transcript */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex-1 min-h-[280px]">
                  <TranscriptView
                    messages={messages}
                    onReplay={(text) => speechEngine.speak(text)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
