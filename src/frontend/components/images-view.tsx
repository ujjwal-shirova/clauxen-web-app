"use client";

import React, { useState } from "react";
import { cn } from "@/frontend/lib/utils";
import { useToast } from "@/frontend/hooks/use-toast";
import { PromptInput } from "@/frontend/components/prompt-input";
import { ImageExploreIdeas } from "@/frontend/components/chat-view-pane";

export function ImagesView() {
  const { toast } = useToast();
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [myImages, setMyImages] = useState<
    Array<{ id: string; prompt: string; url?: string }>
  >([]);

  const generateImage = async (promptText: string) => {
    const value = promptText.trim();
    if (!value || isGenerating) return;

    setIsGenerating(true);

    // Simulate image generation (in real app this would call an API)
    await new Promise((r) => setTimeout(r, 1200));

    const newImage = {
      id: `img-${Date.now()}`,
      prompt: value,
      url: undefined, // placeholder; in prod would be the generated asset
    };

    setMyImages((prev) => [newImage, ...prev]);

    setIsGenerating(false);

    toast({
      title: "Image generated",
      description: `“${value.length > 40 ? value.slice(0, 37) + "..." : value}”`,
    });
  };

  const handleIdeaClick = (label: string) => {
    void generateImage(label);
  };

  return (
    <div className="flex flex-col flex-1 w-full bg-zinc-50 font-sans h-full overflow-y-auto animate-in fade-in duration-300">
      <div className="w-full max-w-[860px] mx-auto px-4 sm:px-6 pt-8">
        <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.4px] text-zinc-900 mb-5">
          Images
        </h1>

        {/* Use the exact same prompt textbox component as the new chat / welcome screen.
            Pre-configured for image generation (image icon replaces plus, image mode forced, sends trigger image gen). */}
        <PromptInput
          onSendMessage={generateImage}
          onStopGeneration={() => setIsGenerating(false)}
          isConversationStarted={false}
          isGenerating={isGenerating}
          imageModeEnabled={true}
          onImageModeChange={() => {
            /* keep image context on dedicated page */
          }}
          thinkingEnabled={thinkingEnabled}
          onThinkingEnabledChange={setThinkingEnabled}
          showModelSelector={false}
          replaceAddButtonWithImage={true}
        />
      </div>

      {/* Image idea cards directly below the prompt (no "Explore ideas" label, no extra separation line or "Create an image" header) */}
      <div className="max-w-[860px] mx-auto w-full px-4 sm:px-6 pt-2">
        <ImageExploreIdeas onIdeaClick={handleIdeaClick} showHeader={false} />
      </div>

      {/* My images section */}
      <div className="max-w-[860px] mx-auto w-full px-4 sm:px-6 pb-16 pt-4">
        <h2 className="mb-3 px-1 text-[20px] font-medium tracking-[-0.01em] text-zinc-900">
          My images
        </h2>

        {myImages.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white/60 px-6 py-10 text-center text-zinc-500">
            <p className="text-[14.5px]">Images you generate will appear here.</p>
            <p className="mt-1 text-[12.5px] opacity-70">
              Try describing something in the prompt above or pick an idea.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {myImages.map((img, idx) => (
              <div
                key={img.id}
                className="group aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm"
              >
                <div className="h-full w-full bg-gradient-to-br from-[#e8e6df] via-[#d4d1c6] to-[#c3bfaf] flex items-center justify-center relative">
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-3">
                    <p className="text-[12.5px] text-white/95 line-clamp-2 pr-2">
                      {img.prompt}
                    </p>
                  </div>
                  <div className="text-[11px] uppercase tracking-[1px] text-white/70 font-medium">
                    {idx === 0 ? "Just now" : "Recently"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
