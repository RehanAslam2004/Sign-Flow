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
import { runClientInference } from '@/lib/clientClassifier';

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess_${crypto.randomUUID()}`;
  }
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function SignFlowHome() {
  const [mode, setMode] = useState<UsageMode>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Session state: each conversation has an explicit unique session identity
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isSessionActiveRef = useRef<boolean>(false);

  // Connection & Recognition UI state
  const [serviceStatus, setServiceStatus] = useState<ConnectionStatus | 'edge_active'>('connecting');
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

  // Mode ref
  const modeRef = useRef<UsageMode>(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Clean suggestion and guide state on reset, end, or mode change
  const clearSuggestedRepliesState = useCallback(() => {
    setActiveGhostHandReply(null);
  }, []);

  // 1. Initialize State Machine
  useEffect(() => {
    stateMachineRef.current = new RecognitionStateMachine({
      onCandidatePreview: (sign, confidence, eventSessionId) => {
        // Discard any candidate from ended or mismatched session
        if (
          !isSessionActiveRef.current ||
          (eventSessionId && eventSessionId !== sessionIdRef.current)
        ) {
          return;
        }
        setCandidateSign(sign);
        setCandidateConfidence(confidence);
      },
      onSignConfirmed: (sign, eventSessionId) => {
        // Discard any confirmed sign from ended or mismatched session
        if (
          !isSessionActiveRef.current ||
          (eventSessionId && eventSessionId !== sessionIdRef.current)
        ) {
          return;
        }
        setLastConfirmedSign(sign);
        setActiveUtterance((prev) => [...prev, sign]);
      },
      onUtteranceComplete: (phrase, eventSessionId) => {
        // Discard completed utterance from ended or mismatched session
        if (
          !isSessionActiveRef.current ||
          (eventSessionId && eventSessionId !== sessionIdRef.current)
        ) {
          return;
        }

        // Add to transcript
        const newMessage: ConversationMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          text: phrase,
          timestamp: Date.now(),
          spoken: autoSpeechEnabled,
        };
        setMessages((prev) => [newMessage, ...prev]);
        setActiveUtterance([]);

        // Speak aloud
        if (autoSpeechEnabled) {
          speechEngine.speak(phrase, eventSessionId);
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
          setActiveGhostHandReply(null);
        }
      },
      onStatusChange: (text, eventSessionId) => {
        if (
          !isSessionActiveRef.current ||
          (eventSessionId && eventSessionId !== sessionIdRef.current)
        ) {
          return;
        }
        setStatusText(text);
      },
    }, sessionIdRef.current || undefined);

    return () => {
      stateMachineRef.current?.reset();
    };
  }, [autoSpeechEnabled]);

  // 2. Initialize MediaPipe & WebSocket when in active mode with active session ID
  useEffect(() => {
    if (mode === null || !currentSessionId) {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
      return;
    }

    const sessionForThisEffect = currentSessionId;
    let isMounted = true;

    // Load MediaPipe
    initHandLandmarker()
      .then((landmarker) => {
        if (isMounted && sessionIdRef.current === sessionForThisEffect) {
          landmarkerRef.current = landmarker;
        }
      })
      .catch((err) => {
        console.error('Failed to initialize MediaPipe:', err);
      });

    // Connect WebSocket scoped specifically to this session
    const client = new SignFlowWebSocketClient();
    client.setActiveSessionId(sessionForThisEffect);
    wsClientRef.current = client;

    client.connect(
      (prediction) => {
        // Strict race condition guard: drop stale predictions from ended or previous sessions
        if (
          !isSessionActiveRef.current ||
          sessionIdRef.current !== sessionForThisEffect ||
          (prediction.session_id && prediction.session_id !== sessionForThisEffect)
        ) {
          return;
        }
        stateMachineRef.current?.processPrediction(prediction);
      },
      (status) => {
        if (isMounted && sessionIdRef.current === sessionForThisEffect) {
          if (status === 'connected') {
            setServiceStatus('connected');
          } else if (status === 'disconnected') {
            // When remote WebSocket is disconnected (e.g. standalone Vercel hosting),
            // seamlessly transition to the high-performance in-browser AI engine
            setServiceStatus('edge_active');
          } else {
            setServiceStatus(status);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      client.disconnect();
      if (wsClientRef.current === client) {
        wsClientRef.current = null;
      }
    };
  }, [mode, currentSessionId]);

  // 3. Real-time Video Landmark Processing Loop
  const processVideoFrame = useCallback(() => {
    const video = videoElementRef.current;
    const landmarker = landmarkerRef.current;
    const wsClient = wsClientRef.current;
    const activeSession = sessionIdRef.current;

    // Halt immediately if session has ended or is inactive
    if (!isSessionActiveRef.current || !activeSession) {
      return;
    }

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

        // Send payload over WebSocket with active session ID
        const payload: FramePayload = {
          schema_version: '1.0',
          session_id: activeSession,
          frame_id: frameCounterRef.current,
          timestamp: Date.now(),
          image_width: video.videoWidth || 1280,
          image_height: video.videoHeight || 720,
          hands_detected: hands.length,
          hands: hands,
        };

        const sent = wsClient.sendFrame(payload);
        if (!sent) {
          // If remote WebSocket is offline or not running (e.g. Vercel deployment),
          // run instantaneous in-browser landmark normalization and PSL classification
          const localPrediction = runClientInference(payload);
          stateMachineRef.current?.processPrediction(localPrediction);
          setServiceStatus((prev) => (prev === 'connected' ? prev : 'edge_active'));
        }
      }
    }

    if (isSessionActiveRef.current && sessionIdRef.current === activeSession) {
      animationFrameIdRef.current = requestAnimationFrame(processVideoFrame);
    }
  }, []);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      videoElementRef.current = video;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (isSessionActiveRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(processVideoFrame);
      }
    },
    [processVideoFrame]
  );

  // START SESSION: Generates a brand new unique session, clean empty transcript, and fresh recognition state
  const handleSelectMode = useCallback(
    (selectedMode: 'signing' | 'partner') => {
      // 1. Generate genuinely new unique session ID
      const newSessionId = generateSessionId();
      sessionIdRef.current = newSessionId;
      isSessionActiveRef.current = true;
      setCurrentSessionId(newSessionId);

      // 2. Clear all previous session state completely
      clearSuggestedRepliesState();
      setMessages([]);
      setActiveUtterance([]);
      setCandidateSign(null);
      setCandidateConfidence(0);
      setLastConfirmedSign(null);
      setHandsDetected(false);
      setStatusText('Ready to sign');
      frameCounterRef.current = 0;
      lastFrameTimeRef.current = 0;

      // 3. Reset state machine and speech engine to new session
      stateMachineRef.current?.reset(newSessionId);
      speechEngine.setActiveSessionId(newSessionId);
      speechEngine.cancel();

      // 4. Set mode and default camera facing
      setMode(selectedMode);
      setFacingMode(selectedMode === 'partner' ? 'environment' : 'user');
    },
    [clearSuggestedRepliesState]
  );

  // END SESSION: Complete teardown of active conversation and all asynchronous resources
  const handleEndSession = useCallback(() => {
    // 1. Mark session as inactive immediately before initiating async cleanup
    isSessionActiveRef.current = false;
    const endedSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setCurrentSessionId(null);

    // 2. Stop camera animation loop and release video element ref
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    videoElementRef.current = null;

    // 3. Stop speech immediately and detach callbacks
    speechEngine.setActiveSessionId(null);
    speechEngine.cancel();

    // 4. Reset state machine and clear all timers
    stateMachineRef.current?.reset();

    // 5. Notify backend and disconnect WebSocket cleanly
    if (wsClientRef.current) {
      if (endedSessionId) {
        wsClientRef.current.sendReset(endedSessionId);
      }
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }

    // 6. Clear suggested replies and ghost-hand guide
    clearSuggestedRepliesState();

    // 7. Reset transcript and all recognition UI states
    setMessages([]);
    setActiveUtterance([]);
    setCandidateSign(null);
    setCandidateConfidence(0);
    setLastConfirmedSign(null);
    setHandsDetected(false);
    setStatusText('Ready to sign');
    setServiceStatus('disconnected');

    // 8. Reset frame counters
    frameCounterRef.current = 0;
    lastFrameTimeRef.current = 0;

    // 9. Reset mode to return to landing surface
    setMode(null);
  }, [clearSuggestedRepliesState]);

  const handleClearTranscript = useCallback(() => {
    setMessages([]);
    setActiveUtterance([]);
    stateMachineRef.current?.reset(sessionIdRef.current || undefined);
    clearSuggestedRepliesState();
  }, [clearSuggestedRepliesState]);

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
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

              {/* Change Mode / End Session Button */}
              <button
                onClick={handleEndSession}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D]"
                aria-label="Return to situation selection screen and end session"
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
          <div
            key={currentSessionId || 'active-session'}
            className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 flex-1 flex flex-col gap-4 sm:gap-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            {/* Backend Offline Warning Banner if disconnected */}
            {serviceStatus === 'disconnected' && (
              <ErrorBanner
                type="backend-offline"
                onRetry={() => {
                  if (wsClientRef.current) {
                    wsClientRef.current.setUrl(CONFIG.WS_URL);
                  }
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
                    onChangeMode={handleEndSession}
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
                    onChangeMode={handleEndSession}
                    hasMessages={messages.length > 0}
                  />
                </div>

                {/* Conversation Transcript Card */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex-1 min-h-[260px] sm:min-h-[320px]">
                  <TranscriptView
                    messages={messages}
                    onReplay={(text) => speechEngine.speak(text, currentSessionId || undefined)}
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
