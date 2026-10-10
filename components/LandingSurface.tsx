'use client';

import React from 'react';
import { Camera, Users, ShieldCheck, Sparkles } from 'lucide-react';
import { UsageMode } from '@/types/app';

interface LandingSurfaceProps {
  onSelectMode: (mode: 'signing' | 'partner') => void;
}

export default function LandingSurface({ onSelectMode }: LandingSurfaceProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 max-w-4xl mx-auto w-full">
      {/* Brand Header */}
      <div className="text-center mb-10 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100 text-[#068D9D] text-sm font-semibold mb-6">
          <Sparkles className="w-4 h-4" />
          <span>Pakistan Sign Language Bridge</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Let’s make conversation flow
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          SignFlow translates live sign language into clear text and natural speech,
          helping deaf and hearing conversation partners connect easily.
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-10">
        {/* Mode A: I'm the one signing */}
        <button
          onClick={() => onSelectMode('signing')}
          className="group text-left p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-[#068D9D] hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-xl bg-cyan-50 text-[#068D9D] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <Camera className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-[#068D9D] transition-colors">
              I’m the one signing
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Sign directly in front of the camera. Your signs will be translated into readable text and spoken aloud for your conversation partner.
            </p>
          </div>
          <div className="inline-flex items-center text-sm font-semibold text-[#068D9D] group-hover:translate-x-1 transition-transform">
            <span>Start with front camera</span>
            <span className="ml-1.5 font-bold">→</span>
          </div>
        </button>

        {/* Mode B: Someone with me is signing */}
        <button
          onClick={() => onSelectMode('partner')}
          className="group text-left p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-[#53599A] hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-xl bg-purple-50 text-[#53599A] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <Users className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-[#53599A] transition-colors">
              Someone with me is signing
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Point your camera toward your conversation partner. Read their translated message on your screen and listen to the spoken output.
            </p>
          </div>
          <div className="inline-flex items-center text-sm font-semibold text-[#53599A] group-hover:translate-x-1 transition-transform">
            <span>Start with rear camera</span>
            <span className="ml-1.5 font-bold">→</span>
          </div>
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2.5 text-xs text-slate-500 bg-slate-100/80 px-4 py-2.5 rounded-full border border-slate-200">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Privacy first: Camera frames are processed strictly in real time and are never recorded or stored.</span>
      </div>
    </div>
  );
}
