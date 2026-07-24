"use client";

import { createContext, useContext, type ReactNode } from "react";

const AgentTurnStreamingContext = createContext(false);

/** True while the current assistant message is still streaming. */
export function AgentTurnStreamingProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <AgentTurnStreamingContext.Provider value={value}>
      {children}
    </AgentTurnStreamingContext.Provider>
  );
}

export function useAgentTurnStreaming(): boolean {
  return useContext(AgentTurnStreamingContext);
}
