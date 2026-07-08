"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ChatArtifact } from "@/frontend/lib/chat-artifacts";
import { useAppLayout } from "@/frontend/components/app-layout-context";

export type ArtifactViewMode = "preview" | "code";

type ArtifactViewerContextValue = {
  activeArtifact: ChatArtifact | null;
  viewMode: ArtifactViewMode;
  isViewerOpen: boolean;
  openArtifact: (artifact: ChatArtifact, mode?: ArtifactViewMode) => void;
  closeViewer: () => void;
  setViewMode: (mode: ArtifactViewMode) => void;
};

const ArtifactViewerContext = createContext<ArtifactViewerContextValue | null>(
  null,
);

export function ArtifactViewerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setSidebarCollapsed, isMobile } = useAppLayout();
  const [activeArtifact, setActiveArtifact] = useState<ChatArtifact | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ArtifactViewMode>("preview");
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const openArtifact = useCallback(
    (artifact: ChatArtifact, mode: ArtifactViewMode = "preview") => {
      setActiveArtifact(artifact);
      setViewMode(mode);
      setIsViewerOpen(true);
      if (!isMobile) {
        setSidebarCollapsed?.(true);
      }
    },
    [isMobile, setSidebarCollapsed],
  );

  const closeViewer = useCallback(() => {
    setIsViewerOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      activeArtifact,
      viewMode,
      isViewerOpen,
      openArtifact,
      closeViewer,
      setViewMode,
    }),
    [activeArtifact, viewMode, isViewerOpen, openArtifact, closeViewer],
  );

  return (
    <ArtifactViewerContext.Provider value={value}>
      {children}
    </ArtifactViewerContext.Provider>
  );
}

export function useArtifactViewer(): ArtifactViewerContextValue {
  const ctx = useContext(ArtifactViewerContext);
  if (!ctx) {
    throw new Error("useArtifactViewer must be used within ArtifactViewerProvider");
  }
  return ctx;
}

export function useOptionalArtifactViewer(): ArtifactViewerContextValue | null {
  return useContext(ArtifactViewerContext);
}
