"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils"; // cn — Create button disabled/enabled styling merge
import {
  Dialog, // Dialog root — modal open/onOpenChange controlled
  DialogContent, // DialogContent — styled panel wrapper
  DialogHeader, // DialogHeader — title + close row
  DialogTitle, // DialogTitle — accessible heading
  DialogDescription, // DialogDescription — sr-only form purpose
} from "@/components/ui/dialog"; // shadcn Dialog UI primitives
import { Input } from "@/components/ui/input"; // Input — single-line skill name field
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { appBtn } from "@/lib/app-buttons";
import { chrome } from "@/lib/app-chrome";

const SKILL_TITLE_MAX_LENGTH = 128; // slug/title cap — oversized POST body / DB abuse mitigation
const SKILL_FIELD_MAX_LENGTH = 50_000; // per textarea cap — instruction_profiles.instructions is text but bounded client-side

function stripControlChars(value: string): string {
  // C0 controls + DEL omit — newlines/tabs allowed for multiline instructions
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

interface InstructionsDialogProps {
  // InstructionsDialogProps — parent controlled dialog
  open: boolean; // open — dialog visibility
  onOpenChange: (open: boolean) => void; // onOpenChange — parent sync close/open
  onSave?: (input: { title: string; instructions: string }) => Promise<void>;
}

export function InstructionsDialog({
  open,
  onOpenChange,
  onSave,
}: InstructionsDialogProps) {
  const [skillName, setSkillName] = useState(""); // skillName state — skill slug/title input value
  const [skillDescription, setSkillDescription] = useState(""); // skillDescription state — short description/trigger text
  const [skillInstructions, setSkillInstructions] = useState(""); // skillInstructions state — full prompt body
  const [saving, setSaving] = useState(false); // saving state — Create button loading/disabled during API call

  const handleClose = () => {
    onOpenChange(false); // parent open false
    setSkillName(""); // name field clear
    setSkillDescription(""); // description clear
    setSkillInstructions(""); // instructions clear
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {" "}
      {/* controlled modal */}
      <DialogContent className={cn(chrome.overlay.dialog, "max-h-[90vh] max-w-[576px] gap-0 overflow-y-auto p-0 animate-in zoom-in-95 duration-250 [&>button]:hidden")}>
        {" "}
        {/* wide dialog — scrollable on small viewports, default close hidden */}
        <DialogDescription className="sr-only">
          Fill out the details to create a new skill with custom instructions.
        </DialogDescription>
        <div className="p-6 pt-10 flex flex-col gap-6">
          {" "}
          {/* padded form container */}
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 text-left">
            <DialogTitle className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100 leading-[28px]">
              Write skill instructions
            </DialogTitle>
            <button
              onClick={handleClose}
              className="p-2 -mr-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M15.147 4.146a.5.5 0 0 1 .707.707L10.707 10l5.147 5.147a.5.5 0 0 1-.63.771l-.078-.064L10 10.707l-5.146 5.147a.5.5 0 0 1-.708-.707L9.293 10 4.146 4.853a.5.5 0 0 1 .708-.707L10 9.293z" />
              </svg>
            </button>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-3">
            <div className="flex flex-col gap-2">
              <label className="app-page-body font-medium">
                Skill name
              </label>
              <Input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="weekly-status-report"
                className="app-page-search !h-8 !pl-3 focus-visible:ring-2 focus-visible:ring-zinc-900/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="app-page-body font-medium">
                Description
              </label>
              <Textarea
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                maxLength={SKILL_FIELD_MAX_LENGTH}
                rows={3}
                placeholder="Generate weekly status reports from recent work. Use when asked for updates or progress summaries."
                className="app-page-body min-h-[100px] resize-none rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white dark:bg-[#18181b] p-3 focus-visible:ring-2 focus-visible:ring-zinc-900/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="app-page-body font-medium">
                Instructions
              </label>
              <Textarea
                value={skillInstructions}
                onChange={(e) => setSkillInstructions(e.target.value)}
                rows={10}
                placeholder="Summarize my recent work in three sections: wins, blockers, and next steps. Keep the tone professional but not stiff..."
                className="app-page-body min-h-[240px] resize-none rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white dark:bg-[#18181b] p-3 focus-visible:ring-2 focus-visible:ring-zinc-900/10"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="h-9 px-4 border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              disabled={!skillName.trim() || saving}
              onClick={() => {
                // Create click handler
                if (!onSave) {
                  // no save callback — demo mode, just close
                  handleClose();
                  return;
                }
                setSaving(true); // saving true — prevent double submit
                void onSave({
                  // API save — description + instructions merged
                  title: stripControlChars(skillName.trim()).slice(
                    0,
                    SKILL_TITLE_MAX_LENGTH,
                  ), // trimmed skill title/slug
                  instructions: stripControlChars(
                    [skillDescription.trim(), skillInstructions.trim()] // both text blocks
                      .filter(Boolean) // empty sections omit
                      .join("\n\n"),
                  ).slice(0, SKILL_FIELD_MAX_LENGTH * 2), // combined cap — two fields merged
                })
                  .then(handleClose)
                  .finally(() => setSaving(false)); // always — saving flag off
              }}
              className={cn(
                appBtn.primary,
                !skillName.trim() && "opacity-50 cursor-not-allowed",
              )}
            >
              {saving ? "Saving…" : "Create"} {/* label — loading vs idle */}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
