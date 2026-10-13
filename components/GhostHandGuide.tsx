'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { SuggestedReply, UsageMode, SignMotionStep } from '@/types/app';

interface GhostHandGuideProps {
  reply: SuggestedReply | null;
  mode: UsageMode;
  onClose: () => void;
}

/**
 * Lifecycle phases:
 * 1. 'animating'  – SVG hand plays through the 2.8s motion once
 * 2. 'holding'    – static hand visible for ~3s after animation completes
 * 3. 'fading'     – opacity transition 1→0 over 300ms
 * 4. 'hidden'     – overlay gone; small Replay pill shown outside camera
 */
type Phase = 'animating' | 'holding' | 'fading' | 'hidden';

export default function GhostHandGuide({
  reply,
  mode,
  onClose,
}: GhostHandGuideProps) {
  const [phase, setPhase] = useState<Phase>('animating');
  const [animationProgress, setAnimationProgress] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReplyIdRef = useRef<string | null>(null);

  // Detect reduced-motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const reference = reply?.reference;
  const motionSteps: SignMotionStep[] = reference?.motionSteps || [];
  const replyId = reply?.id || reply?.referenceId || null;

  // Reset lifecycle when a genuinely new reply arrives
  useEffect(() => {
    if (!replyId || replyId === lastReplyIdRef.current) return;
    lastReplyIdRef.current = replyId;

    // Clear any running timers
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    setAnimationProgress(0);
    startTimeRef.current = performance.now();

    if (prefersReducedMotion) {
      // Skip animation, go directly to holding phase
      setAnimationProgress(1);
      setPhase('holding');
    } else {
      setPhase('animating');
    }
  }, [replyId, prefersReducedMotion]);

  // Animation loop – plays ONCE then transitions to 'holding'
  useEffect(() => {
    if (phase !== 'animating' || !reference || motionSteps.length === 0) return;

    const duration = 2800; // ms

    const loop = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(progress);

      if (progress >= 1) {
        // Animation done → enter hold phase
        setPhase('holding');
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, reference, motionSteps]);

  // Hold phase → start 3s countdown then fade
  useEffect(() => {
    if (phase !== 'holding') return;

    holdTimerRef.current = setTimeout(() => {
      setPhase('fading');
    }, 3000);

    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [phase]);

  // Fading phase → after transition duration, mark hidden
  useEffect(() => {
    if (phase !== 'fading') return;

    const fadeTimer = setTimeout(() => {
      setPhase('hidden');
    }, 320); // slightly longer than the CSS transition (300ms)

    return () => clearTimeout(fadeTimer);
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Replay handler: restart the full lifecycle
  const handleReplay = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    setAnimationProgress(0);
    startTimeRef.current = performance.now();

    if (prefersReducedMotion) {
      setAnimationProgress(1);
      setPhase('holding');
    } else {
      setPhase('animating');
    }
  }, [prefersReducedMotion]);

  // STRICT MODE GUARD
  if (mode !== 'partner' || !reply || !reference) {
    return null;
  }

  // If hidden → show tiny Replay pill at bottom of camera
  if (phase === 'hidden') {
    return (
      <button
        onClick={handleReplay}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/50 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-slate-900/70 transition-all duration-200 text-[10px] font-semibold tracking-wide cursor-pointer select-none"
        aria-label={`Replay sign guide for ${getReplyShortLabel(reply)}`}
      >
        <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
        Replay: {getReplyShortLabel(reply)}
      </button>
    );
  }

  // Determine current motion step and phase
  const hasTwoSteps = motionSteps.length > 1;
  const currentStep =
    hasTwoSteps && animationProgress >= 0.25 ? motionSteps[1] : motionSteps[0] || undefined;
  const trajectory = currentStep?.motionTrajectory || 'steady_hold';

  // Compute calm motion interpolation
  let deltaX = 0;
  let deltaY = 0;
  let rotateDeg = 0;

  if (animationProgress < 0.25) {
    deltaY = Math.sin(animationProgress * Math.PI * 4) * 1.5;
  } else if (animationProgress < 0.8) {
    const t = (animationProgress - 0.25) / 0.55;
    const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);

    if (trajectory === 'temple_outward_arc') {
      deltaX = -4 + 14 * eased;
      deltaY = -6 + 10 * eased;
      rotateDeg = -3 + 7 * eased;
    } else if (trajectory === 'forward_sweep') {
      deltaY = -10 * eased;
      deltaX = 3 * eased;
    } else if (trajectory === 'upward_lift') {
      deltaY = -12 * eased;
      deltaX = 2 * eased;
    } else if (trajectory === 'downward_sweep') {
      deltaY = 10 * eased;
      deltaX = 6 * eased;
      rotateDeg = -4 * eased;
    } else if (trajectory === 'outward_arc') {
      deltaX = 12 * eased;
      deltaY = -4 * eased;
      rotateDeg = 8 * eased;
    } else {
      deltaY = Math.sin(animationProgress * Math.PI * 2) * 1.5;
    }
  } else {
    // Hold values at rest position
    if (trajectory === 'temple_outward_arc') {
      deltaX = 10; deltaY = 4; rotateDeg = 4;
    } else if (trajectory === 'forward_sweep') {
      deltaY = -10; deltaX = 3;
    } else if (trajectory === 'upward_lift') {
      deltaY = -12; deltaX = 2;
    } else if (trajectory === 'downward_sweep') {
      deltaY = 10; deltaX = 6; rotateDeg = -4;
    } else if (trajectory === 'outward_arc') {
      deltaX = 12; deltaY = -4; rotateDeg = 8;
    }
  }

  const shortLabel = getReplyShortLabel(reply);

  // Opacity: full during animating/holding, 0 during fading
  const overlayOpacity = phase === 'fading' ? 0 : 1;

  return (
    <aside
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5 select-none"
      style={{
        opacity: overlayOpacity,
        transition: 'opacity 300ms ease-out',
      }}
      aria-label="Translucent Pakistan Sign Language guide overlay"
    >
      {/* Translucent Grayscale Ghost Hand */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
        <div
          className="relative pointer-events-none"
          style={{
            transform: `translate(${deltaX}px, ${deltaY}px) rotate(${rotateDeg}deg)`,
            transition: prefersReducedMotion ? 'none' : 'transform 50ms ease-out',
            filter: 'drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35))',
          }}
        >
          <GhostHandSvg handPose={currentStep?.handPose || 'open_palm_forward'} />
        </div>
      </div>

      {/* Tiny label */}
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-sm text-slate-100">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#068D9D] shrink-0"
          aria-hidden="true"
        />
        <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-white whitespace-nowrap">
          Reply: {shortLabel}
        </span>
      </div>
    </aside>
  );
}

/**
 * Extracts a concise, clean uppercase label for the single reply badge.
 */
function getReplyShortLabel(reply: SuggestedReply): string {
  const id = reply.referenceId || reply.reference?.id || reply.id || '';
  if (id.includes('hello')) return 'HELLO';
  if (id.includes('thank_you') || id.includes('thanks')) return 'THANK YOU';
  if (id.includes('here_you_go')) return 'HERE YOU GO';
  if (id.includes('here_to_help') || id.includes('help')) return 'HELP';
  if (id.includes('understood')) return 'UNDERSTOOD';
  if (id.includes('welcome')) return 'WELCOME';
  if (id.includes('please_wait') || id.includes('wait')) return 'WAIT';
  if (id.includes('repeat')) return 'REPEAT';
  if (id.includes('anything_else') || id.includes('more')) return 'MORE';
  if (id.includes('what_do_you_need') || id.includes('need')) return 'WHAT NEED';

  if (reply.reference?.pslLabel) {
    return reply.reference.pslLabel.split(/[\/(]/)[0].trim().toUpperCase();
  }
  return reply.text.replace(/^["\"']|["\"'.!?]$/g, '').trim().toUpperCase();
}

/**
 * Natural Translucent Grayscale Hand Silhouette SVGs
 * Anatomically proportioned palm and finger contours in soft neutral gray
 * with 45–50% opacity and subtle contrast contours (no wireframe landmark dots).
 */
function GhostHandSvg({
  handPose,
}: {
  handPose: SignMotionStep['handPose'];
}) {
  const fill = 'rgba(226, 232, 240, 0.48)';
  const stroke = 'rgba(255, 255, 255, 0.7)';
  const creaseStroke = 'rgba(148, 163, 184, 0.5)';

  // Pose A: Two-handed support sign (Dominant fist atop flat non-dominant palm base - Madad / Help)
  if (handPose === 'dominant_fist_on_palm') {
    return (
      <svg
        width="86"
        height="86"
        viewBox="0 0 90 90"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Flat non-dominant supporting palm base */}
        <path
          d="M 12 68 C 12 64 24 62 45 62 C 66 62 78 64 78 68 C 78 73 66 75 45 75 C 24 75 12 73 12 68 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
        />
        <line x1="18" y1="68" x2="72" y2="68" stroke={creaseStroke} strokeWidth="1" />

        {/* Dominant closed fist resting atop base palm */}
        <rect
          x="30"
          y="32"
          width="28"
          height="28"
          rx="8"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
        />
        {/* Thumb pointing upright */}
        <path
          d="M 34 38 C 32 22 36 17 40 17 C 44 17 45 23 43 34"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
        />
        {/* Knuckle creases */}
        <line x1="37" y1="41" x2="52" y2="41" stroke={creaseStroke} strokeWidth="1" />
        <line x1="37" y1="48" x2="52" y2="48" stroke={creaseStroke} strokeWidth="1" />
        <line x1="37" y1="54" x2="52" y2="54" stroke={creaseStroke} strokeWidth="1" />
      </svg>
    );
  }

  // Pose B: Index finger pointing to temple (Samjh gaya / Understood)
  if (handPose === 'point_temple') {
    return (
      <svg
        width="80"
        height="86"
        viewBox="0 0 85 90"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Curled palm base */}
        <path
          d="M 30 84 C 18 78 20 65 22 54 C 24 45 32 43 38 43 C 52 43 62 50 60 66 C 58 78 46 84 30 84 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
        />
        {/* Extended Index Finger */}
        <path
          d="M 32 46 C 32 28 33 13 37 11 C 41 11 42 26 42 46"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
        />
        {/* Knuckle lines on curled fingers */}
        <path d="M 42 48 C 48 46 52 50 52 53" fill="none" stroke={stroke} strokeWidth="1.2" />
        <path d="M 42 55 C 48 53 52 57 52 60" fill="none" stroke={stroke} strokeWidth="1.2" />
        <path d="M 42 62 C 47 60 50 64 50 67" fill="none" stroke={stroke} strokeWidth="1.2" />
        <path d="M 26 59 C 22 52 26 47 34 49" fill="none" stroke={stroke} strokeWidth="1.3" />
      </svg>
    );
  }

  // Pose C: Salam salute near temple (Tilted open hand with fingers together)
  if (handPose === 'salam_temple') {
    return (
      <svg
        width="82"
        height="86"
        viewBox="0 0 90 90"
        className="overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M 46 86 C 32 84 30 74 30 65 C 30 56 25 50 20 45 C 16 41 18 36 22 36 C 27 36 31 40 34 47 C 35 34 37 16 41 13 C 45 10 48 13 48 22 C 50 30 50 41 50 41 C 52 31 54 11 58 9 C 62 7 64 11 64 21 L 64 41 C 66 32 68 14 71 13 C 75 12 77 16 77 25 L 77 44 C 79 37 81 25 84 24 C 88 23 89 27 88 34 C 86 50 82 66 76 74 C 68 83 57 86 46 86 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M 38 54 C 45 61 55 63 68 59" fill="none" stroke={creaseStroke} strokeWidth="1" />
        <path d="M 40 65 C 48 70 58 70 64 66" fill="none" stroke={creaseStroke} strokeWidth="1" />
      </svg>
    );
  }

  // Pose D: Open palm facing upward (Offering / Here you go / Take)
  if (handPose === 'open_palms_up') {
    return (
      <svg
        width="84"
        height="86"
        viewBox="0 0 90 90"
        className="overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M 28 82 C 16 76 14 61 18 48 C 20 41 25 37 30 41 C 32 30 37 23 43 23 C 48 23 50 28 52 37 C 54 26 59 21 64 21 C 70 21 71 28 71 39 C 73 30 78 27 82 28 C 85 30 85 39 82 50 C 76 66 68 80 43 82 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M 28 57 C 39 64 55 64 68 53" fill="none" stroke={creaseStroke} strokeWidth="1.1" />
        <path d="M 20 50 C 13 45 11 36 16 32 C 21 28 25 35 28 43" fill={fill} stroke={stroke} strokeWidth="1.2" />
      </svg>
    );
  }

  // Pose E: Flat hand touching chest / chin (Shukriya / Gratitude)
  if (handPose === 'flat_hand_chest') {
    return (
      <svg
        width="82"
        height="86"
        viewBox="0 0 90 90"
        className="overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M 42 85 C 29 82 25 72 27 63 C 29 54 23 48 18 43 C 14 39 16 34 20 34 C 26 34 29 38 32 45 C 33 32 34 14 38 12 C 41 10 45 12 45 21 L 45 43 C 47 32 49 9 52 7 C 56 5 58 9 58 20 L 58 43 C 59 34 61 12 65 10 C 68 9 71 12 71 23 L 71 45 C 72 38 74 20 77 18 C 81 16 83 20 83 29 C 82 41 79 57 75 66 C 68 77 58 84 42 85 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M 36 55 C 45 62 58 62 68 57" fill="none" stroke={creaseStroke} strokeWidth="1" />
      </svg>
    );
  }

  // Pose F: Curved flexed hand (What do you need / flex)
  if (handPose === 'curved_hands_flex') {
    return (
      <svg
        width="80"
        height="86"
        viewBox="0 0 90 90"
        className="overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M 38 84 C 25 79 23 66 25 55 C 27 46 21 41 16 37 C 12 34 14 30 19 30 C 25 30 28 34 30 41 C 32 32 36 19 41 19 C 46 19 46 27 45 36 C 48 27 52 18 57 18 C 62 18 62 25 61 34 C 64 25 68 20 73 20 C 77 20 77 27 75 36 C 77 30 81 25 84 27 C 88 28 86 37 82 46 C 77 62 68 78 38 84 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M 32 54 C 41 59 55 59 66 52" fill="none" stroke={creaseStroke} strokeWidth="1" />
      </svg>
    );
  }

  // Default Standard Pose: Open Palm Forward (Fingers upright, flat hand toward partner)
  return (
    <svg
      width="82"
      height="86"
      viewBox="0 0 90 90"
      className="overflow-visible"
      aria-hidden="true"
    >
      <path
        d="M 42 86 C 27 84 25 73 25 64 C 25 55 20 49 14 44 C 11 40 12 35 17 35 C 22 35 26 39 29 47 C 30 33 31 14 34 12 C 38 10 41 12 41 21 L 41 43 C 43 32 45 8 48 6 C 52 4 55 8 55 19 L 55 43 C 56 34 58 11 61 10 C 65 8 67 11 67 22 L 67 45 C 68 38 70 20 73 18 C 77 16 80 20 79 28 C 78 41 76 57 73 66 C 68 77 57 84 42 86 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M 32 54 C 41 61 55 61 66 55" fill="none" stroke={creaseStroke} strokeWidth="1" />
      <path d="M 34 64 C 43 70 54 70 63 64" fill="none" stroke={creaseStroke} strokeWidth="1" />
    </svg>
  );
}
