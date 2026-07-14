"use client";

/**
 * Legacy path overlay → ChatGPT-style hash on `/new`.
 * Ensures a real parent page always mounts under the overlay.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  APP_ROUTES,
  overlayToHash,
  type AppOverlayPath,
} from "@/frontend/lib/app-routes";
import { ChatRouteSkeleton } from "@/frontend/components/chat-route-skeleton";

export function LegacyOverlayRedirect({
  overlay,
}: {
  overlay: AppOverlayPath;
}) {
  const router = useRouter();

  useEffect(() => {
    const hash = overlayToHash(overlay);
    const target = `${APP_ROUTES.newChat}${hash}`;
    window.history.replaceState(
      { __clxOverlay: hash, __clxNav: APP_ROUTES.newChat },
      "",
      target,
    );
    router.replace(APP_ROUTES.newChat, { scroll: false });
    queueMicrotask(() => {
      if (
        window.location.pathname === APP_ROUTES.newChat &&
        window.location.hash !== hash
      ) {
        window.history.replaceState(window.history.state, "", target);
      }
    });
  }, [overlay, router]);

  return <ChatRouteSkeleton />;
}
