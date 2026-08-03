"use client";

import { useRef, useState } from "react";
import { Plus, Mic, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
] as const;

type ModelOption = (typeof MODELS)[number];

const THINKING_LEVELS = ["None", "Min", "Normal", "Max"] as const;

type ProjectChatInputProps = {
  placeholder?: string;
  disabled?: boolean;
  onSend: (
    message: string,
    options: { model: string; thinking_level: string },
  ) => void;
};

export function ProjectChatInput({
  placeholder = "Type / for skills",
  disabled,
  onSend,
}: ProjectChatInputProps) {
  const [value, setValue] = useState("");
  const [model, setModel] = useState<ModelOption>(MODELS[0]);
  const [thinking, setThinking] = useState<string>("Normal");
  const [showSkills, setShowSkills] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "/" && value === "") {
      setShowSkills(true);
    }
    if (e.key === "Escape") {
      setShowSkills(false);
      setShowTools(false);
    }
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, {
      model: model.id,
      thinking_level: thinking.toLowerCase(),
    });
    setValue("");
    setShowSkills(false);
  };

  return (
    <div className="relative">
      {showSkills ? (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium text-zinc-500">Skills</p>
          <button
            type="button"
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100"
            onClick={() => {
              setValue("/summarize ");
              setShowSkills(false);
              textareaRef.current?.focus();
            }}
          >
            Summarize
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100"
            onClick={() => {
              setValue("/analyze ");
              setShowSkills(false);
              textareaRef.current?.focus();
            }}
          >
            Analyze
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative px-4 pt-4">
          <button
            type="button"
            aria-label="MCP tools"
            onClick={() => setShowTools((s) => !s)}
            className="absolute top-3 right-3 rounded-md px-1.5 py-0.5 text-sm transition-all duration-150 hover:opacity-80"
          >
            🤖
          </button>
          {showTools ? (
            <div className="absolute top-10 right-3 z-10 w-48 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
              <p className="text-xs text-zinc-500">MCP integrations (stub)</p>
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className="w-full resize-none bg-transparent text-sm focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between px-3 pb-3">
          <button
            type="button"
            aria-label="Add attachment"
            className="rounded-md p-2 text-zinc-600 transition-all duration-150 hover:opacity-80"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-zinc-700 transition-all duration-150 hover:opacity-80"
                >
                  {model.label} {thinking}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {MODELS.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => setModel(m)}>
                    {m.label}
                  </DropdownMenuItem>
                ))}
                <div className="my-1 border-t border-gray-100" />
                {THINKING_LEVELS.map((level) => (
                  <DropdownMenuItem key={level} onClick={() => setThinking(level)}>
                    Thinking: {level}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              aria-label="Voice input"
              className="rounded-md p-2 text-zinc-600 transition-all duration-150 hover:opacity-80"
              onClick={() => {
                if (!navigator.mediaDevices?.getUserMedia) return;
                void navigator.mediaDevices.getUserMedia({ audio: true });
              }}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Waveform"
              className="rounded-md px-1 text-zinc-400"
            >
              <span className="inline-flex gap-0.5">
                {[3, 5, 4, 6, 3].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-zinc-400"
                    style={{ height: `${h * 2}px` }}
                  />
                ))}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
