"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StudioTopBar } from "./studio-top-bar";
import { StudioLeftRail } from "./studio-left-rail";
import { StudioGallery } from "./studio-gallery";
import { StudioPromptDock } from "./studio-prompt-dock";
import { StudioDetailDrawer } from "./studio-detail-drawer";
import {
  IMAGE_MODELS,
  PLACEHOLDER_GRADIENTS,
  VIDEO_MODELS,
  type StudioAspectRatio,
  type StudioGeneration,
  type StudioMode,
  type StudioSection,
  type StudioVideoDuration,
  type StudioVideoResolution,
} from "./studio-types";

const PROJECT_NAME = "Untitled project";
const MOCK_GENERATE_MS = 1600;

function newId() {
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function StudioApp() {
  const [mode, setMode] = useState<StudioMode>("image");
  const [section, setSection] = useState<StudioSection>("create");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(IMAGE_MODELS[0]);
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>("16:9");
  const [duration, setDuration] = useState<StudioVideoDuration>("8s");
  const [resolution, setResolution] =
    useState<StudioVideoResolution>("1080p");
  const [generations, setGenerations] = useState<StudioGeneration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dockFocused, setDockFocused] = useState(false);
  const [referenceName, setReferenceName] = useState<string | null>(null);

  useEffect(() => {
    setModel(mode === "image" ? IMAGE_MODELS[0] : VIDEO_MODELS[0]);
  }, [mode]);

  const selected = useMemo(
    () => generations.find((g) => g.id === selectedId) ?? null,
    [generations, selectedId],
  );

  const handleGenerate = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;

    const id = newId();
    const gradient =
      PLACEHOLDER_GRADIENTS[
        generations.length % PLACEHOLDER_GRADIENTS.length
      ];

    const pending: StudioGeneration = {
      id,
      mode,
      prompt: trimmed,
      model,
      aspectRatio,
      status: "pending",
      createdAt: Date.now(),
      duration: mode === "video" ? duration : undefined,
      resolution: mode === "video" ? resolution : undefined,
      thumbGradient: gradient,
    };

    setSection("create");
    setGenerations((prev) => [pending, ...prev]);
    setSelectedId(id);
    setGenerating(true);

    window.setTimeout(() => {
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, status: "ready" as const } : g,
        ),
      );
      setGenerating(false);
    }, MOCK_GENERATE_MS);
  }, [
    prompt,
    generating,
    mode,
    model,
    aspectRatio,
    duration,
    resolution,
    generations.length,
  ]);

  return (
    <div className="studio-shell flex h-dvh w-full flex-col overflow-hidden bg-[#0a0908] text-[#f2ebe0]">
      <StudioTopBar projectName={PROJECT_NAME} />

      <div className="flex min-h-0 flex-1">
        <StudioLeftRail
          mode={mode}
          section={section}
          onModeChange={setMode}
          onSectionChange={setSection}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="studio-stage min-h-0 flex-1 overflow-y-auto">
            <StudioGallery
              section={section}
              mode={mode}
              generations={generations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </main>

          {section === "create" ? (
            <StudioPromptDock
              mode={mode}
              prompt={prompt}
              model={model}
              aspectRatio={aspectRatio}
              duration={duration}
              resolution={resolution}
              generating={generating}
              dockFocused={dockFocused}
              referenceName={referenceName}
              onPromptChange={setPrompt}
              onModelChange={setModel}
              onAspectChange={setAspectRatio}
              onDurationChange={setDuration}
              onResolutionChange={setResolution}
              onReferenceChange={(file) =>
                setReferenceName(file?.name ?? null)
              }
              onFocusChange={setDockFocused}
              onGenerate={handleGenerate}
            />
          ) : null}
        </div>

        <StudioDetailDrawer
          generation={selected}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
