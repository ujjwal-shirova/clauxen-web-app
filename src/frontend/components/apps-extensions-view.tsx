'use client';

import React from 'react';
import { ArrowLeft, Monitor, Smartphone, Chrome, Laptop, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/frontend/components/ui/button';

interface AppsExtensionsViewProps {
  onClose: () => void;
}

export function AppsExtensionsView({ onClose }: AppsExtensionsViewProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#FAF9F5] flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex items-center justify-center py-5 relative w-full bg-[#FAF9F5]/80 backdrop-blur-md z-20">
        <button 
          onClick={onClose} 
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 rounded-lg transition-all"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-[#3D3D3A]" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <div className="max-w-[896px] mx-auto pt-8 flex flex-col items-center">
          <h2 className="text-[28px] font-serif font-medium text-[#3D3D3A] mb-10 text-center leading-tight">
            Do more with Clauxen, everywhere you work
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
            {/* Cowork Card */}
            <div className="md:col-span-2 bg-white border border-[#1F1E1D]/15 rounded-[32px] p-2.5 shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <div className="bg-[#FAF9F5] rounded-[24px] border border-[#1F1E1D]/15 h-full overflow-hidden grid grid-cols-1 md:grid-cols-2">
                <div className="p-7 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#3D3D3A] mb-2">Cowork</h3>
                    <p className="text-[14px] text-[#73726C] leading-relaxed mb-6">
                      Clauxen works in your files and browser tabs to help you get things done.
                      <br /><br />
                      Available for Pro and Max plans.
                      <br />
                      <span className="font-semibold text-[#3D3D3A]">Only on desktop.</span>
                    </p>
                  </div>
                  <Button className="w-fit h-9 px-6 bg-black text-white hover:bg-black/90 rounded-lg">
                    Upgrade
                  </Button>
                </div>
                <div className="relative min-h-[240px] bg-gradient-to-br from-[#F0EEE6] to-[#FAF9F5]">
                   <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle, rgba(20, 20, 19, 0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                   <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className="relative w-full aspect-video bg-white rounded-xl shadow-xl border border-black/5 overflow-hidden">
                         <div className="h-6 bg-[#E5E7EB] flex items-center px-3 gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                            <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                            <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                         </div>
                         <div className="p-4 space-y-2">
                            <div className="h-2 w-3/4 bg-gray-100 rounded" />
                            <div className="h-2 w-1/2 bg-gray-100 rounded" />
                            <div className="pt-4 flex items-center gap-2">
                               <div className="w-6 h-6 rounded bg-[#1F1E1D] flex items-center justify-center text-[10px] text-white">C</div>
                               <div className="h-2 w-1/3 bg-gray-200 rounded" />
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Mobile Card */}
            <div className="bg-white border border-[#1F1E1D]/15 rounded-[32px] p-2.5 shadow-sm hover:shadow-md transition-all">
              <div className="bg-[#FAF9F5] rounded-[24px] border border-[#1F1E1D]/15 p-7 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-[#3D3D3A] mb-2">Mobile</h3>
                <p className="text-[14px] text-[#73726C] leading-relaxed mb-6">
                  Tap into your health data, notes, and reminders.
                </p>
                <div className="space-y-3 mt-auto">
                  <div className="flex items-center justify-between py-3 border-b border-black/5">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-[#73726C]" />
                      <span className="text-[14px]">iOS</span>
                    </div>
                    <button className="text-[14px] font-medium text-[#3D3D3A] px-4 py-1.5 border border-black/15 rounded-lg hover:bg-black/5 transition-colors">
                      Download
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-[#73726C]" />
                      <span className="text-[14px]">Android</span>
                    </div>
                    <button className="text-[14px] font-medium text-[#3D3D3A] px-4 py-1.5 border border-black/15 rounded-lg hover:bg-black/5 transition-colors">
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Clauxen Code Card */}
            <div className="bg-white border border-[#1F1E1D]/15 rounded-[32px] p-2.5 shadow-sm hover:shadow-md transition-all">
              <div className="bg-[#FAF9F5] rounded-[24px] border border-[#1F1E1D]/15 p-7 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-[#3D3D3A] mb-2">Clauxen Code</h3>
                <p className="text-[14px] text-[#73726C] leading-relaxed mb-6">
                  Build, debug, and ship from your terminal or IDE.
                </p>
                <Button className="w-fit h-9 px-6 bg-transparent border border-black/15 text-[#3D3D3A] hover:bg-black/5 rounded-lg mb-6">
                  Upgrade
                </Button>
                <div className="space-y-1">
                  <a href="#" className="flex items-center justify-between py-3 border-b border-black/5 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Laptop className="w-5 h-5 text-[#73726C]" />
                      <span className="text-[14px]">Terminal</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#73726C] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="#" className="flex items-center justify-between py-3 border-b border-black/5 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#007ACC] rounded-sm" />
                      </div>
                      <span className="text-[14px]">VS Code</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#73726C] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="#" className="flex items-center justify-between py-3 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#FE2857] rounded-sm" />
                      </div>
                      <span className="text-[14px]">JetBrains</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#73726C] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
              </div>
            </div>

            {/* Microsoft Office Card */}
            <div className="bg-white border border-[#1F1E1D]/15 rounded-[32px] p-2.5 shadow-sm hover:shadow-md transition-all">
              <div className="bg-gradient-to-br from-[#F0FDF4]/50 to-[#FAF9F5] rounded-[24px] border border-[#1F1E1D]/15 p-7 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-[#3D3D3A] mb-2">Microsoft Office</h3>
                <p className="text-[14px] text-[#73726C] leading-relaxed mb-6">
                  Analyze data and build presentations with Clauxen alongside you.
                </p>
                <Button className="w-fit h-9 px-6 bg-transparent border border-black/15 text-[#3D3D3A] hover:bg-black/5 rounded-lg mb-6">
                  Upgrade
                </Button>
                <div className="space-y-1">
                  <a href="#" className="flex items-center justify-between py-3 border-b border-black/5 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#1D6F42] rounded-sm" />
                      </div>
                      <span className="text-[14px]">Excel</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#73726C] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <a href="#" className="flex items-center justify-between py-3 hover:bg-black/[0.02] -mx-7 px-7 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#B7472A] rounded-sm" />
                      </div>
                      <span className="text-[14px]">PowerPoint</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#73726C] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
              </div>
            </div>

            {/* Chrome Card */}
            <div className="bg-white border border-[#1F1E1D]/15 rounded-[32px] p-2.5 shadow-sm hover:shadow-md transition-all">
              <div className="bg-gradient-to-br from-[#FEF2F2]/50 to-[#FAF9F5] rounded-[24px] border border-[#1F1E1D]/15 p-7 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-[#3D3D3A] mb-2">Chrome</h3>
                <p className="text-[14px] text-[#73726C] leading-relaxed mb-6">
                  Clauxen navigates, clicks buttons, and fills forms in your browser. Works in Cowork.
                </p>
                <Button className="w-fit h-9 px-6 bg-transparent border border-black/15 text-[#3D3D3A] hover:bg-black/5 rounded-lg mt-auto">
                  Upgrade
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
