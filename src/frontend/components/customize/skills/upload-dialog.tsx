"use client";

import React, { useRef } from "react";
import { cn } from "@/frontend/lib/utils";
import {
  Dialog, // Dialog root — Radix/shadcn modal wrapper, open/onOpenChange controlled
  DialogContent,
  DialogHeader, // DialogHeader — title row layout semantic grouping
  DialogTitle, // DialogTitle — accessible dialog heading
  DialogDescription, // DialogDescription — screen reader only description
} from "@/frontend/components/ui/dialog";

interface UploadSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void; // onOpenChange callback — parent state sync (close on overlay click)
}

const SKILL_UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // client-side cap — oversized archives rejected before any future upload API
const SKILL_UPLOAD_EXTENSIONS = new Set([".zip", ".skill", ".md"]);

function skillUploadExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

export function UploadSkillDialog({
  open,
  onOpenChange,
}: UploadSkillDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null); // fileInputRef — hidden <input type="file"> programmatic click trigger

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const extension = skillUploadExtension(file.name);
    if (
      !SKILL_UPLOAD_EXTENSIONS.has(extension) ||
      file.size > SKILL_UPLOAD_MAX_BYTES
    ) {
      input.value = "";
    }
  };

  const handlePlaceholderLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
  };

  const handleClose = () => {
    onOpenChange(false); // parent open state false — dialog unmount/hide
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[512px] p-0 bg-zinc-50 border-zinc-200 rounded-[16px] shadow-2xl animate-in zoom-in-95 duration-250 font-sans border-[0.666667px] gap-0 [&>button]:hidden">
        {" "}
        {/* DialogContent styling — warm background, zoom-in animation, default close button hidden */}
        <DialogDescription className="sr-only">
          Upload a skill file in .zip, .skill, or .md format.
        </DialogDescription>
        <div className="p-6 pt-10 flex flex-col gap-6">
          {" "}
          {/* inner padding container — header + upload zone vertical stack */}
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 text-left">
            <DialogTitle className="text-[20px] font-semibold text-zinc-900 leading-[28px]">
              Upload skill
            </DialogTitle>{" "}
            {/* dialog title — "Upload skill" heading */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 -mr-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-500"
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
              </svg>{" "}
              {/* X icon SVG — close affordance */}
            </button>
          </DialogHeader>
          <div className="flex flex-col gap-6 mt-3">
            <div className="flex flex-col gap-3">
              <button
                onClick={handleUploadClick} // click — hidden file input activate
                className="flex flex-col items-center justify-center h-[120px] w-full bg-white border border-dashed border-zinc-200 rounded-lg hover:border-zinc-2000 transition-all group"
              >
                <div className="w-8 h-8 flex items-center justify-center text-zinc-500 mb-2">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M10.5 10.5H13v1h-2.5V14h-1v-2.5H7v-1h2.5V8h1z" />
                    <path
                      fillRule="evenodd"
                      d="M16.5 3A1.5 1.5 0 0 1 18 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5v-9A1.5 1.5 0 0 1 3.5 5h7.293l1.56-1.56.11-.1a1.5 1.5 0 0 1 .951-.34zm-3.086 1a.5.5 0 0 0-.277.084l-.077.062-1.707 1.708A.5.5 0 0 1 11 6H3.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z"
                      clipRule="evenodd"
                    />
                  </svg>{" "}
                  {/* upload folder+plus icon */}
                </div>
                <span className="text-[14px] font-medium text-zinc-500">
                  Drag and drop or click to upload
                </span>{" "}
                {/* CTA label — user action hint */}
              </button>

              <input
                type="file" // native file picker input
                ref={fileInputRef}
                className="hidden"
                accept=".zip,.skill,.md" // accept filter — allowed skill package extensions
                multiple={false}
                onChange={handleFileChange}
              />

              <div className="flex flex-col gap-5 text-zinc-500 text-[12px] leading-relaxed [font-feature-settings:'salt']">
                {" "}
                {/* requirements section — file format rules */}
                <div>
                  <p className="font-medium">File requirements</p>{" "}
                  {/* section heading */}
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>
                      .md file must contain skill name and description formatted
                      in YAML
                    </li>{" "}
                    {/* .md rule — YAML frontmatter expected */}
                    <li>
                      .zip or .skill file must include a SKILL.md file
                    </li>{" "}
                    {/* archive rule — SKILL.md mandatory */}
                  </ul>
                </div>
                <p>
                  <a
                    href="#"
                    onClick={handlePlaceholderLinkClick}
                    className="underline decoration-current/30 hover:text-zinc-900 transition-colors"
                  >
                    Read more about creating skills
                  </a>{" "}
                  {/* docs link placeholder */}
                  <span> or </span>
                  <a
                    href="#"
                    onClick={handlePlaceholderLinkClick}
                    className="underline decoration-current/30 hover:text-zinc-900 transition-colors"
                  >
                    see an example
                  </a>{" "}
                  {/* example link placeholder */}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
