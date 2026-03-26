'use client';

import React from 'react';
import { 
  Settings, 
  Settings2, 
  ChevronDown, 
  Play, 
  ChevronsUpDown,
  Plus
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/frontend/components/ui/sheet";
import { Slider } from "@/frontend/components/ui/slider";
import { cn } from '@/frontend/lib/utils';

interface VoiceSettingsSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceSettingsSidebar({ open, onOpenChange }: VoiceSettingsSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[480px] sm:max-w-[480px] p-0 bg-[#FAF9F5] border-l border-[#1F1E1D]/10 flex flex-col outline-none gap-0"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 p-5 pb-3 text-left">
          <SheetTitle className="flex items-center gap-3 text-[18px] font-medium text-[#1F1E1D] leading-[26px] tracking-[-0.045px]">
            <div className="w-9 h-9 flex items-center justify-center bg-white border border-[#1F1E1D]/10 rounded-lg shadow-sm">
              <Settings className="w-[18px] h-[18px] text-[#3D3D3A] opacity-50" />
            </div>
            <span>Agent Settings</span>
            <span className="ml-auto px-2 py-1 bg-[#1F1E1D]/5 text-[#73726C] text-[12px] font-medium rounded-full tracking-[0.03px]">
              Saved
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Customize your voice agent's behavior, voice, and appearance.
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pt-4">
          <form className="flex flex-col gap-4">
            {/* Voice Section */}
            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2">
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-[#1F1E1D] flex items-center gap-1">
                    Voice <Settings2 className="w-[18px] h-[18px] opacity-50" />
                  </p>
                  <p className="text-[14px] text-[#73726C] leading-relaxed">
                    Select the ElevenLabs voice you want to use for the agent.
                  </p>
                </div>

                <button 
                  type="button"
                  className="w-full flex items-center justify-between h-10 px-3 bg-white border border-[#1F1E1D]/10 rounded-lg shadow-sm hover:bg-[#F0EEE6] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden bg-[#F0EEE6]">
                      <img 
                        src="https://11.ai/app_assets/image_assets/_next/image?url=%2Fapp_assets%2F_next%2Fstatic%2Fmedia%2Forb-2.54da9161.png&w=128&q=75"
                        alt="Voice"
                        className="w-full h-full object-cover filter saturate-[1.2] hue-rotate-[71deg]"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                        <Play className="w-2.5 h-2.5 text-white fill-current" />
                      </div>
                    </div>
                    <span className="text-[14px] font-medium text-[#3D3D3A]">Ethan</span>
                  </div>
                  <ChevronsUpDown className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </div>

            {/* Language Section */}
            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2">
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-[#1F1E1D] flex items-center gap-1">
                    Agent Language <Settings2 className="w-[18px] h-[18px] opacity-50" />
                  </p>
                  <p className="text-[14px] text-[#73726C] leading-relaxed">
                    Choose the default language the agent will communicate in.
                  </p>
                </div>

                <button 
                  type="button"
                  className="w-full flex items-center justify-between h-10 px-3 bg-white border border-[#1F1E1D]/10 rounded-lg shadow-sm hover:bg-[#F0EEE6] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <img 
                      src="https://storage.googleapis.com/eleven-public-cdn/images/flags/circle-flags/us.svg"
                      alt="US"
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="text-[14px] font-medium text-[#3D3D3A]">English</span>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </div>

            {/* Behavior Section */}
            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2">
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-[#1F1E1D]">Custom Behavior</p>
                  <p className="text-[14px] text-[#73726C] leading-relaxed">
                    Customize the assistant's behavior. <a href="#" className="underline decoration-current/30 hover:text-[#1F1E1D]">Learn more</a>
                  </p>
                </div>

                <textarea 
                  className="w-full min-h-[104px] p-3 bg-white border border-[#1F1E1D]/10 rounded-xl shadow-sm text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1B67B2]/20 transition-all resize-none placeholder-[#73726C]/50"
                  placeholder="e.g. You are a personal assistant."
                />
              </div>
            </div>

            {/* Integrations & Servers */}
            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2">
              <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1F1E1D]">Integrations</p>
                    <p className="text-[14px] text-[#73726C]">Extend the agent's capabilities.</p>
                  </div>
                  <button type="button" className="h-9 px-4 bg-white border border-[#1F1E1D]/10 rounded-lg shadow-sm text-[14px] font-medium hover:bg-[#F0EEE6] transition-all">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2">
              <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1F1E1D]">Custom MCP Servers</p>
                    <p className="text-[14px] text-[#73726C]">Provide your own protocol servers.</p>
                  </div>
                  <button type="button" className="h-9 px-4 bg-white border border-[#1F1E1D]/10 rounded-lg shadow-sm text-[14px] font-medium hover:bg-[#F0EEE6] transition-all">
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Avatar Selection */}
            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2">
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-[#1F1E1D]">Avatar</p>
                  <p className="text-[14px] text-[#73726C] leading-relaxed">
                    Configure the voice orb or provide your own avatar.
                  </p>
                </div>

                <div className="bg-white border border-[#1F1E1D]/10 rounded-xl p-6 shadow-sm flex flex-col gap-6">
                  <div className="flex gap-6 items-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#FAF9F5] border border-[#1F1E1D]/5">
                      <div className="w-full h-full animate-liquid-orb bg-gradient-to-br from-[#CADCFC] to-[#A0B9D1] blur-sm opacity-80" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <label className="text-[14px] font-medium text-[#1F1E1D]">First color</label>
                        <div className="flex items-center gap-3 h-10 px-3 bg-[#FAF9F5] border border-[#1F1E1D]/10 rounded-lg">
                          <div className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: '#CADCFC' }} />
                          <span className="text-[14px] text-[#3D3D3A]">#CADCFC</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[14px] font-medium text-[#1F1E1D]">Second color</label>
                        <div className="flex items-center gap-3 h-10 px-3 bg-[#FAF9F5] border border-[#1F1E1D]/10 rounded-lg">
                          <div className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: '#A0B9D1' }} />
                          <span className="text-[14px] text-[#3D3D3A]">#A0B9D1</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Speed Slider */}
            <div className="bg-black/[0.02] border border-[#1F1E1D]/5 rounded-[20px] p-2 mb-10">
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-[#1F1E1D]">Speed</p>
                  <p className="text-[14px] text-[#73726C] leading-relaxed">
                    Controls the speed of the generated speech (0.7 to 1.2).
                  </p>
                </div>

                <div className="pt-4 px-2">
                  <Slider 
                    defaultValue={[1.0]} 
                    max={1.2} 
                    min={0.7} 
                    step={0.01} 
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between mt-2 text-[12px] text-[#73726C] font-medium">
                    <span>0.7x</span>
                    <span>1.0x</span>
                    <span>1.2x</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}