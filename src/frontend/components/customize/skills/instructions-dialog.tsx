'use client';

import React, { useState } from 'react';
import { cn } from '@/frontend/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";
import { Input } from "@/frontend/components/ui/input";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Button } from "@/frontend/components/ui/button";

interface InstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstructionsDialog({ open, onOpenChange }: InstructionsDialogProps) {
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillInstructions, setSkillInstructions] = useState('');

  const handleClose = () => {
    onOpenChange(false);
    // Reset form on close
    setSkillName('');
    setSkillDescription('');
    setSkillInstructions('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[576px] p-0 bg-[#FAF9F5] border-[#1F1E1D]/15 rounded-[16px] shadow-2xl animate-in zoom-in-95 duration-250 font-sans border-[0.666667px] gap-0 [&>button]:hidden overflow-y-auto max-h-[90vh]"
      >
        <DialogDescription className="sr-only">
          Fill out the details to create a new skill with custom instructions.
        </DialogDescription>
        
        <div className="p-6 pt-10 flex flex-col gap-6">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 text-left">
            <DialogTitle className="text-[20px] font-semibold text-[#1F1E1D] leading-[28px]">
              Write skill instructions
            </DialogTitle>
            <button 
              onClick={handleClose}
              className="p-2 -mr-2 hover:bg-black/5 rounded-lg transition-colors text-[#73726C]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M15.147 4.146a.5.5 0 0 1 .707.707L10.707 10l5.147 5.147a.5.5 0 0 1-.63.771l-.078-.064L10 10.707l-5.146 5.147a.5.5 0 0 1-.708-.707L9.293 10 4.146 4.853a.5.5 0 0 1 .708-.707L10 9.292z" />
              </svg>
            </button>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-3">
            {/* Skill Name */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Skill name</label>
              <Input 
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="weekly-status-report"
                className="h-9 px-3 bg-white rounded-lg border-[#1F1E1D]/15 text-[14px] focus-visible:ring-2 focus-visible:ring-[#1B67B2]/20 transition-all placeholder-[#73726C]/50"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Description</label>
              <Textarea 
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                rows={3}
                placeholder="Generate weekly status reports from recent work. Use when asked for updates or progress summaries."
                className="min-h-[100px] p-3 bg-white rounded-xl border-[#1F1E1D]/15 text-[14px] focus-visible:ring-2 focus-visible:ring-[#1B67B2]/20 transition-all resize-none placeholder-[#73726C]/50"
              />
            </div>

            {/* Instructions */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#3D3D3A]">Instructions</label>
              <Textarea 
                value={skillInstructions}
                onChange={(e) => setSkillInstructions(e.target.value)}
                rows={10}
                placeholder="Summarize my recent work in three sections: wins, blockers, and next steps. Keep the tone professional but not stiff..."
                className="min-h-[240px] p-3 bg-white rounded-xl border-[#1F1E1D]/15 text-[14px] focus-visible:ring-2 focus-visible:ring-[#1B67B2]/20 transition-all resize-none placeholder-[#73726C]/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline"
              onClick={handleClose}
              className="h-9 px-4 border-[#1F1E1D]/30 text-[#3D3D3A] rounded-lg font-medium hover:bg-black/5"
            >
              Cancel
            </Button>
            <Button 
              disabled={!skillName.trim()}
              className={cn(
                "h-9 px-4 rounded-lg font-medium transition-all",
                skillName.trim() ? "bg-black text-white hover:bg-black/90" : "bg-[#1F1E1D] text-white opacity-50 cursor-not-allowed"
              )}
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
