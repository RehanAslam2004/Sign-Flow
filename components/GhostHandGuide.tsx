'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { SuggestedReply, UsageMode, SignMotionStep } from '@/types/app';

interface GhostHandGuideProps {
  reply: SuggestedReply | null;
  mode: UsageMode;
  onClose: () => void;
}

export default function GhostHandGuide({
  reply,
  mode,
  onClose,
}: GhostHandGuideProps) {
  const [animationProgress, setAnimationProgress] = useState(0); // 0 to 1
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  const reference = reply?.reference;
  const motionSteps: SignMotionStep[] = reference?.motionSteps || [];

  // Reset animation when reply changes
  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [reply?.id]);

  // Smooth continuous animation loop
  useEffect(() => {
    if (!reference || motionSteps.length === 0) return;

    const duration = 2800; // 2.8s natural cycle for full sign phrase demonstration

    const loop = (now: number) => {
      const elapsed = (now - startTimeRef.current) % duration;
      const progress = elapsed / duration;
      setAnimationProgress(progress);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [reference, motionSteps]);

  // STRICT MODE GUARD: Never render if not in partner mode or no reply/reference
  if (mode !== 'partner' || !reply || !reference) {
    return null;
  }

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTimeRef.current = performance.now();
  };

  // Determine current motion step and phase
  // Phase 1 (0.00 - 0.25): Initial Preparatory Pose (Step 1)
  // Phase 2 (0.25 - 0.80): Dynamic Motion Stroke (Step 2)
  // Phase 3 (0.80 - 1.00): Gentle Hold on completed pose
  const hasTwoSteps = motionSteps.length > 1;
  const currentStep =
    hasTwoSteps && animationProgress >= 0.25 ? motionSteps[1] : motionSteps[0] || undefined;
  const trajectory = currentStep?.motionTrajectory || 'steady_hold';

  // Compute smooth motion interpolation
  let deltaX = 0;
  let deltaY = 0;
  let rotateDeg = 0;
  let scale = 1;

  if (animationProgress < 0.25) {
    // Prep stage: subtle breathing micro-float
    deltaY = Math.sin(animationProgress * Math.PI * 4) * 2;
  } else if (animationProgress < 0.8) {
    // Active motion stage: smooth sinusoidal ease-in-out
    const t = (animationProgress - 0.25) / 0.55;
    const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);

    if (trajectory === 'temple_outward_arc') {
      // Starts near temple and arcs smoothly outward and forward toward partner
      deltaX = -10 + 26 * eased;
      deltaY = -12 + 20 * eased;
      rotateDeg = -6 + 14 * eased;
      scale = 0.95 + 0.12 * eased;
    } else if (trajectory === 'forward_sweep') {
      // Glides forward toward partner
      deltaY = -18 * eased;
      deltaX = 6 * eased;
      scale = 1 + 0.14 * eased;
    } else if (trajectory === 'upward_lift') {
      // Lifts upward in cooperative support
      deltaY = -22 * eased;
      deltaX = 3 * eased;
      scale = 1 + 0.08 * eased;
    } else if (trajectory === 'downward_sweep') {
      // Sweeps gently downward and outward
      deltaY = 16 * eased;
      deltaX = 14 * eased;
      rotateDeg = -8 * eased;
    } else if (trajectory === 'outward_arc') {
      // Rotates outward
      deltaX = 22 * eased;
      deltaY = -6 * eased;
      rotateDeg = 16 * eased;
    } else {
      deltaY = Math.sin(animationProgress * Math.PI * 2) * 2.5;
    }
  } else {
    // Hold stage: resting at final completion position
    if (trajectory === 'temple_outward_arc') {
      deltaX = 16;
      deltaY = 8;
      rotateDeg = 8;
      scale = 1.07;
    } else if (trajectory === 'forward_sweep') {
      deltaY = -18;
      deltaX = 6;
      scale = 1.14;
    } else if (trajectory === 'upward_lift') {
      deltaY = -22;
      deltaX = 3;
      scale = 1.08;
    } else if (trajectory === 'downward_sweep') {
      deltaY = 16;
      deltaX = 14;
      rotateDeg = -8;
    } else if (trajectory === 'outward_arc') {
      deltaX = 22;
      deltaY = -6;
      rotateDeg = 16;
    }
  }

  // Format clean compact display label (e.g. "Sign: SALAM / HELLO" or "Sign: SHUKRIYA")
  const rawPsl = reference.pslLabel.split('(')[0].trim();
  const labelText = `Sign: ${rawPsl}`;

  return (
    <aside
      className="absolute bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5 z-30 pointer-events-none flex flex-col items-end gap-1 select-none animate-in fade-in duration-200"
      aria-label="Translucent Pakistan Sign Language guide overlay"
    >
      {/* 1. Translucent Grayscale Ghost Hand Silhouette */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
        <div
          className="relative transition-transform ease-out pointer-events-none"
          style={{
            transform: `translate(${deltaX}px, ${deltaY}px) rotate(${rotateDeg}deg) scale(${scale})`,
            transitionDuration: '50ms',
            filter: 'drop-shadow(0 3px 8px rgba(0, 0, 0, 0.55))',
          }}
        >
          <GhostHandSvg handPose={currentStep?.handPose || 'open_palm_forward'} />
        </div>
      </div>

      {/* 2. Single Compact Pill Label */}
      <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/15 text-white shadow-lg">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#068D9D] shrink-0"
          aria-hidden="true"
        />
        <span className="text-[11px] font-bold tracking-tight text-white uppercase whitespace-nowrap">
          {labelText}
        </span>

        {/* Minimal Replay Trigger */}
        <button
          onClick={handleReplay}
          className="p-1 -mr-0.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Replay demonstration"
          aria-label="Replay sign demonstration"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>

        {/* Minimal Dismiss Trigger */}
        <button
          onClick={onClose}
          className="p-1 -mr-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
          title="Dismiss guide"
          aria-label="Dismiss sign guide"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    </aside>
  );
}

/**
 * Natural Translucent Grayscale Hand Silhouette SVGs
 * Anatomically proportioned palm and finger contours in translucent slate-gray
 * with soft natural highlights and inner creases (no wireframe landmark dots).
 */
function GhostHandSvg({
  handPose,
}: {
  handPose: SignMotionStep['handPose'];
}) {
  const fill = 'rgba(218, 226, 236, 0.45)';
  const stroke = 'rgba(248, 250, 252, 0.9)';
  const creaseStroke = 'rgba(148, 163, 184, 0.55)';
  const shadowFill = 'rgba(100, 116, 139, 0.25)';

  // Pose A: Two-handed support sign (Dominant fist atop flat non-dominant palm base - Madad / Help)
  if (handPose === 'dominant_fist_on_palm') {
    return (
      <svg
        width="96"
        height="96"
        viewBox="0 0 100 100"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Flat non-dominant supporting palm base */}
        <path
          d="M 12 76 C 12 72 25 70 50 70 C 75 70 88 72 88 76 C 88 82 75 84 50 84 C 25 84 12 82 12 76 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
        />
        <line x1="20" y1="76" x2="80" y2="76" stroke={creaseStroke} strokeWidth="1.2" />

        {/* Dominant closed fist resting atop base palm */}
        <rect
          x="34"
          y="36"
          width="32"
          height="32"
          rx="9"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
        />
        {/* Thumb pointing upright */}
        <path
          d="M 38 42 C 36 24 40 18 45 18 C 50 18 51 25 48 38"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
        />
        {/* Curled finger knuckle creases */}
        <line x1="42" y1="46" x2="60" y2="46" stroke={creaseStroke} strokeWidth="1.2" />
        <line x1="42" y1="54" x2="60" y2="54" stroke={creaseStroke} strokeWidth="1.2" />
        <line x1="42" y1="62" x2="60" y2="62" stroke={creaseStroke} strokeWidth="1.2" />
      </svg>
    );
  }

  // Pose B: Index finger pointing to temple (Samjh gaya / Comprehension)
  if (handPose === 'point_temple') {
    return (
      <svg
        width="88"
        height="96"
        viewBox="0 0 90 100"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Curled palm base */}
        <path
          d="M 32 94 C 20 86 22 72 24 60 C 26 50 34 48 42 48 C 58 48 68 56 66 74 C 64 88 50 94 32 94 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
        />
        {/* Extended Index Finger */}
        <path
          d="M 34 52 C 34 32 35 14 40 12 C 45 12 46 30 46 52"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
        />
        {/* Joint creases on index finger */}
        <line x1="36" y1="36" x2="44" y2="36" stroke={creaseStroke} strokeWidth="1" />
        <line x1="36" y1="24" x2="44" y2="24" stroke={creaseStroke} strokeWidth="1" />

        {/* Curled Middle, Ring, Pinky knuckle ridges */}
        <path d="M 46 54 C 54 52 58 56 58 60" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path d="M 46 62 C 54 60 58 64 58 68" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path d="M 46 70 C 52 68 56 72 56 76" fill="none" stroke={stroke} strokeWidth="1.4" />

        {/* Curled thumb over knuckles */}
        <path
          d="M 28 66 C 24 58 28 52 38 54"
          fill="none"
          stroke={stroke}
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  // Pose C: Salam salute near temple (Tilted open hand with fingers together)
  if (handPose === 'salam_temple') {
    return (
      <svg
        width="92"
        height="96"
        viewBox="0 0 100 100"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Natural tilted open hand silhouette */}
        <path
          d="M 52 96 C 36 94 33 82 34 72 C 34 62 28 56 22 50 C 18 46 20 40 25 40 C 31 40 35 44 38 52 C 39 38 41 18 46 15 C 50 12 54 15 54 25 C 56 34 56 46 56 46 C 58 35 60 12 65 10 C 69 8 72 12 72 24 C 72 36 72 46 72 46 C 74 36 76 16 80 15 C 84 14 86 18 86 28 C 86 42 84 50 84 50 C 86 42 88 28 92 27 C 96 26 98 30 97 38 C 95 56 90 74 84 82 C 76 92 64 96 52 96 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Subtle palm lifelines */}
        <path
          d="M 42 60 C 50 68 62 70 76 66"
          fill="none"
          stroke={creaseStroke}
          strokeWidth="1.2"
        />
        <path
          d="M 44 72 C 54 78 66 78 72 74"
          fill="none"
          stroke={creaseStroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  // Pose D: Open palm facing upward (Offering / Here you go / Welcome)
  if (handPose === 'open_palms_up') {
    return (
      <svg
        width="96"
        height="96"
        viewBox="0 0 100 100"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Foreshortened palm cup facing upward */}
        <path
          d="M 32 92 C 18 85 16 68 20 54 C 22 46 28 42 34 46 C 36 34 42 26 48 26 C 54 26 56 32 58 42 C 60 30 66 24 72 24 C 78 24 80 32 80 44 C 82 34 88 30 92 32 C 96 34 96 44 92 56 C 86 74 76 90 48 92 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Palm cup shading */}
        <path
          d="M 32 64 C 44 72 62 72 76 60"
          fill="none"
          stroke={creaseStroke}
          strokeWidth="1.3"
        />
        {/* Thumb projecting outward */}
        <path
          d="M 22 56 C 14 50 12 40 18 36 C 24 32 28 40 32 48"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  // Pose E: Flat hand touching chest / chin (Shukriya / Gratitude)
  if (handPose === 'flat_hand_chest') {
    return (
      <svg
        width="92"
        height="96"
        viewBox="0 0 100 100"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Hand resting flat inward */}
        <path
          d="M 46 95 C 32 92 28 80 30 70 C 32 60 26 54 20 48 C 16 44 18 38 23 38 C 29 38 33 42 36 50 C 37 36 38 16 42 14 C 46 12 50 14 50 24 L 50 48 C 52 36 54 10 58 8 C 62 6 65 10 65 22 L 65 48 C 66 38 68 14 72 12 C 76 10 79 14 79 26 L 79 50 C 80 42 82 22 86 20 C 90 18 93 22 92 32 C 91 46 88 64 84 74 C 76 86 64 94 46 95 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Natural palm creases */}
        <path
          d="M 40 62 C 50 70 65 70 76 64"
          fill="none"
          stroke={creaseStroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  // Pose F: Curved flexed hand (What do you need / flex)
  if (handPose === 'curved_hands_flex') {
    return (
      <svg
        width="90"
        height="96"
        viewBox="0 0 100 100"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Cupped curving fingers */}
        <path
          d="M 42 94 C 28 88 26 74 28 62 C 30 52 24 46 18 42 C 14 38 16 34 22 34 C 28 34 32 38 34 46 C 36 36 40 22 46 22 C 52 22 52 30 50 40 C 54 30 58 20 64 20 C 70 20 70 28 68 38 C 72 28 76 22 82 22 C 86 22 86 30 84 40 C 86 34 90 28 94 30 C 98 32 96 42 92 52 C 86 70 76 88 42 94 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M 36 60 C 46 66 62 66 74 58"
          fill="none"
          stroke={creaseStroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  // Default Standard Pose: Open Palm Forward (Fingers upright, flat hand toward partner)
  return (
    <svg
      width="92"
      height="96"
      viewBox="0 0 100 100"
      className="overflow-visible"
      aria-hidden="true"
    >
      {/* Natural open palm forward silhouette */}
      <path
        d="M 46 96 C 30 94 28 82 28 72 C 28 62 22 55 16 49 C 12 45 14 39 19 39 C 25 39 29 43 32 52 C 33 37 34 16 38 14 C 42 11 46 14 46 24 L 46 48 C 48 36 50 9 54 7 C 58 5 61 9 61 21 L 61 48 C 62 38 64 13 68 11 C 72 9 75 13 75 25 L 75 50 C 76 42 78 22 82 20 C 86 18 89 22 88 32 C 87 46 85 64 82 74 C 76 86 64 94 46 96 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Palm lifeline contours */}
      <path
        d="M 36 60 C 46 68 62 68 74 62"
        fill="none"
        stroke={creaseStroke}
        strokeWidth="1.2"
      />
      <path
        d="M 38 72 C 48 78 60 78 70 72"
        fill="none"
        stroke={creaseStroke}
        strokeWidth="1.1"
      />
    </svg>
  );
}
