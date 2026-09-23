"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { LibraryView } from "@/components/library-view";
import {
  PluginsView,
  ProjectsView,
} from "@/components/sidebar-directory-views";
import { MyClauxenView } from "@/components/my-clauxen-view";
import { AppContentLoader } from "@/components/app-content-loader";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { isChatSurfacePath, isNewChatPath } from "@/lib/app-routes";
import { cn } from "@/lib/utils";

type SurfaceKind =
  | "chat"
  | "library"
  | "projects"
  | "plugins"
  | "my-clauxen"
  | "children";

function surfaceKind(pathname: string): SurfaceKind {
  if (isChatSurfacePath(pathname)) return "chat";
  if (pathname === "/library" || pathname.startsWith("/library/")) {
    return "library";
  }
  if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    return "projects";
  }
  if (pathname === "/plugins" || pathname.startsWith("/plugins/")) {
    return "plugins";
  }
  if (pathname === "/my-clauxen" || pathname.startsWith("/my-clauxen/")) {
    return "my-clauxen";
  }
  return "children";
}

/**
 * Instant client surfaces for main app routes. Soft-nav updates the live
 * pathname before Next swaps RSC `{children}`, so these screens paint like
 * in-place components while the URL stays a real page.
 *
 * ChatView stays mounted (CSS-hidden off chat routes) so `/new` ↔ `/c/:id`
 * never remounts a live stream.
 */
export function AppPageSurface({ children }: { children: React.ReactNode }) {
  const livePathname = useAppPathname();
  const nextPathname = usePathname() || "";
  const kind = surfaceKind(livePathname);
  const childrenCaughtUp = nextPathname === livePathname;

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden items-stretch",
          kind !== "chat" && "hidden",
        )}
        hidden={kind !== "chat"}
        inert={kind !== "chat" || undefined}
        aria-hidden={kind !== "chat" || undefined}
      >
        <Suspense fallback={<AppContentLoader label="Opening chat" />}>
          <ChatSurface />
        </Suspense>
      </div>

      {kind === "library" ||
      kind === "projects" ||
      kind === "plugins" ||
      kind === "my-clauxen" ||
      kind === "children" ? (
        <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden">
          {kind === "library" ? <LibraryView /> : null}
          {kind === "projects" ? <ProjectsView /> : null}
          {kind === "plugins" ? <PluginsView /> : null}
          {kind === "my-clauxen" ? <MyClauxenView /> : null}
          {kind === "children" ? (
            childrenCaughtUp ? (
              children
            ) : (
              <AppContentLoader label="Opening page" />
            )
          ) : null}
        </div>
      ) : kind === "chat" && childrenCaughtUp ? (
        children
      ) : null}
    </>
  );
}

function ChatSurface() {
  const pathname = useAppPathname();
  const searchParams = useSearchParams();
  const initialPrompt = isNewChatPath(pathname)
    ? searchParams.get("prompt")?.trim() || undefined
    : undefined;
  return <ChatView initialPrompt={initialPrompt} />;
}
