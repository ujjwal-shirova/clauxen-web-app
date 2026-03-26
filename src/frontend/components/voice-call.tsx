'use client';

import React, { useState } from 'react';
import { Settings, Blocks, ArrowLeft, AudioWaveform } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';
import { VoiceSettingsSidebar } from './voice-settings-sidebar';

interface VoiceCallProps {
  isOpen: boolean;
  onClose: () => void;
}

function VoiceOrb() {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Background Glow Aura */}
      <div className="absolute inset-0 blur-[48px] saturate-[1.5] opacity-30 z-0 bg-gradient-to-br from-[#DD8164] to-[#C8728F] rounded-full animate-pulse" />
      
      {/* Animated Layers */}
      <div className="relative w-full h-full">
        {/* Layer 1 - Deepest */}
        <div 
          className="absolute inset-0 bg-gradient-to-tr from-[#DD8164]/40 to-[#C8728F]/40 blur-sm animate-liquid-orb opacity-60"
          style={{ transform: 'rotate(45deg)' }}
        />
        
        {/* Layer 2 - Middle */}
        <div 
          className="absolute inset-4 bg-gradient-to-bl from-[#DD8164]/50 to-[#FAF9F5]/80 blur-xs animate-liquid-orb-slow"
          style={{ transform: 'rotate(-30deg)' }}
        />
        
        {/* Layer 3 - Surface */}
        <div 
          className="absolute inset-8 bg-gradient-to-br from-[#FAF9F5]/90 via-[#C8728F]/30 to-[#FAF9F5]/90 border border-white/20 shadow-inner animate-liquid-orb"
        />
      </div>
    </div>
  );
}

export function VoiceCall({ isOpen, onClose }: VoiceCallProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#FAF9F5] flex flex-col animate-in fade-in duration-500 font-sans overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[50px] w-full bg-[#FAF9F5]/90 backdrop-blur-md z-[210]">
        <div className="max-w-[1280px] mx-auto h-full px-5 flex items-center justify-between relative">
          
          {/* Left Section: Back Button */}
          <div className="flex items-center">
            <button 
              onClick={onClose}
              className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] hover:bg-black/5 transition-all duration-75 outline-none group"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#3D3D3A]" />
            </button>
          </div>

          {/* Right Section: Control Group */}
          <div className="flex items-center gap-3">
            <button 
              className="w-9 h-9 flex flex-col items-center justify-center rounded-[10px] border border-[#1F1E1D]/10 bg-white/50 hover:bg-black/5 transition-all duration-75"
              aria-label="Integrations"
            >
              <Blocks className="w-[18px] h-[18px] text-[#3D3D3A]" />
            </button>
            <button 
              onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 flex flex-col items-center justify-center rounded-[10px] border border-[#1F1E1D]/10 bg-white/50 hover:bg-black/5 transition-all duration-75"
              aria-label="Settings"
            >
              <Settings className="w-[18px] h-[18px] text-[#3D3D3A]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative bg-[#FAF9F5]">
        <div className="w-full max-w-[768px] flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
          
          <div className="w-full flex flex-col items-center gap-12">
            {/* Visualization Area with Orb */}
            <div className="relative flex items-center justify-center">
              <VoiceOrb />

              {/* Start a call button */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <button className="pointer-events-auto flex items-center justify-between w-[144px] h-[44px] bg-white/80 backdrop-blur-xl rounded-full border border-[#1F1E1D]/10 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08)] hover:bg-white hover:shadow-[0_16px_24px_-4px_rgba(16,24,40,0.12)] transition-all group">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F0F10] text-white ml-[6px] transition-all duration-300 group-hover:scale-105">
                    <AudioWaveform className="w-4 h-4" />
                  </span>
                  <span className="text-[14px] font-medium text-[#0F0F10] flex-1 text-center pr-3">Start a call</span>
                </button>
              </div>
            </div>

            {/* Integration CTA */}
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-2xl rounded-2xl border border-[#1F1E1D]/10 shadow-sm hover:bg-white transition-all text-[#5B5B64] hover:text-[#3D3D3A] group">
              <div className="w-6 h-6 flex items-center justify-center">
                <Blocks className="w-4 h-4 opacity-70 group-hover:opacity-100" />
              </div>
              <span className="text-[14px] font-medium">Add your first integration</span>
            </button>
          </div>
        </div>

        {/* Footer Legal Link */}
        <div className="fixed bottom-4 left-4 z-10">
          <a 
            href="#" 
            className="text-[12px] font-medium text-[#3D3D3A]/35 hover:text-[#3D3D3A]/60 transition-colors py-2 px-3 rounded-lg hover:bg-black/5"
          >
            Terms & Conditions
          </a>
        </div>
      </main>

      <VoiceSettingsSidebar open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
