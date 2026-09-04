"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  List,
  Maximize2,
  RotateCw,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  collectChatArtifacts,
  downloadArtifact,
  type ChatArtifact,
} from "@/lib/chat-artifacts";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
  inferLanguageFromPath,
} from "@/lib/create-file-tags";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type RailTab = "preview" | "files";

const TREE_DEFAULT_WIDTH = 180;
const TREE_MIN_WIDTH = 140;
const TREE_MAX_WIDTH = 320;

/** 32×32 header tab button (Preview / Files) — matches the rail chrome. */
function RailTabButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-[#636363] transition-colors duration-100 hover:bg-black/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
        pressed && "bg-black/[0.04] text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

/** 28×28 chrome button (navigation / toolbar rows). */
function ChromeIconButton({
  label,
  onClick,
  disabled = false,
  pressed,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#636363] transition-colors duration-100 dark:text-zinc-400",
        disabled
          ? "pointer-events-none opacity-50"
          : "hover:bg-black/[0.04] hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
        pressed && "bg-black/[0.04] text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title?: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-8 text-center">
      {title ? (
        <p className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
      ) : null}
      <p className="max-w-[420px] text-balance text-[14px] leading-[21px] text-[#858585] dark:text-zinc-400">
        {body}
      </p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[rgba(15,13,10,0.08)] bg-transparent px-2.5 text-[14px] font-medium tracking-[-0.2px] text-zinc-800 transition-colors duration-100 hover:bg-black/[0.03] dark:border-white/[0.10] dark:text-zinc-200 dark:hover:bg-white/[0.05]"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ChatArtifactsPanel({
  onClose,
  messages,
  className,
}: {
  onClose: () => void;
  messages: Message[];
  className?: string;
}) {
  const viewer = useOptionalArtifactViewer();
  const artifacts = useMemo(() => collectChatArtifacts(messages), [messages]);

  const [tab, setTab] = useState<RailTab>("files");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [treeWidth, setTreeWidth] = useState(TREE_DEFAULT_WIDTH);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewMobile, setPreviewMobile] = useState(false);
  const treeResizeRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  const selected =
    artifacts.find((artifact) => artifact.id === selectedId) ?? null;
  const selectedLanguage = selected
    ? (selected.language ?? inferLanguageFromPath(selected.path))
    : "text";
  const selectedPreviewable = selected
    ? artifactSupportsPreview(selected.path, selectedLanguage)
    : false;

  const visibleArtifacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return artifacts;
    return artifacts.filter(
      (artifact) =>
        artifact.fileName.toLowerCase().includes(query) ||
        artifact.path.toLowerCase().includes(query),
    );
  }, [artifacts, searchQuery]);

  const openSelectedInNewTab = () => {
    if (!selected?.content) return;
    const blob = new Blob([selected.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const startTreeResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    treeResizeRef.current = { startX: event.clientX, startWidth: treeWidth };
    const onMove = (moveEvent: PointerEvent) => {
      const start = treeResizeRef.current;
      if (!start) return;
      const next = Math.min(
        TREE_MAX_WIDTH,
        Math.max(
          TREE_MIN_WIDTH,
          start.startWidth + (moveEvent.clientX - start.startX),
        ),
      );
      setTreeWidth(next);
    };
    const onUp = () => {
      treeResizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <aside
      className={cn(
        "flex h-full w-full min-w-0 flex-col bg-transparent p-2",
        className,
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[14px] border border-[rgba(15,13,10,0.04)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/[0.06] dark:bg-zinc-900">
        {/* Rail header — Preview / Files tabs */}
        <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[rgba(15,13,10,0.04)] p-1.5 dark:border-white/[0.05]">
          <RailTabButton
            label="Preview"
            pressed={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            <Globe className="size-[18px]" strokeWidth={1.8} />
          </RailTabButton>
          <RailTabButton
            label="Files"
            pressed={tab === "files"}
            onClick={() => setTab("files")}
          >
            <Folder className="size-[18px]" strokeWidth={1.8} />
          </RailTabButton>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close right sidebar"
            className="ui-icon-button text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-800 lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {tab === "preview" ? (
          <>
            {/* Browser chrome */}
            <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[rgba(15,13,10,0.04)] px-1.5 dark:border-white/[0.05]">
              <ChromeIconButton label="Back" disabled>
                <ArrowLeft className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <ChromeIconButton label="Forward" disabled>
                <ArrowRight className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <ChromeIconButton
                label="Reload preview"
                disabled={!selectedPreviewable}
                onClick={() => setPreviewKey((key) => key + 1)}
              >
                <RotateCw className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <span className="ml-2 min-w-0 flex-1 truncate whitespace-nowrap text-[13px] leading-[18px] text-[#636363] dark:text-zinc-400">
                {selectedPreviewable ? selected?.fileName : ""}
              </span>
              <ChromeIconButton
                label="Open in new tab"
                disabled={!selectedPreviewable}
                onClick={openSelectedInNewTab}
              >
                <ExternalLink className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <ChromeIconButton
                label="Mobile preview"
                disabled={!selectedPreviewable}
                pressed={previewMobile}
                onClick={() => setPreviewMobile((value) => !value)}
              >
                <Smartphone className="size-4" strokeWidth={2} />
              </ChromeIconButton>
            </div>

            {selectedPreviewable && selected ? (
              <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-[#fafafa] dark:bg-zinc-950/40">
                <div
                  className={cn(
                    "min-h-0 min-w-0 flex-1 overflow-auto bg-white dark:bg-zinc-900",
                    previewMobile &&
                      "my-3 max-w-[390px] flex-none rounded-xl border border-[rgba(15,13,10,0.08)] shadow-sm dark:border-white/[0.08]",
                  )}
                >
                  <div
                    key={previewKey}
                    className="artifact-preview-markdown px-5 py-5 sm:px-7 sm:py-7"
                  >
                    <MarkdownRenderer content={selected.content} />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Nothing to preview yet"
                body="Documents created in this chat can be previewed here. Select a Markdown file from the Files tab to see it rendered."
                action={{
                  label: "Browse files",
                  onClick: () => setTab("files"),
                }}
              />
            )}
          </>
        ) : (
          <>
            {/* Files toolbar */}
            <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[rgba(15,13,10,0.04)] px-1.5 dark:border-white/[0.05]">
              <ChromeIconButton
                label="File tree"
                pressed={treeOpen}
                onClick={() => setTreeOpen((open) => !open)}
              >
                <List className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <ChromeIconButton
                label="Search"
                pressed={searchOpen}
                onClick={() => {
                  setSearchOpen((open) => !open);
                  if (searchOpen) setSearchQuery("");
                }}
              >
                <Search className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <ChromeIconButton label="Back" disabled>
                <ArrowLeft className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <ChromeIconButton label="Forward" disabled>
                <ArrowRight className="size-4" strokeWidth={2} />
              </ChromeIconButton>
              <div className="min-w-0 flex-1" />
              {selected ? (
                <div className="flex shrink-0 items-center gap-0.5 pl-2">
                  <ChromeIconButton
                    label="Download file"
                    onClick={() => downloadArtifact(selected)}
                  >
                    <Download className="size-4" strokeWidth={2} />
                  </ChromeIconButton>
                  {viewer ? (
                    <ChromeIconButton
                      label="Expand file"
                      onClick={() =>
                        viewer.openArtifact(
                          selected,
                          selectedPreviewable ? "preview" : "code",
                        )
                      }
                    >
                      <Maximize2 className="size-4" strokeWidth={2} />
                    </ChromeIconButton>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Files body — tree + content */}
            <div className="flex min-h-0 flex-1">
              {treeOpen ? (
                <>
                  <div
                    className="flex h-full shrink-0 flex-col overflow-hidden"
                    style={{ width: treeWidth }}
                  >
                    <div className="flex min-h-[26px] shrink-0 items-center justify-between gap-1 px-1.5 py-1">
                      <span className="text-[14px] leading-[21px] text-[#636363] dark:text-zinc-400">
                        Files
                      </span>
                      {artifacts.length > 0 ? (
                        <span className="text-[11px] text-zinc-400">
                          {artifacts.length}
                        </span>
                      ) : null}
                    </div>
                    {searchOpen ? (
                      <div className="shrink-0 px-1.5 pb-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder="Filter files"
                          autoFocus
                          className="h-7 w-full rounded-md border border-[rgba(15,13,10,0.08)] bg-transparent px-2 text-[12.5px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-white/[0.10] dark:text-zinc-200"
                        />
                      </div>
                    ) : null}
                    <ScrollArea className="min-h-0 flex-1">
                      {artifacts.length === 0 ? (
                        <p className="px-3 py-8 text-center text-[11px] leading-[15px] text-[#858585] dark:text-zinc-500">
                          Files created during this session will appear here
                        </p>
                      ) : visibleArtifacts.length === 0 ? (
                        <p className="px-3 py-8 text-center text-[11px] leading-[15px] text-[#858585] dark:text-zinc-500">
                          No files match this filter
                        </p>
                      ) : (
                        <div className="flex flex-col gap-0.5 px-1 pb-2">
                          {visibleArtifacts.map((artifact) => (
                            <button
                              key={artifact.id}
                              type="button"
                              onClick={() => setSelectedId(artifact.id)}
                              aria-pressed={selectedId === artifact.id}
                              className={cn(
                                "flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors duration-100",
                                selectedId === artifact.id
                                  ? "bg-black/[0.05] text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100"
                                  : "text-[#636363] hover:bg-black/[0.035] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100",
                              )}
                            >
                              <FileText
                                className="size-3.5 shrink-0 opacity-70"
                                strokeWidth={1.8}
                              />
                              <span className="truncate text-[13px] leading-[18px]">
                                {artifact.fileName}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize file sidebar"
                    onPointerDown={startTreeResize}
                    className="relative w-0 shrink-0 cursor-col-resize border-r border-[rgba(15,13,10,0.04)] transition-colors hover:border-zinc-300 dark:border-white/[0.05]"
                  >
                    <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
                  </div>
                </>
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {selected ? (
                  <>
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[rgba(15,13,10,0.04)] px-3 dark:border-white/[0.05]">
                      <FileText
                        className="size-4 shrink-0 text-zinc-500"
                        strokeWidth={1.8}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-[18px] text-zinc-900 dark:text-zinc-100">
                          {selected.fileName}
                        </p>
                        <p className="truncate text-[11px] leading-[14px] text-zinc-500">
                          {artifactMetaLabel(selected.path, selectedLanguage)}
                        </p>
                      </div>
                    </div>
                    {selected.content ? (
                      <ScrollArea className="min-h-0 flex-1 bg-[#fafafa] dark:bg-zinc-950/40">
                        <pre className="whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12px] leading-[18px] text-zinc-800 dark:text-zinc-200">
                          {selected.content}
                        </pre>
                      </ScrollArea>
                    ) : (
                      <EmptyState
                        title={selected.fileName}
                        body="This file is stored remotely. Download it to view its contents."
                        action={{
                          label: "Download file",
                          onClick: () => downloadArtifact(selected),
                        }}
                      />
                    )}
                  </>
                ) : (
                  <EmptyState body="Select a file to view its contents" />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
