'use client';

import React from 'react';
import { SignLanguageMode } from '@/types/contract';

interface LanguageSwitcherProps {
  selectedLanguage: SignLanguageMode;
  onSelectLanguage: (language: SignLanguageMode) => void;
  disabled?: boolean;
}

interface LanguageOption {
  id: SignLanguageMode;
  flag: string;
  label: string;
  description: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'psl_words',
    flag: '🇵🇰',
    label: 'PSL Words',
    description: '12 Conversational Signs',
  },
  {
    id: 'psl_alphabets',
    flag: '🇵🇰',
    label: 'Urdu Letters',
    description: '37 Urdu Alphabets',
  },
  {
    id: 'asl',
    flag: '🇺🇸',
    label: 'ASL',
    description: '36 Letters & Numbers',
  },
];

export default function LanguageSwitcher({
  selectedLanguage,
  onSelectLanguage,
  disabled = false,
}: LanguageSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Sign Language Mode Selector"
      className="inline-flex items-center p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl shadow-xs"
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const isSelected = selectedLanguage === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelectLanguage(option.id)}
            title={option.description}
            className={`min-h-[32px] sm:min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#068D9D] ${
              isSelected
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="text-xs sm:text-sm shrink-0 leading-none" aria-hidden="true">
              {option.flag}
            </span>
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
