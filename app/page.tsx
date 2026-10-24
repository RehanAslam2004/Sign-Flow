'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, Activity, Flag } from 'lucide-react';
import LandingSurface from '@/components/LandingSurface';
import CameraViewport from '@/components/CameraViewport';
import RecognitionStatus from '@/components/RecognitionStatus';
import TranscriptView from '@/components/TranscriptView';
import SessionControlBar from '@/components/SessionControlBar';
import ErrorBanner from '@/components/ErrorBanner';
import GhostHandGuide from '@/components/GhostHandGuide';
import FeedbackModal from '@/components/FeedbackModal';
import RecognitionDiagnostics from '@/components/RecognitionDiagnostics';

import { UsageMode, ConversationMessage, SuggestedReply } from '@/types/app';
import { FramePayload, SignLanguageMode, PredictionCandidate } from '@/types/contract';
import { initHandLandmarker, extractLandmarksFromVideo } from '@/lib/mediapipe';
import { SignFlowWebSocketClient, ConnectionStatus } from '@/lib/websocketClient';
import { RecognitionStateMachine, DiagnosticsSnapshot } from '@/lib/stateMachine';
import { TranscriptManager } from '@/lib/transcriptManager';
import { speechEngine } from '@/lib/speech';
import { CONFIG } from '@/lib/config';
import { getSuggestedRepliesForText } from '@/lib/replyCatalogue';
import { runClientInference } from '@/lib/clientClassifier';
import { formatSignDisplay, getSignSpokenText, URDU_ALPHABET_MAP } from '@/lib/urduMapping';
import { formatSentence, formatPreview } from '@/lib/bilingualFormatter';
import { getSignCategory } from '@/lib/signSemantics';

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess_${crypto.randomUUID()}`;
  }
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function SignFlowHome() {
  const [mode, setMode] = useState<UsageMode>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const facingModeRef = useRef<'user' | 'environment'>(facingMode);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  // Unified Sign Recognition Engine (interprets PSL, ASL, and 3D pointing automatically)
  const [selectedLanguage, setSelectedLanguage] = useState<SignLanguageMode>('unified');
  const selectedLanguageRef = useRef<SignLanguageMode>(selectedLanguage);

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  const handleLanguageChange = useCallback((lang: SignLanguageMode) => {
    setSelectedLanguage(lang);
    selectedLanguageRef.current = lang;
    setCandidateSign(null);
    setCandidateConfidence(0);
    stateMachineRef.current?.reset(sessionIdRef.current || undefined);
  }, []);

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
  const autoSpeechEnabledRef = useRef<boolean>(autoSpeechEnabled);

  useEffect(() => {
    autoSpeechEnabledRef.current = autoSpeechEnabled;
  }, [autoSpeechEnabled]);

  const [activeUtterance, setActiveUtterance] = useState<string[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Two-tier continuous recognition state (Gemini API)
  const [provisionalText, setProvisionalText] = useState<string | null>(null);
  const [geminiModel, setGeminiModel] = useState<string>('gemini-flash-latest');
  const [latestSequenceId, setLatestSequenceId] = useState<string | number | undefined>(undefined);
  const [latestUncertainty, setLatestUncertainty] = useState<string | null | undefined>(undefined);

  // Suggested Sign Reply state (exclusively active for 'partner' mode)
  const [activeGhostHandReply, setActiveGhostHandReply] = useState<SuggestedReply | null>(null);

  // Diagnostics & Failure Collection State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [diagnosticsSnapshot, setDiagnosticsSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [latestMargin, setLatestMargin] = useState<number>(0);
  const [latestTopCandidates, setLatestTopCandidates] = useState<PredictionCandidate[]>([]);
  const [latestHandedness, setLatestHandedness] = useState<string>('Right');
  const [latestHandsCount, setLatestHandsCount] = useState<number>(0);

  // Keyboard shortcut: Shift + D toggles diagnostics HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        setIsDiagnosticsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Refs for loop & services
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const wsClientRef = useRef<SignFlowWebSocketClient | null>(null);
  const stateMachineRef = useRef<RecognitionStateMachine | null>(null);
  const transcriptManagerRef = useRef<TranscriptManager | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastConfirmedSentenceRef = useRef<string | null>(null);
  const lastHandsSeenTimeRef = useRef<number>(0);
  const hadHandsRef = useRef<boolean>(false);
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

  // 1. Initialize State Machine and Transcript Manager
  useEffect(() => {
    stateMachineRef.current = new RecognitionStateMachine({
      onCandidatePreview: (sign, confidence, eventSessionId) => {
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
        if (
          !isSessionActiveRef.current ||
          (eventSessionId && eventSessionId !== sessionIdRef.current)
        ) {
          return;
        }
        setLastConfirmedSign(sign);
        setActiveUtterance((prev) => [...prev, sign]);
      },
      onUtteranceComplete: (phrase, rawTokens, eventSessionId) => {
        if (
          !isSessionActiveRef.current ||
          (eventSessionId && eventSessionId !== sessionIdRef.current)
        ) {
          return;
        }

        const confidences = stateMachineRef.current?.getActiveConfidences() || [];
        const formatted = formatSentence(rawTokens, selectedLanguageRef.current, confidences);

        const newMessage: ConversationMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          text: formatted.englishSentence || formatted.rawDisplay || phrase,
          timestamp: Date.now(),
          spoken: autoSpeechEnabledRef.current,
          rawTokens: formatted.rawTokens,
          rawDisplay: formatted.rawDisplay,
          urduSentence: formatted.urduSentence,
          englishSentence: formatted.englishSentence,
          isPatternMatched: formatted.isPatternMatched,
          averageConfidence: formatted.confidence,
        };
        setMessages((prev) => [newMessage, ...prev]);
        setActiveUtterance([]);

        if (autoSpeechEnabledRef.current) {
          speechEngine.speak(formatted.spokenText || formatted.englishSentence || phrase, eventSessionId);
        }

        if (modeRef.current === 'partner') {
          const queryText = formatted.englishSentence || phrase;
          const replies = getSuggestedRepliesForText(queryText);
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

    transcriptManagerRef.current = new TranscriptManager({
      onProvisionalUpdate: (prov) => {
        if (!isSessionActiveRef.current) return;
        setProvisionalText(prov);
      },
      onSentenceConfirmed: (sentence, alternatives) => {
        if (!isSessionActiveRef.current) return;
        lastConfirmedSentenceRef.current = sentence;
        const newMessage: ConversationMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          text: sentence,
          timestamp: Date.now(),
          spoken: autoSpeechEnabledRef.current,
          englishSentence: sentence,
          alternatives: alternatives,
        };
        setMessages((prev) => [newMessage, ...prev]);

        if (autoSpeechEnabledRef.current) {
          speechEngine.speak(sentence, sessionIdRef.current || undefined);
        }

        if (modeRef.current === 'partner') {
          const replies = getSuggestedRepliesForText(sentence);
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
      onStatusChange: (status) => {
        if (!isSessionActiveRef.current) return;
        setStatusText(status);
      },
    }, sessionIdRef.current || undefined);

    return () => {
      stateMachineRef.current?.reset();
      transcriptManagerRef.current?.reset();
    };
  }, []);

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

        if (prediction.model) setGeminiModel(prediction.model);
        if (prediction.sequence_id !== undefined) setLatestSequenceId(prediction.sequence_id);
        if (prediction.uncertainty_reason !== undefined) setLatestUncertainty(prediction.uncertainty_reason);
        if (prediction.margin !== undefined) setLatestMargin(prediction.margin);
        if (prediction.top_candidates) setLatestTopCandidates(prediction.top_candidates);
        if (prediction.handedness) setLatestHandedness(prediction.handedness);
        if (prediction.hands_count !== undefined) setLatestHandsCount(prediction.hands_count);

        if (prediction.sign) {
          setCandidateSign(prediction.sign);
          setCandidateConfidence(prediction.confidence || 0.9);
        }

        // Two-tier continuous interpretation manager (Gemini continuous ASL)
        transcriptManagerRef.current?.processPrediction(prediction);

        stateMachineRef.current?.processPrediction(prediction);
        setDiagnosticsSnapshot(stateMachineRef.current?.getDiagnosticsSnapshot() || null);
      },
      (status) => {
        if (isMounted && sessionIdRef.current === sessionForThisEffect) {
          if (status === 'connected') {
            setServiceStatus('connected');
          } else if (status === 'disconnected') {
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

  // 3. Real-time Video Landmark Processing and Frame Streaming Loop
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
      // ~5 FPS for frame transmission to backend Gemini buffer (200ms throttle interval)
      const throttleInterval = 200;

      if (now - lastFrameTimeRef.current >= throttleInterval) {
        lastFrameTimeRef.current = now;
        frameCounterRef.current += 1;

        // Extract raw landmarks in browser with camera perspective awareness
        const isFrontFacing = facingModeRef.current === 'user';
        const hands = extractLandmarksFromVideo(landmarker, video, now, isFrontFacing);
        const hasHands = hands.length > 0;

        setHandsDetected(hasHands);

        let jpegBase64: string | undefined = undefined;
        let isBoundaryPause = false;

        if (hasHands) {
          lastHandsSeenTimeRef.current = now;
          hadHandsRef.current = true;

          // Draw video to offscreen 640x360 canvas for lightweight JPEG frame
          if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
            offscreenCanvasRef.current.width = 640;
            offscreenCanvasRef.current.height = 360;
          }
          const canvas = offscreenCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            ctx.drawImage(video, 0, 0, 640, 360);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            jpegBase64 = dataUrl.split(',')[1] || dataUrl;
          }
        } else if (hadHandsRef.current) {
          // Detect hand pause/drop (>800ms) to trigger boundary commit
          if (now - lastHandsSeenTimeRef.current >= 800) {
            isBoundaryPause = true;
            hadHandsRef.current = false;
            transcriptManagerRef.current?.handleBoundaryPause();
          }
        }

        // Transmit frame over WebSocket when hands are present or boundary pause occurs
        if (hasHands || isBoundaryPause) {
          const payload: FramePayload = {
            schema_version: '2.0',
            session_id: activeSession,
            frame_id: frameCounterRef.current,
            timestamp: Date.now(),
            image_width: 640,
            image_height: 360,
            hands_detected: hands.length,
            hands: hands,
            language: 'asl_continuous',
            image_data: jpegBase64,
            is_boundary_pause: isBoundaryPause,
            context_sentence: lastConfirmedSentenceRef.current || undefined,
          };

          const sent = wsClient.sendFrame(payload);
          if (!sent) {
            // Fallback client inference if websocket disconnected
            const localPrediction = runClientInference(payload);
            if (localPrediction.margin !== undefined) setLatestMargin(localPrediction.margin);
            if (localPrediction.top_candidates) setLatestTopCandidates(localPrediction.top_candidates);
            if (localPrediction.handedness) setLatestHandedness(localPrediction.handedness);
            if (localPrediction.hands_count !== undefined) setLatestHandsCount(localPrediction.hands_count);

            stateMachineRef.current?.processPrediction(localPrediction);
            setDiagnosticsSnapshot(stateMachineRef.current?.getDiagnosticsSnapshot() || null);
            setServiceStatus((prev) => (prev === 'connected' ? prev : 'edge_active'));
          }
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
      setProvisionalText(null);
      lastConfirmedSentenceRef.current = null;
      hadHandsRef.current = false;
      lastHandsSeenTimeRef.current = 0;
      setHandsDetected(false);
      setStatusText('Ready to sign');
      frameCounterRef.current = 0;
      lastFrameTimeRef.current = 0;

      // 3. Reset state machine, transcript manager, and speech engine to new session
      stateMachineRef.current?.reset(newSessionId);
      transcriptManagerRef.current?.setSessionId(newSessionId);
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

    // 4. Reset state machine, transcript manager, and clear all timers
    stateMachineRef.current?.reset();
    transcriptManagerRef.current?.reset();

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
    setProvisionalText(null);
    lastConfirmedSentenceRef.current = null;
    hadHandsRef.current = false;
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
    setProvisionalText(null);
    lastConfirmedSentenceRef.current = null;
    stateMachineRef.current?.reset(sessionIdRef.current || undefined);
    transcriptManagerRef.current?.reset();
    clearSuggestedRepliesState();
  }, [clearSuggestedRepliesState]);

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleFinishAndSpeak = () => {
    if (provisionalText) {
      transcriptManagerRef.current?.handleBoundaryPause();
    } else {
      stateMachineRef.current?.finishUtterance();
    }
  };

  const handleEditMessage = useCallback((id: string, newText: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? {
              ...msg,
              text: newText,
              englishSentence: newText,
            }
          : msg
      )
    );
  }, []);

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
                Translate signs. Bridge conversations.
              </span>
            </div>
          </div>

          {mode !== null && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Gemini Continuous ASL Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold text-slate-800 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#068D9D] animate-pulse" aria-hidden="true" />
                <span>Gemini ASL Continuous</span>
                <span className="hidden md:inline text-[11px] font-normal text-slate-500">• Flash Latest</span>
              </div>

              {/* Diagnostics HUD Toggle */}
              <button
                onClick={() => setIsDiagnosticsOpen((prev) => !prev)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#068D9D] ${
                  isDiagnosticsOpen
                    ? 'bg-slate-900 text-slate-100 shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                }`}
                aria-label="Toggle developer recognition diagnostics"
                title="Toggle diagnostics mode (Shift+D)"
              >
                <Activity className="w-3.5 h-3.5 text-[#068D9D]" aria-hidden="true" />
                <span className="hidden md:inline">Diagnostics</span>
              </button>

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
                  isRecognizing={candidateSign !== null || Boolean(provisionalText)}
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
                        selectedLanguage={selectedLanguage}
                      />
                    </div>

                    {/* Current Utterance Display Box */}
                    <div
                      className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/70 min-h-[100px] sm:min-h-[110px] flex flex-col justify-center transition-all"
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Current Translation
                        </span>
                        <div className="flex items-center gap-1.5">
                          {candidateSign && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold bg-slate-200/60 px-2 py-0.5 rounded-full capitalize">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#068D9D] animate-pulse" />
                              {getSignCategory(candidateSign)}
                            </span>
                          )}
                          <button
                            onClick={() => setIsFeedbackModalOpen(true)}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Report or flag current prediction"
                            aria-label="Flag sign failure"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {provisionalText ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-[#068D9D] animate-ping" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#068D9D]">
                              Continuous ASL Signing:
                            </span>
                          </div>
                          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-wide break-words pt-0.5">
                            "{provisionalText}"
                          </p>
                        </div>
                      ) : activeUtterance.length > 0 ? (
                        (() => {
                          const preview = formatPreview(activeUtterance, selectedLanguage);
                          const hasUrdu = Boolean(preview.previewUrdu && preview.previewUrdu.trim().length > 0);

                          return (
                            <div className="space-y-2">
                              {/* Accumulated Sign Sequence */}
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tokens:</span>
                                <span className="text-slate-600 font-medium">{preview.rawDisplay}</span>
                              </div>

                              {/* Live Sentence Formation Preview */}
                              {hasUrdu ? (
                                <div className="space-y-0.5 pt-1.5 border-t border-slate-200/60">
                                  <p
                                    dir="rtl"
                                    className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-wide text-right font-serif leading-relaxed"
                                  >
                                    {preview.previewUrdu}
                                  </p>
                                  {preview.previewEnglish && (
                                    <p className="text-xs sm:text-sm font-semibold text-slate-600">
                                      {preview.previewEnglish}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-wide break-words pt-1 border-t border-slate-200/60">
                                  {preview.previewEnglish || activeUtterance.map((s) => formatSignDisplay(s)).join(' ')}
                                </p>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                          {handsDetected
                            ? 'Ready — sign naturally in American Sign Language...'
                            : 'Position hands in the camera frame to start signing...'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Primary Finish & Speak Action */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      onClick={handleFinishAndSpeak}
                      disabled={!provisionalText && activeUtterance.length === 0}
                      className={`min-h-[48px] flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-[#068D9D] ${
                        provisionalText || activeUtterance.length > 0
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
                    provisionalText={provisionalText}
                    onEditMessage={handleEditMessage}
                    onReplay={(text) => {
                      const cleanSpoken = text
                        .split(' ')
                        .map((tok) => {
                          const clean = tok.replace(/[()]/g, '');
                          return getSignSpokenText(clean);
                        })
                        .join(' ');
                      speechEngine.speak(cleanSpoken, currentSessionId || undefined);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Developer Recognition Diagnostics HUD */}
            <RecognitionDiagnostics
              isOpen={isDiagnosticsOpen}
              onClose={() => setIsDiagnosticsOpen(false)}
              snapshot={diagnosticsSnapshot}
              handsDetected={handsDetected}
              handedness={latestHandedness}
              handsCount={latestHandsCount}
              topCandidates={latestTopCandidates}
              rawPrediction={candidateSign}
              rawConfidence={candidateConfidence}
              rawMargin={latestMargin}
              selectedLanguage={selectedLanguage}
              onFlagSample={() => setIsFeedbackModalOpen(true)}
              geminiModel={geminiModel}
              sequenceId={latestSequenceId}
              uncertaintyReason={latestUncertainty}
            />

            {/* Failure Sample Feedback Modal */}
            <FeedbackModal
              isOpen={isFeedbackModalOpen}
              onClose={() => setIsFeedbackModalOpen(false)}
              predictedSign={candidateSign}
              confidence={candidateConfidence}
              margin={latestMargin}
              language={selectedLanguage}
              sessionId={currentSessionId || 'default'}
            />
          </div>
        )}
      </main>
    </div>
  );
}
