'use client';

import React, { useRef } from 'react';
import { cn } from '@/frontend/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";

interface UploadSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadSkillDialog({ open, onOpenChange }: UploadSkillDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[512px] p-0 bg-[#FAF9F5] border-[#1F1E1D]/15 rounded-[16px] shadow-2xl animate-in zoom-in-95 duration-250 font-sans border-[0.666667px] gap-0 [&>button]:hidden"
      >
        <DialogDescription className="sr-only">
          Upload a skill file in .zip, .skill, or .md format.
        </DialogDescription>
        
        <div className="p-6 pt-10 flex flex-col gap-6">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 text-left">
            <DialogTitle className="text-[20px] font-semibold text-[#1F1E1D] leading-[28px]">
              Upload skill
            </DialogTitle>
            <button 
              onClick={handleClose}
              className="p-2 -mr-2 hover:bg-black/5 rounded-lg transition-colors text-[#73726C]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M15.147 4.146a.5.5 0 0 1 .707.707L10.707 10l5.147 5.147a.5.5 0 0 1-.63.771l-.078-.064L10 10.707l-5.146 5.147a.5.5 0 0 1-.708-.707L9.293 10 4.146 4.853a.5.5 0 0 1 .708-.707L10 9.293z" />
              </svg>
            </button>
          </DialogHeader>

          <div className="flex flex-col gap-6 mt-3">
            <div className="flex flex-col gap-3">
              {/* Upload Zone */}
              <button 
                onClick={handleUploadClick}
                className="flex flex-col items-center justify-center h-[120px] w-full bg-white border border-dashed border-[#1F1E1D]/30 rounded-lg hover:border-[#1F1E1D]/50 transition-all group"
              >
                <div className="w-8 h-8 flex items-center justify-center text-[#73726C] mb-2">
                  <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M10.5 10.5H13v1h-2.5V14h-1v-2.5H7v-1h2.5V8h1z" />
                    <path fillRule="evenodd" d="M16.5 3A1.5 1.5 0 0 1 18 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5v-9A1.5 1.5 0 0 1 3.5 5h7.293l1.56-1.56.11-.1a1.5 1.5 0 0 1 .951-.34zm-3.086 1a.5.5 0 0 0-.277.084l-.077.062-1.707 1.708A.5.5 0 0 1 11 6H3.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-[14px] font-medium text-[#73726C]">Drag and drop or click to upload</span>
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".zip,.skill,.md" 
              />

              {/* Requirements */}
              <div className="flex flex-col gap-5 text-[#73726C] text-[12px] leading-relaxed [font-feature-settings:'salt']">
                <div>
                  <p className="font-medium">File requirements</p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>.md file must contain skill name and description formatted in YAML</li>
                    <li>.zip or .skill file must include a SKILL.md file</li>
                  </ul>
                </div>
                
                <p>
                  <a href="#" className="underline decoration-current/30 hover:text-[#1F1E1D] transition-colors">Read more about creating skills</a>
                  <span> or </span>
                  <a href="#" className="underline decoration-current/30 hover:text-[#1F1E1D] transition-colors">see an example</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
