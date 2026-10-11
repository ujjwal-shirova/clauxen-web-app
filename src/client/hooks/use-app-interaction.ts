"use client";

import { useEffect, useState } from "react";

/** Consent choices and keyboard navigation should never trigger sign-in. */
export function useAppInteraction() {
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const onInteraction = (event: MouseEvent | KeyboardEvent) => {
      if (!event.isTrusted) return;
      if (
        event.target instanceof Element &&
        event.target.closest("[data-cookie-consent]")
      )
        return;
      if (
        event instanceof KeyboardEvent &&
        event.key.length !== 1 &&
        event.key !== "Enter"
      )
        return;
      setHasInteracted(true);
      document.removeEventListener("click", onInteraction);
      document.removeEventListener("keydown", onInteraction);
    };
    document.addEventListener("click", onInteraction);
    document.addEventListener("keydown", onInteraction);
    return () => {
      document.removeEventListener("click", onInteraction);
      document.removeEventListener("keydown", onInteraction);
    };
  }, []);

  return hasInteracted;
}
