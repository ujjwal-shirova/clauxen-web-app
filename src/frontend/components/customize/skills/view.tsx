'use client';

import React from 'react';
import { Settings2, FileCode, FileJson, BookOpen } from 'lucide-react';
import { SkillsMiddleList } from './middle-list';

export function SkillsView() {
  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Middle List Area (Now separated) */}
      <SkillsMiddleList />

      {/* Right Details Area */}
      <main className="flex-1 flex overflow-hidden bg-white">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[672px] mx-auto p-8 pt-12">
            <div className="flex flex-col gap-8 animate-in fade-in duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-[#FAF9F5] rounded-xl border border-black/5 shadow-sm">
                  <BookOpen className="w-6 h-6 text-[#3D3D3A]" />
                </div>
                <div>
                  <h1 className="text-[24px] font-serif font-medium text-[#1F1E1D]">
                    Skill Creator
                  </h1>
                  <p className="text-[14px] text-[#73726C]">Template</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-[#FAF9F5] rounded-2xl border border-[#1F1E1D]/10">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> About this skill
                  </h3>
                  <p className="text-sm text-[#73726C] leading-relaxed">
                    This template provides a standardized structure for creating new Clauxen skills. It includes predefined paths for agents, assets, and evaluation logic.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border border-black/10 rounded-xl hover:bg-black/5 cursor-pointer transition-all">
                    <FileCode className="w-5 h-5 mb-2 text-[#73726C]" />
                    <p className="text-sm font-medium">Edit code</p>
                  </div>
                  <div className="p-4 border border-black/10 rounded-xl hover:bg-black/5 cursor-pointer transition-all">
                    <FileJson className="w-5 h-5 mb-2 text-[#73726C]" />
                    <p className="text-sm font-medium">View manifest</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
