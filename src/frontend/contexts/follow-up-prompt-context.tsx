"use client";

import * as React from "react";

type FollowUpPromptContextValue = {
  enabled: boolean;
  onSelect?: (prompt: string) => void;
};

const FollowUpPromptContext =
  React.createContext<FollowUpPromptContextValue>({
    enabled: true,
  });

export function FollowUpPromptProvider({
  enabled,
  onSelect,
  children,
}: {
  enabled: boolean;
  onSelect?: (prompt: string) => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ enabled, onSelect }),
    [enabled, onSelect],
  );
  return (
    <FollowUpPromptContext.Provider value={value}>
      {children}
    </FollowUpPromptContext.Provider>
  );
}

export function useFollowUpPrompt() {
  return React.useContext(FollowUpPromptContext);
}
