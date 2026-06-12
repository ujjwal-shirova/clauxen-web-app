"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, Blocks, ArrowLeft, AudioWaveform } from "lucide-react"; // header icons — back, integrations placeholder, settings, call CTA
import { VoiceSettingsSidebar } from "./voice-settings-sidebar";

interface VoiceCallProps {
  isOpen: boolean;
  onClose: () => void;
}

function VoiceOrb() {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {" "}
      {/* 256×256 orb container — centered in main area */}
      <div className="absolute inset-0 blur-[48px] saturate-[1.5] opacity-30 z-0 bg-gradient-to-br from-[#DD8164] to-[#C8728F] rounded-full animate-pulse" />
      <div className="relative w-full h-full">
        <div
          className="absolute inset-0 bg-gradient-to-tr from-[#DD8164]/40 to-[#C8728F]/40 blur-sm animate-liquid-orb opacity-60"
          style={{ transform: "rotate(45deg)" }}
        />

        <div
          className="absolute inset-4 bg-gradient-to-bl from-[#DD8164]/50 to-[#FAF9F5]/80 blur-xs animate-liquid-orb-slow"
          style={{ transform: "rotate(-30deg)" }}
        />

        <div className="absolute inset-8 bg-gradient-to-br from-[#FAF9F5]/90 via-[#C8728F]/30 to-[#FAF9F5]/90 border border-white/20 shadow-inner animate-liquid-orb" />
      </div>
    </div>
  );
}

export function VoiceCall({ isOpen, onClose }: VoiceCallProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-zinc-50 font-sans animate-in fade-in duration-500">
      {/* Header — fixed top bar, backdrop-blur, back + control buttons */}
      <header className="fixed top-0 left-0 right-0 h-[50px] w-full bg-zinc-50/90 backdrop-blur-md z-[210]">
        <div className="max-w-[1280px] mx-auto h-full px-5 flex items-center justify-between relative">
          <div className="flex items-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] hover:bg-zinc-100 transition-all duration-75 outline-none group"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-800" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-9 h-9 flex flex-col items-center justify-center rounded-[10px] border border-zinc-200 bg-white/50 hover:bg-zinc-100 transition-all duration-75"
              aria-label="Integrations"
            >
              <Blocks className="w-[18px] h-[18px] text-zinc-800" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 flex flex-col items-center justify-center rounded-[10px] border border-zinc-200 bg-white/50 hover:bg-zinc-100 transition-all duration-75"
              aria-label="Settings"
            >
              <Settings className="w-[18px] h-[18px] text-zinc-800" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body — centered VoiceOrb + Start call CTA + integration secondary action */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative bg-zinc-50">
        <div className="w-full max-w-[768px] flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
          <div className="w-full flex flex-col items-center gap-12">
            <div className="relative flex items-center justify-center">
              <VoiceOrb />

              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <button
                  type="button"
                  className="pointer-events-auto flex items-center justify-between w-[144px] h-[44px] bg-white/80 backdrop-blur-xl rounded-full border border-zinc-200 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08)] hover:bg-white hover:shadow-[0_16px_24px_-4px_rgba(16,24,40,0.12)] transition-all group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F0F10] text-white ml-[6px] transition-all duration-300 group-hover:scale-105">
                    <AudioWaveform className="w-4 h-4" />
                  </span>
                  <span className="text-[14px] font-medium text-[#0F0F10] flex-1 text-center pr-3">
                    Start a call
                  </span>
                </button>
              </div>
            </div>

            {/* Integration CTA — secondary action, integrations onboarding placeholder */}
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-2xl rounded-2xl border border-zinc-200 shadow-sm hover:bg-white transition-all text-[#5B5B64] hover:text-zinc-800 group">
              <div className="w-6 h-6 flex items-center justify-center">
                <Blocks className="w-4 h-4 opacity-70 group-hover:opacity-100" />
              </div>
              <span className="text-[14px] font-medium">
                Add your first integration
              </span>
            </button>
          </div>
        </div>

        {/* Footer Legal Link — fixed bottom-left Terms & Conditions */}
        <div className="fixed bottom-4 left-4 z-10">
          <a
            href="#"
            onClick={(event) => event.preventDefault()}
            className="text-[12px] font-medium text-zinc-800/35 hover:text-zinc-800/60 transition-colors py-2 px-3 rounded-lg hover:bg-zinc-100"
          >
            Terms & Conditions
          </a>
        </div>
      </main>

      <VoiceSettingsSidebar
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>,
    document.body,
  );
}
