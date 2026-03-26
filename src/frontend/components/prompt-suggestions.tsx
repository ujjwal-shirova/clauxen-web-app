'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code2, Heart, PenTool, Sparkles } from 'lucide-react';

interface PromptSuggestionsProps {
  category: string;
  onClose: () => void;
  onSelect: (suggestion: string) => void;
}

const suggestionConfig = {
  Write: {
    icon: PenTool,
    suggestions: [
      'Research topics for my writing',
      'Compare my writing style to famous authors',
      'Create social media posts',
      'Develop editorial guidelines',
      'Improve my writing style',
    ],
  },
  Learn: {
    icon: BookOpen,
    suggestions: [
      'Explain a topic from scratch',
      'Build a study plan for me',
      'Quiz me on what I just learned',
      'Break down a complex concept simply',
      'Compare two ideas side by side',
    ],
  },
  Code: {
    icon: Code2,
    suggestions: [
      'Debug an error step by step',
      'Generate a component or function',
      'Explain a block of code clearly',
      'Refactor code for readability',
      'Plan a feature implementation',
    ],
  },
  'Life stuff': {
    icon: Heart,
    suggestions: [
      'Plan my day more effectively',
      'Help me write a thoughtful message',
      'Organize a personal decision',
      'Create a simple routine for me',
      'Talk through a stressful situation',
    ],
  },
  "Clauxen's choice": {
    icon: Sparkles,
    suggestions: [
      'Surprise me with something useful',
      'Give me a creative challenge',
      'Suggest a project I can start today',
      'Recommend something fun to explore',
      'Help me do something unexpectedly helpful',
    ],
  },
} as const;

export function PromptSuggestions({ category, onClose, onSelect }: PromptSuggestionsProps) {
  const config = suggestionConfig[category as keyof typeof suggestionConfig] ?? suggestionConfig.Write;
  const Icon = config.icon;

  return (
    <motion.div
      key="suggestions"
      initial={{ opacity: 0, height: 0, scale: 0.98 }}
      animate={{ opacity: 1, height: 'auto', scale: 1 }}
      exit={{ opacity: 0, height: 0, scale: 0.98 }}
      transition={{ 
        duration: 0.3, 
        ease: [0.4, 0, 0.2, 1] 
      }}
      className="w-full overflow-hidden"
    >
      <div className="w-full bg-white border border-[#1f1e1d]/15 rounded-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] font-sans mt-2">
        <div className="flex items-center justify-between p-2 px-4">
          <div className="flex items-center gap-2 text-[#73726c]">
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-[12px] font-medium uppercase tracking-wide">{category}</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#3d3d3a] transition-all"
            aria-label="Close suggestions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
            </svg>
          </button>
        </div>

        <ul className="flex flex-col" role="listbox">
          {config.suggestions.map((suggestion, index) => (
            <li key={index} className="border-t border-[#1f1e1d]/15">
              <button 
                onClick={() => onSelect(suggestion)}
                className="w-full flex items-center justify-between py-[10px] px-4 hover:bg-black/[0.02] transition-colors group text-left"
              >
                <span className="text-[14px] text-[#3d3d3a] leading-[20px] font-[430]">{suggestion}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className="text-[#73726c] opacity-0 group-hover:opacity-100 transition-all">
                  <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
