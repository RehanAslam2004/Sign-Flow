'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Maximize2,
  X,
  Hand,
  Info,
} from 'lucide-react';
import { SuggestedReply, UsageMode, SignMotionStep } from '@/types/app';

interface GhostHandGuideProps {
  reply: SuggestedReply | null;
  mode: UsageMode;
  onClose: () => void;
  onOpenDetails?: () => void;
}

export default function GhostHandGuide({
  reply,
  mode,
  onClose,
  onOpenDetails,
}: GhostHandGuideProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [animationProgress, setAnimationProgress] = useState(0); // 0 to 1

  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  const reference = reply?.reference;
  const motionSteps: SignMotionStep[] = reference?.motionSteps || [];
  const currentStep: SignMotionStep | undefined = motionSteps[currentStepIndex];
  const totalSteps = motionSteps.length || 1;

  // Reset step index and animation when reply changes
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPaused(false);
    startTimeRef.current = performance.now();
  }, [reply?.id]);

  // Smooth animation loop for the ghost hand motion
  useEffect(() => {
    if (isPaused || isMinimized || !currentStep) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const duration = 2400; // 2.4s cycle for natural signing tempo

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
  }, [isPaused, isMinimized, currentStep]);

  // STRICT MODE GUARD: Never render if not in partner mode or no reply
  if (mode !== 'partner' || !reply || !reference) {
    return null;
  }

  const handleReplay = () => {
    startTimeRef.current = performance.now();
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
    if (isPaused) {
      startTimeRef.current = performance.now() - animationProgress * 2400;
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      startTimeRef.current = performance.now();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      startTimeRef.current = performance.now();
    }
  };

  // Minimized Floating Pill State
  if (isMinimized) {
    return (
      <div className="absolute bottom-3 right-3 z-30 pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={() => setIsMinimized(false)}
          className="min-h-[44px] px-3.5 py-2 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 text-white shadow-xl flex items-center gap-2.5 backdrop-blur-md group transition-all"
          aria-label="Expand Ghost Hand Guide"
        >
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Hand className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div className="text-left text-xs">
            <span className="font-bold text-slate-200 block truncate max-w-[140px]">
              {reference.pslLabel}
            </span>
            <span className="text-[10px] text-slate-400 block">Tap to expand guide</span>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-white ml-1" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Calculate dynamic motion coordinates based on motionTrajectory and progress
  // progress goes 0 -> 1: 0..0.7 active motion, 0.7..1.0 gentle rest hold
  const eased = Math.sin(Math.min(animationProgress / 0.75, 1) * (Math.PI / 2));
  const trajectory = currentStep?.motionTrajectory || 'steady_hold';

  let deltaX = 0;
  let deltaY = 0;
  let rotateDeg = 0;
  let scale = 1;

  if (trajectory === 'forward_sweep') {
    deltaY = -22 * eased;
    deltaX = 8 * eased;
    scale = 1 + 0.12 * eased; // grows slightly forward toward camera
  } else if (trajectory === 'outward_arc') {
    deltaX = 26 * eased;
    deltaY = -8 * eased;
    rotateDeg = 18 * eased;
  } else if (trajectory === 'upward_lift') {
    deltaY = -28 * eased;
    deltaX = 4 * eased;
    scale = 1 + 0.08 * eased;
  } else if (trajectory === 'downward_sweep') {
    deltaY = 18 * eased;
    deltaX = 14 * eased;
    rotateDeg = -10 * eased;
  } else if (trajectory === 'temple_outward_arc') {
    // Starts near temple and arcs downward and forward
    deltaX = -12 + 28 * eased;
    deltaY = -15 + 24 * eased;
    rotateDeg = -8 + 16 * eased;
    scale = 0.95 + 0.15 * eased;
  } else {
    // steady hold with subtle natural float
    deltaY = Math.sin(animationProgress * Math.PI * 2) * 3;
  }

  return (
    <div
      className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 z-30 w-72 sm:w-80 max-w-[calc(100%-1.25rem)] pointer-events-auto bg-slate-950/88 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-3 sm:p-3.5 text-white flex flex-col gap-2.5 transition-all duration-200 animate-in fade-in zoom-in-95"
      role="region"
      aria-label="AR Ghost Hand Guide for Pakistan Sign Language"
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#068D9D]">
            <Sparkles className="w-3 h-3 text-[#068D9D]" aria-hidden="true" />
            <span>Ghost Hand Coach</span>
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate mt-0.5">
            “{reply.text}”
          </h4>
          <span className="text-[11px] font-semibold text-[#a3a8e2] block truncate">
            PSL: {reference.pslLabel}
          </span>
        </div>

        {/* Window Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMinimized(true)}
            className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center justify-center"
            title="Minimize to floating pill"
            aria-label="Minimize guide"
          >
            <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={onClose}
            className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors flex items-center justify-center"
            title="Close guide"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Visual Canvas: Translucent Grayscale Ghost Hand */}
      <div className="relative w-full h-32 sm:h-36 rounded-xl bg-slate-900/90 border border-slate-800/80 overflow-hidden flex items-center justify-center select-none shadow-inner">
        {/* Subtle background depth grid */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* Directional Path Trajectory Line */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 200 120"
          aria-hidden="true"
        >
          {trajectory !== 'steady_hold' && (
            <path
              d={
                trajectory === 'forward_sweep'
                  ? 'M 100 85 Q 105 60 110 38'
                  : trajectory === 'outward_arc'
                  ? 'M 85 75 Q 115 65 135 55'
                  : trajectory === 'upward_lift'
                  ? 'M 100 90 Q 102 60 106 35'
                  : trajectory === 'downward_sweep'
                  ? 'M 90 40 Q 110 65 130 85'
                  : 'M 75 35 Q 105 55 125 75'
              }
              fill="none"
              stroke="rgba(148, 163, 184, 0.45)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          )}
        </svg>

        {/* The Animated Translucent Grayscale Ghost Hand */}
        <div
          className="relative transition-transform ease-out"
          style={{
            transform: `translate(${deltaX}px, ${deltaY}px) rotate(${rotateDeg}deg) scale(${scale})`,
            transitionDuration: isPaused ? '0ms' : '60ms',
          }}
        >
          <GhostHandSvg handPose={currentStep?.handPose || 'open_palms_up'} />
        </div>

        {/* Overlay Indicator Badge */}
        <div className="absolute top-2 left-2 pointer-events-none">
          <span className="text-[10px] font-medium text-slate-400 bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-[#068D9D] animate-pulse'
              }`}
            />
            <span>{isPaused ? 'Paused' : 'Motion Coach'}</span>
          </span>
        </div>

        {/* Current Motion Cue */}
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none text-center">
          <span className="text-[10px] text-slate-300 font-medium bg-slate-950/80 border border-slate-800/80 px-2 py-0.5 rounded-md backdrop-blur-xs">
            {currentStep?.motionDescription || 'Perform steady hand pose.'}
          </span>
        </div>
      </div>

      {/* Step Instruction Text */}
      <div className="px-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
          <span className="font-semibold text-slate-300">
            Step {currentStep?.stepNumber || 1} of {totalSteps}
          </span>
          <span className="text-[10px] text-[#068D9D] font-medium">
            {currentStep?.label || 'Action'}
          </span>
        </div>
        <p className="text-xs text-slate-200 font-medium leading-snug line-clamp-2">
          {currentStep?.instruction || reference.stepByStep?.[0] || 'Observe hand orientation and imitate.'}
        </p>
      </div>

      {/* Playback & Step Controls Bar */}
      <div className="pt-1 border-t border-slate-800/90 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          {/* Play/Pause */}
          <button
            onClick={handleTogglePause}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center"
            title={isPaused ? 'Resume demonstration' : 'Pause demonstration'}
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Replay */}
          <button
            onClick={handleReplay}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition-colors flex items-center justify-center"
            title="Replay from start"
            aria-label="Replay motion"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Multi-step pagination */}
        {totalSteps > 1 && (
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs text-slate-300">
            <button
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className={`p-1.5 rounded-lg transition-colors ${
                currentStepIndex === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Previous step"
              aria-label="Previous step"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[11px] font-semibold text-slate-200">
              {currentStepIndex + 1}/{totalSteps}
            </span>
            <button
              onClick={handleNextStep}
              disabled={currentStepIndex === totalSteps - 1}
              className={`p-1.5 rounded-lg transition-colors ${
                currentStepIndex === totalSteps - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Next step"
              aria-label="Next step"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Optional Info button for full details modal */}
        {onOpenDetails && (
          <button
            onClick={onOpenDetails}
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
            title="View complete dictionary notes"
          >
            <Info className="w-3 h-3" />
            <span className="hidden sm:inline">Details</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Anatomical 21-Landmark Translucent Grayscale Ghost Hand SVG
 * Features subtle neutral grayscale filaments, joint nodes, and natural hand contours.
 */
function GhostHandSvg({
  handPose,
}: {
  handPose: SignMotionStep['handPose'];
}) {
  // Styles for translucent instructional ghost hand
  const boneStroke = 'rgba(226, 232, 240, 0.72)';
  const boneWidth = '2.2';
  const jointFill = 'rgba(241, 245, 249, 0.9)';
  const jointStroke = 'rgba(100, 116, 139, 0.7)';
  const palmFill = 'rgba(148, 163, 184, 0.16)';
  const palmStroke = 'rgba(203, 213, 225, 0.4)';

  if (handPose === 'dominant_fist_on_palm') {
    // Two-handed support pose: Flat non-dominant palm base + closed dominant fist atop
    return (
      <svg width="110" height="95" viewBox="0 0 110 95" className="overflow-visible" aria-hidden="true">
        {/* Base flat palm */}
        <path
          d="M 15 75 Q 55 70 95 75 Q 98 84 88 86 Q 50 85 15 84 Z"
          fill={palmFill}
          stroke={palmStroke}
          strokeWidth="1.5"
        />
        <line x1="20" y1="78" x2="90" y2="78" stroke={boneStroke} strokeWidth={boneWidth} />
        <circle cx="20" cy="78" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
        <circle cx="55" cy="77" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
        <circle cx="90" cy="78" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

        {/* Fist atop base palm */}
        <rect
          x="38"
          y="35"
          width="36"
          height="32"
          rx="8"
          fill="rgba(148, 163, 184, 0.22)"
          stroke={boneStroke}
          strokeWidth="2"
        />
        {/* Thumb pointing upward on fist */}
        <path
          d="M 44 42 Q 42 22 47 18 Q 52 20 50 35"
          fill="none"
          stroke={boneStroke}
          strokeWidth={boneWidth}
        />
        <circle cx="47" cy="18" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

        {/* Knuckle nodes */}
        <circle cx="45" cy="46" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
        <circle cx="55" cy="45" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
        <circle cx="65" cy="46" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      </svg>
    );
  }

  if (handPose === 'point_temple') {
    // Index finger extended pointing toward temple, other fingers curled
    return (
      <svg width="90" height="95" viewBox="0 0 90 95" className="overflow-visible" aria-hidden="true">
        {/* Palm contour */}
        <path
          d="M 35 85 Q 25 65 30 50 Q 55 48 65 60 Q 60 85 35 85 Z"
          fill={palmFill}
          stroke={palmStroke}
          strokeWidth="1.5"
        />
        {/* Extended Index Finger */}
        <line x1="42" y1="52" x2="42" y2="15" stroke={boneStroke} strokeWidth={boneWidth} />
        <circle cx="42" cy="52" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
        <circle cx="42" cy="33" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
        <circle cx="42" cy="15" r="3" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

        {/* Curled Middle, Ring, Pinky */}
        <path d="M 50 54 Q 55 42 60 48 Q 58 56 50 56" fill="none" stroke={boneStroke} strokeWidth="2" />
        <path d="M 56 56 Q 61 46 66 52 Q 63 60 56 60" fill="none" stroke={boneStroke} strokeWidth="2" />
        <path d="M 62 58 Q 67 50 71 55 Q 68 64 62 64" fill="none" stroke={boneStroke} strokeWidth="2" />

        {/* Curled Thumb */}
        <path d="M 33 60 Q 25 54 28 48 Q 36 50 35 60" fill="none" stroke={boneStroke} strokeWidth="2" />
      </svg>
    );
  }

  // Standard Open Palm / Flat Hand Pose (used for Salam, Thank you, Here you go, Welcome)
  return (
    <svg width="95" height="100" viewBox="0 0 95 100" className="overflow-visible" aria-hidden="true">
      {/* Palm silhouette */}
      <path
        d="M 45 92 Q 22 75 25 48 Q 45 42 70 48 Q 75 75 45 92 Z"
        fill={palmFill}
        stroke={palmStroke}
        strokeWidth="1.5"
      />

      {/* Wrist Node (0) */}
      <circle cx="45" cy="92" r="3" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

      {/* Thumb (1, 2, 3, 4) */}
      <path d="M 35 70 Q 18 58 15 42 Q 18 36 24 38 Q 30 46 35 55" fill="none" stroke={boneStroke} strokeWidth={boneWidth} />
      <circle cx="15" cy="42" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="24" cy="38" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

      {/* Index Finger (5, 6, 7, 8) */}
      <line x1="33" y1="48" x2="31" y2="15" stroke={boneStroke} strokeWidth={boneWidth} />
      <circle cx="33" cy="48" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="32" cy="31" r="2.2" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="31" cy="15" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

      {/* Middle Finger (9, 10, 11, 12) */}
      <line x1="45" y1="45" x2="45" y2="10" stroke={boneStroke} strokeWidth={boneWidth} />
      <circle cx="45" cy="45" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="45" cy="27" r="2.2" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="45" cy="10" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

      {/* Ring Finger (13, 14, 15, 16) */}
      <line x1="57" y1="48" x2="59" y2="16" stroke={boneStroke} strokeWidth={boneWidth} />
      <circle cx="57" cy="48" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="58" cy="32" r="2.2" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="59" cy="16" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />

      {/* Pinky (17, 18, 19, 20) */}
      <line x1="68" y1="52" x2="73" y2="28" stroke={boneStroke} strokeWidth={boneWidth} />
      <circle cx="68" cy="52" r="2.5" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="70" cy="40" r="2.2" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
      <circle cx="73" cy="28" r="2.8" fill={jointFill} stroke={jointStroke} strokeWidth="1" />
    </svg>
  );
}
