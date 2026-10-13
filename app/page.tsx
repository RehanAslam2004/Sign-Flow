'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2 } from 'lucide-react';
import LandingSurface from '@/components/LandingSurface';
import CameraViewport from '@/components/CameraViewport';
import RecognitionStatus from '@/components/RecognitionStatus';
import TranscriptView from '@/components/TranscriptView';
import SessionControlBar from '@/components/SessionControlBar';
import ErrorBanner from '@/components/ErrorBanner';
import GhostHandGuide from '@/components/GhostHandGuide';

import { UsageMode, ConversationMessage, SuggestedReply } from '@/types/app';
import { FramePayload } from '@/types/contract';
import { initHandLandmarker, extractLandmarksFromVideo } from '@/lib/mediapipe';
import { SignFlowWebSocketClient, ConnectionStatus } from '@/lib/websocketClient';
import { RecognitionStateMachine } from '@/lib/stateMachine';
import { speechEngine } from '@/lib/speech';
import { CONFIG } from '@/lib/config';
import { getSuggestedRepliesForText } from '@/lib/replyCatalogue';

export default function SignFlowHome() {
  const [mode, setMode] = useState<UsageMode>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

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

  // Suggested Sign Reply state (exclusively active for 'partner' mode)
  const [activeGhostHandReply, setActiveGhostHandReply] = useState<SuggestedReply | null>(null);

  // Refs for loop & services
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const wsClientRef = useRef<SignFlowWebSocketClient | null>(null);
  const stateMachineRef = useRef<RecognitionStateMachine | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const sessionIdRef = useRef<string>(`sess_${Date.now()}`);

  // Mode and deduplication refs
  const modeRef = useRef<UsageMode>(mode);
  const lastHandledPhraseRef = useRef<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Clean suggestion and guide state on reset, end, or mode change
  const clearSuggestedRepliesState = useCallback(() => {
    setActiveGhostHandReply(null);
    lastHandledPhraseRef.current = null;
  }, []);

  // Handle Mode Selection and set appropriate default camera
  const handleSelectMode = (selectedMode: 'signing' | 'partner') => {
    clearSuggestedRepliesState();
    setMode(selectedMode);
    setFacingMode(selectedMode === 'partner' ? 'environment' : 'user');
  };

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

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

        // Automatic AR Ghost Hand Guide: strictly for 'partner' mode
        if (modeRef.current === 'partner') {
          const replies = getSuggestedRepliesForText(phrase);
          // Automatically select best contextually appropriate verified reply
          if (replies.length > 0 && replies[0].reference) {
            setActiveGhostHandReply({
              ...replies[0],
              id: `${replies[0].id}_${Date.now()}`,
            });
          } else {
            setActiveGhostHandReply(null);
          }
        } else {
          // In 'signing' mode, strictly ensure no guide is active
          setActiveGhostHandReply(null);
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

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      videoElementRef.current = video;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      animationFrameIdRef.current = requestAnimationFrame(processVideoFrame);
    },
    [processVideoFrame]
  );

  // Actions
  const handleEndSession = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    speechEngine.cancel();
    stateMachineRef.current?.reset();
    clearSuggestedRepliesState();
    setMode(null);
  };

  const handleClearTranscript = () => {
    setMessages([]);
    setActiveUtterance([]);
    stateMachineRef.current?.reset();
    clearSuggestedRepliesState();
  };

  const handleFinishAndSpeak = () => {
    stateMachineRef.current?.finishUtterance();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#068D9D] flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-xs shrink-0">
              S
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                SignFlow
              </span>
              <span className="hidden md:inline-block ml-2 text-xs text-slate-500 font-medium border-l border-slate-200 pl-2">
                Pakistan Sign Language Bridge
              </span>
            </div>
          </div>

          {mode !== null && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Auto Speech Toggle */}
              <label
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-xl cursor-pointer select-none transition-colors"
                title="Automatically speak confirmed phrases after pause"
              >
                <input
                  type="checkbox"
                  checked={autoSpeechEnabled}
                  onChange={(e) => setAutoSpeechEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#068D9D] focus:ring-[#068D9D]"
                />
                <span className="font-medium text-[11px] sm:text-xs">Auto-speak</span>
              </label>

              {/* Change Mode Button */}
              <button
                onClick={() => {
                  clearSuggestedRepliesState();
                  setMode(null);
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D]"
                aria-label="Return to situation selection screen"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Change Mode</span>
                <span className="sm:hidden">Mode</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {mode === null ? (
          <LandingSurface onSelectMode={handleSelectMode} />
        ) : (
          <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 flex-1 flex flex-col gap-4 sm:gap-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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

            {/* Main Translator Grid (Desktop 2-Col, Mobile Vertical Stack) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1 items-start">
              {/* Camera Column (Left on Desktop, Top on Mobile) */}
              <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4">
                <CameraViewport
                  mode={mode}
                  onVideoReady={handleVideoReady}
                  statusText={statusText}
                  isRecognizing={candidateSign !== null}
                  handsDetected={handsDetected}
                  facingMode={facingMode}
                  onToggleFacingMode={handleToggleFacingMode}
                >
                  {/* AR Translucent Ghost-Hand Guide (strictly automatic in partner mode) */}
                  {mode === 'partner' && activeGhostHandReply && (
                    <GhostHandGuide
                      reply={activeGhostHandReply}
                      mode={mode}
                      onClose={() => setActiveGhostHandReply(null)}
                    />
                  )}
                </CameraViewport>

                {/* Session Control Toolbar directly beneath camera on desktop */}
                <div className="hidden lg:block">
                  <SessionControlBar
                    onSwitchCamera={handleToggleFacingMode}
                    onEndSession={handleEndSession}
                    onClearTranscript={handleClearTranscript}
                    onChangeMode={() => {
                      clearSuggestedRepliesState();
                      setMode(null);
                    }}
                    hasMessages={messages.length > 0}
                  />
                </div>
              </div>

              {/* Translation & Conversation Column (Right on Desktop, Below on Mobile) */}
              <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5">
                {/* Active Translation Card */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    {/* Live Recognition Status Row */}
                    <div className="mb-3.5">
                      <RecognitionStatus
                        statusText={statusText}
                        candidateSign={candidateSign}
                        candidateConfidence={candidateConfidence}
                        lastConfirmedSign={lastConfirmedSign}
                        serviceStatus={serviceStatus}
                      />
                    </div>

                    {/* Current Utterance Display Box */}
                    <div
                      className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/70 min-h-[100px] sm:min-h-[110px] flex flex-col justify-center transition-all"
                      aria-live="polite"
                    >
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Current Translation
                      </span>
                      {activeUtterance.length > 0 ? (
                        <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-wide break-words">
                          {activeUtterance.join(' ')}
                        </p>
                      ) : (
                        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                          {handsDetected
                            ? 'Ready — perform a verified PSL sign...'
                            : 'Position hands in the camera frame to start signing...'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Primary Finish & Speak Action */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      onClick={handleFinishAndSpeak}
                      disabled={activeUtterance.length === 0}
                      className={`min-h-[48px] flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-[#068D9D] ${
                        activeUtterance.length > 0
                          ? 'bg-[#068D9D] hover:bg-[#05707d] text-white shadow-sm active:scale-[0.99]'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      aria-label="Finish and speak translated message"
                    >
                      <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Finish & Speak</span>
                    </button>
                  </div>
                </div>

                {/* Session Control Toolbar on Mobile (visible only on mobile) */}
                <div className="lg:hidden">
                  <SessionControlBar
                    onSwitchCamera={handleToggleFacingMode}
                    onEndSession={handleEndSession}
                    onClearTranscript={handleClearTranscript}
                    onChangeMode={() => {
                      clearSuggestedRepliesState();
                      setMode(null);
                    }}
                    hasMessages={messages.length > 0}
                  />
                </div>

                {/* Conversation Transcript Card */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex-1 min-h-[260px] sm:min-h-[320px]">
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
