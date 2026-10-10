'use client';

import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Volume2 } from 'lucide-react';
import LandingSurface from '@/components/LandingSurface';
import CameraViewport from '@/components/CameraViewport';
import { UsageMode } from '@/types/app';

export default function SignFlowHome() {
  const [mode, setMode] = useState<UsageMode>(null);

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
            <button
              onClick={() => setMode(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Mode</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {mode === null ? (
          <LandingSurface onSelectMode={(selectedMode) => setMode(selectedMode)} />
        ) : (
          <div className="max-w-6xl mx-auto w-full px-4 py-6 flex-1 flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
              {/* Left Column: Live Camera Viewport */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <CameraViewport
                  mode={mode}
                  statusText="Ready to Sign"
                  isRecognizing={false}
                  handsDetected={false}
                />
                <div className="flex items-center justify-between px-2 text-xs text-slate-500">
                  <span>Mode: {mode === 'signing' ? "I'm the one signing (Front Camera)" : "Someone with me is signing (Rear Camera)"}</span>
                  <span className="text-[#068D9D] font-medium">Real-time local processing</span>
                </div>
              </div>

              {/* Right Column: Active Translation Panel (Slices 1 UI shell) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Active Translation
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#53599A] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                        <Sparkles className="w-3 h-3" />
                        PSL Model Ready
                      </span>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 min-h-[120px] flex items-center justify-center text-center">
                      <p className="text-slate-400 text-sm">
                        Waiting for signing to begin...
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      disabled
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-100 text-slate-400 font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Speak Translation</span>
                    </button>
                  </div>
                </div>

                {/* Session Transcript Preview */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Conversation Transcript
                  </h3>
                  <div className="text-xs text-slate-400 italic py-4 text-center">
                    No confirmed messages in this session yet.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
