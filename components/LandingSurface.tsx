'use client';

import React from 'react';
import { Camera, Users, ShieldCheck, ArrowRight } from 'lucide-react';
import { UsageMode } from '@/types/app';

interface LandingSurfaceProps {
  onSelectMode: (mode: 'signing' | 'partner') => void;
}

export default function LandingSurface({ onSelectMode }: LandingSurfaceProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-14 max-w-4xl mx-auto w-full">
      {/* Brand Header */}
      <div className="text-center mb-8 sm:mb-12 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200/60 text-[#068D9D] text-xs font-semibold tracking-wide uppercase mb-4 sm:mb-5">
          <span>Pakistan Sign Language Bridge</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-3 sm:mb-4 leading-tight">
          Let’s make conversation flow
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-lg mx-auto">
          SignFlow translates live sign language into clear text and natural speech,
          helping deaf signers and hearing conversation partners connect easily.
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full mb-8 sm:mb-10">
        {/* Mode A: I'm the one signing */}
        <button
          onClick={() => onSelectMode('signing')}
          className="group text-left p-5 sm:p-7 rounded-2xl bg-white border-2 border-slate-200 hover:border-[#068D9D] hover:shadow-md transition-all duration-200 flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-[#068D9D] focus-visible:ring-offset-2"
        >
          <div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-cyan-50 text-[#068D9D] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
              <Camera className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 group-hover:text-[#068D9D] transition-colors">
              I’m the one signing
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
              Sign directly in front of the camera. Your signs will be translated into readable text and spoken aloud for your conversation partner.
            </p>
          </div>
          <div className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#068D9D] group-hover:translate-x-1 transition-transform">
            <span>Start with front camera</span>
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </div>
        </button>

        {/* Mode B: Someone with me is signing */}
        <button
          onClick={() => onSelectMode('partner')}
          className="group text-left p-5 sm:p-7 rounded-2xl bg-white border-2 border-slate-200 hover:border-[#53599A] hover:shadow-md transition-all duration-200 flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-[#53599A] focus-visible:ring-offset-2"
        >
          <div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-purple-50 text-[#53599A] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
              <Users className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            </div>
            <h2 className="text-2xl sm:text-2xl font-bold text-slate-900 mb-2 group-hover:text-[#53599A] transition-colors">
              Someone with me is signing
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
              Point your camera toward your conversation partner. Read their translated message on your screen and listen to the spoken output.
            </p>
          </div>
          <div className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#53599A] group-hover:translate-x-1 transition-transform">
            <span>Start with rear camera</span>
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </div>
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2.5 text-xs text-slate-500 bg-slate-100/90 px-4 py-2.5 rounded-full border border-slate-200/80 text-center max-w-md">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>Privacy first: Camera frames are processed in real time and never recorded or stored.</span>
      </div>
    </div>
  );
}
