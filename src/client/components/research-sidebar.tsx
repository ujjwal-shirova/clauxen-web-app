"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";

const ResearchSidebarContext = createContext<{
  slot: HTMLElement | null;
  active: string | null;
  activate: (id: string) => void;
  release: (id: string) => void;
} | null>(null);

export function ResearchSidebarLayout({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [active, activate] = useState<string | null>(null);
  const release = useCallback(
    (id: string) => activate((current) => (current === id ? null : current)),
    [],
  );
  return (
    <ResearchSidebarContext.Provider
      value={{ slot, active, activate, release }}
    >
      <div className="research-workspace flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <div className="research-workspace__chat flex min-h-0 min-w-0 flex-1">
          {children}
        </div>
        <div ref={setSlot} className="research-workspace__sidebar" />
      </div>
    </ResearchSidebarContext.Provider>
  );
}

/** Both live activity and saved reports occupy the same app sidebar slot. */
export function ResearchSidebar({
  open,
  onOpenChange,
  expanded,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expanded: boolean;
  children: ReactNode;
}) {
  const context = useContext(ResearchSidebarContext);
  const id = useId();
  const owned = useRef(false);
  const activate = context?.activate;
  const release = context?.release;
  useEffect(() => {
    if (!open || !activate || !release) return;
    activate(id);
    return () => release(id);
  }, [open, activate, release, id]);
  useEffect(() => {
    if (!open) {
      owned.current = false;
      return;
    }
    if (context?.active === id) owned.current = true;
    else if (owned.current && open) {
      owned.current = false;
      onOpenChange(false);
    }
  }, [context?.active, id, open, onOpenChange]);
  if (!context?.slot) return null;
  return (
    <Dialog.Root
      open={open && context.active === id}
      onOpenChange={onOpenChange}
      modal={false}
    >
      <Dialog.Portal container={context.slot}>
        <Dialog.Content
          aria-describedby={undefined}
          data-research-sidebar
          data-expanded={expanded || undefined}
          onInteractOutside={(event) => event.preventDefault()}
          className="research-sidebar flex h-full min-h-0 min-w-0 flex-col border-l border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] text-[var(--ui-fg)]"
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
