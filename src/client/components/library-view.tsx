"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Download,
  File as FileIcon,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "@/components/ui/bootstrap-icon";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { uploadUserFile } from "@/lib/api/files";
import {
  createLibraryFolder,
  deleteLibraryEntries,
  getLibrary,
  moveLibraryEntries,
  renameLibraryEntry,
  type LibraryEntryRef,
  type LibraryFile,
  type LibraryFolder,
  type LibraryListing,
} from "@/lib/api/library";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";

type LibraryEntry =
  | {
      kind: "folder";
      id: string;
      name: string;
      updatedAt: string;
      folder: LibraryFolder;
    }
  | {
      kind: "file";
      id: string;
      name: string;
      updatedAt: string;
      size: number;
      mime: string;
      file: LibraryFile;
    };

type Filter = "all" | "folders" | "documents" | "images" | "code";
type SortKey = "name" | "type" | "modified" | "size";
type ViewMode = "list" | "grid";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All items" },
  { id: "folders", label: "Folders" },
  { id: "documents", label: "Documents" },
  { id: "images", label: "Images" },
  { id: "code", label: "Code & Data" },
];

const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".ts",
  ".py",
  ".sql",
] as const;

function entryKey(entry: Pick<LibraryEntry, "kind" | "id">) {
  return `${entry.kind}:${entry.id}`;
}

function formatSize(bytes: number) {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (3600 * 1000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function isImage(entry: LibraryEntry) {
  return (
    entry.kind === "file" &&
    (entry.mime.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(entry.name))
  );
}

function isCodeOrData(entry: LibraryEntry) {
  if (entry.kind !== "file") return false;
  return (
    /\.(json|js|jsx|ts|tsx|py|html|css|sql|csv|tsv|ya?ml|xml|sh|env)$/i.test(
      entry.name,
    ) ||
    entry.mime === "application/json" ||
    entry.mime === "text/csv"
  );
}

function isDocument(entry: LibraryEntry) {
  if (entry.kind !== "file") return false;
  return (
    !isImage(entry) &&
    !isCodeOrData(entry) &&
    (entry.mime.startsWith("text/") ||
      entry.mime === "application/pdf" ||
      /\.(md|txt|pdf|docx?|xlsx?|pptx?|rtf)$/i.test(entry.name))
  );
}

function getFileExtension(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

function typeBadge(entry: LibraryEntry) {
  if (entry.kind === "folder") return "Folder";
  const ext = getFileExtension(entry.name);
  if (ext) return ext.toUpperCase();
  if (entry.mime.startsWith("image/")) return "Image";
  if (entry.mime === "application/pdf") return "PDF";
  if (entry.mime.startsWith("text/")) return "Text";
  return "File";
}

function iconFor(entry: LibraryEntry): LucideIcon {
  if (entry.kind === "folder") return Folder;
  if (isImage(entry)) return FileImage;
  if (/\.(csv|xlsx?|tsv)$/i.test(entry.name)) return FileSpreadsheet;
  if (isCodeOrData(entry)) return FileCode;
  if (isDocument(entry)) return FileText;
  return FileIcon;
}

function iconStyle(entry: LibraryEntry): {
  wrap: string;
  glyph: string;
  fill?: boolean;
} {
  if (entry.kind === "folder") {
    return {
      wrap: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400",
      glyph: "text-amber-600 dark:text-amber-400",
      fill: true,
    };
  }
  if (isImage(entry)) {
    return {
      wrap: "bg-purple-500/10 text-purple-600 dark:bg-purple-400/15 dark:text-purple-400",
      glyph: "text-purple-600 dark:text-purple-400",
    };
  }
  if (isCodeOrData(entry)) {
    return {
      wrap: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400",
      glyph: "text-indigo-600 dark:text-indigo-400",
    };
  }
  if (/\.pdf$/i.test(entry.name)) {
    return {
      wrap: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-400",
      glyph: "text-rose-600 dark:text-rose-400",
    };
  }
  return {
    wrap: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400",
    glyph: "text-sky-600 dark:text-sky-400",
  };
}

function splitName(name: string) {
  const index = name.lastIndexOf(".");
  if (index <= 0) return { base: name, ext: ".txt" };
  const ext = name.slice(index).toLowerCase();
  return (TEXT_EXTENSIONS as readonly string[]).includes(ext as any)
    ? { base: name.slice(0, index), ext }
    : { base: name, ext: ".txt" };
}

function mimeForExtension(ext: string) {
  if (ext === ".md") return "text/markdown";
  if (ext === ".json") return "application/json";
  if (ext === ".csv") return "text/csv";
  if (ext === ".ts") return "text/typescript";
  if (ext === ".py") return "text/x-python";
  if (ext === ".sql") return "application/sql";
  return "text/plain";
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSort: (column: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sortKey === column;
  const Arrow = sortDirection === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}${
        active
          ? sortDirection === "asc"
            ? ", ascending"
            : ", descending"
          : ""
      }`}
      className={cn(
        "group/sort inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium tracking-tight text-[var(--ui-fg-muted)] transition-colors hover:text-[var(--ui-fg)]",
        align === "right" && "justify-self-end",
        active && "text-[var(--ui-fg)] font-semibold",
        className,
      )}
    >
      <span>{label}</span>
      <Arrow
        className={cn(
          "size-3 shrink-0 transition-all",
          active
            ? "opacity-100 text-[var(--ui-fg)]"
            : "opacity-0 group-hover/sort:opacity-40",
        )}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}

export function LibraryView() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [listing, setListing] = useState<LibraryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal dialog states
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("untitled");
  const [pasteExt, setPasteExt] = useState<string>(".md");
  const [pasteContent, setPasteContent] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LibraryEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<LibraryEntryRef[] | null>(
    null,
  );

  const load = useCallback(
    async (folderId?: string | null) => {
      setLoading(true);
      try {
        const next = await getLibrary(folderId);
        setListing(next);
        setSelected(new Set());
      } catch (error) {
        toast({
          title: "Unable to load library",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const rawEntries = useMemo<LibraryEntry[]>(() => {
    if (!listing) return [];
    const folders: LibraryEntry[] = listing.folders.map((folder) => ({
      kind: "folder",
      id: folder.id,
      name: folder.name,
      updatedAt: folder.updated_at,
      folder,
    }));
    const files: LibraryEntry[] = listing.files.map((file) => ({
      kind: "file",
      id: file.id,
      name: file.original_name,
      updatedAt: file.updated_at,
      size: Number(file.size_bytes || 0),
      mime: file.mime_type || "application/octet-stream",
      file,
    }));
    return [...folders, ...files];
  }, [listing]);

  const filteredEntries = useMemo<LibraryEntry[]>(() => {
    const needle = query.trim().toLowerCase();
    return rawEntries
      .filter((entry) => {
        if (needle && !entry.name.toLowerCase().includes(needle)) {
          return false;
        }
        if (filter === "folders") return entry.kind === "folder";
        if (filter === "images") return isImage(entry);
        if (filter === "code") return isCodeOrData(entry);
        if (filter === "documents") return isDocument(entry);
        return true;
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        let diff = 0;
        if (sortKey === "name") {
          diff = a.name.localeCompare(b.name, undefined, { numeric: true });
        } else if (sortKey === "type") {
          diff = typeBadge(a).localeCompare(typeBadge(b));
        } else if (sortKey === "modified") {
          diff =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        } else if (sortKey === "size") {
          diff =
            (a.kind === "file" ? a.size : 0) -
            (b.kind === "file" ? b.size : 0);
        }
        return sortDirection === "asc" ? diff : -diff;
      });
  }, [filter, query, rawEntries, sortDirection, sortKey]);

  const selectedRefs = useMemo<LibraryEntryRef[]>(
    () =>
      filteredEntries
        .filter((entry) => selected.has(entryKey(entry)))
        .map(({ id, kind }) => ({ id, kind })),
    [filteredEntries, selected],
  );

  const allSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => selected.has(entryKey(entry)));
  const someSelected = selected.size > 0 && !allSelected;

  const totalFiles = listing?.files.length ?? 0;
  const totalFolders = listing?.folders.length ?? 0;
  const totalSizeBytes = useMemo(
    () =>
      listing?.files.reduce(
        (sum, file) => sum + Number(file.size_bytes || 0),
        0,
      ) ?? 0,
    [listing?.files],
  );

  const withBusy = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      try {
        await action();
      } catch (error) {
        toast({
          title: "Action failed",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const uploadFiles = useCallback(
    (files: FileList | File[]) =>
      withBusy(async () => {
        const rows = Array.from(files);
        if (!rows.length) return;
        await Promise.all(
          rows.map((file) =>
            uploadUserFile(file, { folderId: listing?.folderId }),
          ),
        );
        await load(listing?.folderId);
        toast({
          title:
            rows.length === 1
              ? `"${rows[0].name}" uploaded`
              : `${rows.length} files uploaded successfully`,
        });
      }),
    [listing?.folderId, load, toast, withBusy],
  );

  const openPaste = () => {
    setPasteName("notes");
    setPasteExt(".md");
    setPasteContent("");
    setPasteOpen(true);
  };

  const createPastedFile = () =>
    withBusy(async () => {
      const base = pasteName.trim();
      if (!base) throw new Error("Please enter a valid file name.");
      if (!pasteContent.trim()) throw new Error("File content cannot be empty.");
      const { base: cleanBase } = splitName(base);
      const fullName = `${cleanBase}${pasteExt}`;
      await uploadUserFile(
        new File([pasteContent], fullName, {
          type: mimeForExtension(pasteExt),
        }),
        { folderId: listing?.folderId },
      );
      setPasteOpen(false);
      await load(listing?.folderId);
      toast({ title: `File "${fullName}" created` });
    });

  const createFolder = () =>
    withBusy(async () => {
      const name = folderName.trim();
      if (!name) return;
      await createLibraryFolder({
        name,
        parentId: listing?.folderId,
      });
      setFolderName("");
      setFolderOpen(false);
      await load(listing?.folderId);
      toast({ title: `Folder "${name}" created` });
    });

  const move = (items: LibraryEntryRef[], targetFolderId: string | null) =>
    withBusy(async () => {
      if (!items.length) return;
      await moveLibraryEntries(items, targetFolderId);
      setMoveOpen(false);
      setSelected(new Set());
      await load(listing?.folderId);
      toast({
        title:
          items.length === 1
            ? "Item moved successfully"
            : `${items.length} items moved`,
      });
    });

  const confirmDelete = () =>
    withBusy(async () => {
      if (!deleteTargets?.length) return;
      await deleteLibraryEntries(deleteTargets);
      setDeleteTargets(null);
      setSelected(new Set());
      await load(listing?.folderId);
      toast({
        title:
          deleteTargets.length === 1
            ? "Item deleted"
            : `${deleteTargets.length} items deleted`,
      });
    });

  const confirmRename = () =>
    withBusy(async () => {
      const name = renameValue.trim();
      if (!renameTarget || !name || name === renameTarget.name) {
        setRenameTarget(null);
        return;
      }
      await renameLibraryEntry({
        id: renameTarget.id,
        kind: renameTarget.kind,
        name,
      });
      setRenameTarget(null);
      await load(listing?.folderId);
      toast({ title: "Renamed successfully" });
    });

  const openEntry = (entry: LibraryEntry) => {
    if (entry.kind === "folder") {
      void load(entry.id);
      return;
    }
    const downloadUrl = `/api/v1/files/${encodeURIComponent(entry.id)}/content?download=1`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = entry.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (next: SortKey) => {
    if (sortKey === next) {
      setSortDirection((val) => (val === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      setSortDirection(next === "modified" || next === "size" ? "desc" : "asc");
    }
  };

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const currentFolderName =
    listing?.breadcrumbs.length
      ? listing.breadcrumbs[listing.breadcrumbs.length - 1]?.name
      : "Root Library";

  return (
    <div
      className="cx-library relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans select-none"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDraggingOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDraggingOver(false);
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDraggingOver(false);
        void uploadFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void uploadFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {isMobile ? (
        <MobilePageHeader
          title="Library"
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
          trailing={
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className={cn(appBtn.primarySm, "h-8 px-3 gap-1.5 text-[13px]")}
            >
              <Upload className="size-3.5" /> Upload
            </button>
          }
        />
      ) : null}

      {/* Main Content Area */}
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1100px] flex-1 flex-col px-4 pt-4 sm:px-8 sm:pt-7">
        {/* Top Header */}
        <header className="shrink-0 space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--ui-fg)] sm:text-[24px]">
                Library
              </h1>
              <p className="mt-0.5 text-[13px] leading-5 text-[var(--ui-fg-muted)]">
                Files and datasets organized for your chats, agents, and
                projects.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFolderName("");
                  setFolderOpen(true);
                }}
                className={cn(
                  appBtn.secondarySm,
                  "h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium shadow-none hover:bg-[var(--ui-hover-wash)]",
                )}
              >
                <FolderPlus className="size-3.5" strokeWidth={1.75} />
                <span>New folder</span>
              </button>

              <button
                type="button"
                onClick={openPaste}
                className={cn(
                  appBtn.secondarySm,
                  "h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium shadow-none hover:bg-[var(--ui-hover-wash)]",
                )}
              >
                <FileText className="size-3.5" strokeWidth={1.75} />
                <span>Paste text</span>
              </button>

              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={busy}
                className={cn(
                  appBtn.primarySm,
                  "h-8 gap-1.5 rounded-lg px-3 text-[12.5px] font-medium shadow-sm active:scale-[0.98]",
                )}
              >
                <Upload className="size-3.5" strokeWidth={2} />
                <span>Upload</span>
              </button>
            </div>
          </div>

          {/* Search, Filter Bar & View Toggle */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {/* Search Bar */}
              <label className="relative flex h-8 min-w-[180px] max-w-[260px] flex-1 items-center">
                <Search
                  className="pointer-events-none absolute left-2.5 size-3.5 text-[var(--ui-fg-placeholder)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search files and folders…"
                  aria-label="Search files"
                  className="h-8 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] pl-8 pr-7 text-[12.5px] text-[var(--ui-fg)] placeholder:text-[var(--ui-fg-placeholder)] outline-none transition-colors focus:border-[var(--ui-field-focus-border)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 size-5 grid place-items-center rounded-md text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </label>

              {/* Category Filter Pills */}
              <div
                className="flex items-center gap-1 overflow-x-auto py-0.5"
                role="tablist"
                aria-label="Category filter"
              >
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => {
                      setFilter(item.id);
                      setSelected(new Set());
                    }}
                    className={cn(
                      "h-7 shrink-0 rounded-md px-2.5 text-[12px] font-medium transition-colors outline-none",
                      filter === item.id
                        ? "bg-[var(--ui-fg)] text-[var(--app-panel-bg)] shadow-sm"
                        : "text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <div className="flex items-center rounded-lg border border-[var(--ui-border)] p-0.5 bg-[var(--ui-muted-surface)]">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  title="List view"
                  className={cn(
                    "grid size-6 place-items-center rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs font-medium"
                      : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  <ListIcon className="size-3.5" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  title="Grid view"
                  className={cn(
                    "grid size-6 place-items-center rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-[var(--app-panel-bg)] text-[var(--ui-fg)] shadow-xs font-medium"
                      : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  <LayoutGrid className="size-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>

          {/* Breadcrumb & Metadata Strip */}
          <div className="flex items-center justify-between border-b border-[var(--ui-border-subtle)] pb-2.5 text-[12.5px]">
            <nav
              className="flex min-w-0 items-center gap-1 font-medium text-[var(--ui-fg-muted)]"
              aria-label="Breadcrumb navigation"
            >
              <button
                type="button"
                onClick={() => void load(null)}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] transition-colors"
              >
                <Folder className="size-3.5 text-amber-500/80" />
                <span>Library</span>
              </button>

              {listing?.breadcrumbs.map((crumb) => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight
                    className="size-3 shrink-0 text-[var(--ui-fg-placeholder)]"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => void load(crumb.id)}
                    className="max-w-[140px] truncate rounded-md px-1.5 py-0.5 text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] transition-colors"
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>

            {!loading ? (
              <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--ui-fg-placeholder)]">
                {totalFolders} {totalFolders === 1 ? "folder" : "folders"} ·{" "}
                {totalFiles} {totalFiles === 1 ? "file" : "files"}
                {totalSizeBytes > 0 ? ` · ${formatSize(totalSizeBytes)}` : ""}
              </span>
            ) : null}
          </div>
        </header>

        {/* Content Listing (List / Grid) */}
        <div
          className="app-scrollbar min-h-0 flex-1 overflow-y-auto pb-24"
          data-scroll-region=""
        >
          {loading ? (
            <div className="space-y-1.5 py-2">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-2.5"
                >
                  <Skeleton className="size-7 rounded-lg" />
                  <Skeleton
                    variant="text"
                    className="h-3.5 w-48 max-w-[40%]"
                  />
                  <Skeleton
                    variant="text"
                    className="ml-auto h-3 w-16 hidden sm:block"
                  />
                  <Skeleton
                    variant="text"
                    className="h-3 w-12 hidden sm:block"
                  />
                </div>
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)] shadow-xs">
                {query ? (
                  <Search className="size-5" strokeWidth={1.75} />
                ) : (
                  <HardDrive className="size-5" strokeWidth={1.75} />
                )}
              </div>
              <h2 className="mt-3.5 text-[14.5px] font-medium tracking-tight text-[var(--ui-fg)]">
                {query
                  ? "No matching files or folders"
                  : filter !== "all"
                    ? `No ${filter} found in this folder`
                    : "This folder is empty"}
              </h2>
              <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--ui-fg-muted)]">
                {query
                  ? `No items match “${query}”. Try checking spelling or switching filters.`
                  : "Upload documents, spreadsheets, or code files to access them in conversations."}
              </p>
              {!query ? (
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className={cn(appBtn.secondarySm, "h-8 px-3 gap-1.5")}
                  >
                    <Upload className="size-3.5" /> Upload files
                  </button>
                  <button
                    type="button"
                    onClick={openPaste}
                    className={cn(appBtn.secondarySm, "h-8 px-3 gap-1.5")}
                  >
                    <FileText className="size-3.5" /> Paste snippet
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn(
                    appBtn.secondarySm,
                    "mt-4 h-8 px-3 text-[12.5px]",
                  )}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : viewMode === "list" ? (
            /* ================= Table / List Mode ================= */
            <div className="w-full" role="table" aria-label="Library files">
              {/* Header Row */}
              <div
                className="grid grid-cols-[32px_minmax(0,1fr)_44px] sm:grid-cols-[32px_minmax(0,1fr)_100px_130px_90px_44px] items-center gap-2 border-b border-[var(--ui-border-subtle)] px-2 py-1.5 text-[12px] font-medium text-[var(--ui-fg-muted)]"
                role="row"
              >
                <span className="flex justify-center" role="columnheader">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="cx-check"
                    checked={allSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = someSelected;
                    }}
                    onChange={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(filteredEntries.map(entryKey)),
                      )
                    }
                  />
                </span>
                <SortHeader
                  label="Name"
                  column="name"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Type"
                  column="type"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className="hidden sm:inline-flex"
                />
                <SortHeader
                  label="Modified"
                  column="modified"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className="hidden sm:inline-flex"
                />
                <SortHeader
                  label="Size"
                  column="size"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  align="right"
                  className="hidden sm:inline-flex"
                />
                <span role="columnheader" className="sr-only">
                  Actions
                </span>
              </div>

              {/* Rows */}
              <div role="rowgroup" className="divide-y divide-[var(--ui-border-subtle)]">
                {filteredEntries.map((entry) => {
                  const key = entryKey(entry);
                  const isChecked = selected.has(key);
                  const style = iconStyle(entry);
                  const Icon = iconFor(entry);

                  return (
                    <div
                      key={key}
                      role="row"
                      aria-selected={isChecked}
                      draggable
                      onDragStart={(event) => {
                        const refs =
                          isChecked && selectedRefs.length
                            ? selectedRefs
                            : [{ id: entry.id, kind: entry.kind }];
                        event.dataTransfer.setData(
                          "application/x-clauxen-library",
                          JSON.stringify(refs),
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={
                        entry.kind === "folder"
                          ? (event) => {
                              if (
                                event.dataTransfer.types.includes(
                                  "application/x-clauxen-library",
                                )
                              ) {
                                event.preventDefault();
                              }
                            }
                          : undefined
                      }
                      onDrop={
                        entry.kind === "folder"
                          ? (event) => {
                              const payload = event.dataTransfer.getData(
                                "application/x-clauxen-library",
                              );
                              if (!payload) return;
                              event.preventDefault();
                              event.stopPropagation();
                              void move(
                                JSON.parse(payload) as LibraryEntryRef[],
                                entry.id,
                              );
                            }
                          : undefined
                      }
                      onDoubleClick={() => openEntry(entry)}
                      className={cn(
                        "group grid grid-cols-[32px_minmax(0,1fr)_44px] sm:grid-cols-[32px_minmax(0,1fr)_100px_130px_90px_44px] items-center gap-2 rounded-lg px-2 py-2 transition-colors",
                        isChecked
                          ? "bg-[color-mix(in_oklab,var(--ui-fg)_6%,transparent)]"
                          : "hover:bg-[var(--ui-hover-wash)]",
                      )}
                    >
                      {/* Checkbox */}
                      <span className="flex justify-center" role="cell">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelected(key)}
                          aria-label={`Select ${entry.name}`}
                          className={cn(
                            "cx-check transition-opacity",
                            isChecked || selected.size > 0
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                        />
                      </span>

                      {/* Name & Icon */}
                      <button
                        type="button"
                        role="cell"
                        onClick={() => openEntry(entry)}
                        className="flex min-w-0 items-center gap-2.5 text-left outline-none cursor-pointer"
                      >
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-md transition-transform group-hover:scale-105",
                            style.wrap,
                          )}
                        >
                          <Icon
                            className={cn("size-3.5", style.glyph)}
                            strokeWidth={1.9}
                            fill={style.fill ? "currentColor" : "none"}
                            fillOpacity={style.fill ? 0.2 : 0}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-5 text-[var(--ui-fg)] group-hover:text-[var(--brand-accent,#000)]">
                            {entry.name}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--ui-fg-muted)] sm:hidden">
                            {typeBadge(entry)} · {formatDate(entry.updatedAt)}
                            {entry.kind === "file"
                              ? ` · ${formatSize(entry.size)}`
                              : ""}
                          </span>
                        </div>
                      </button>

                      {/* Type Badge */}
                      <span
                        role="cell"
                        className="hidden truncate text-[12px] text-[var(--ui-fg-muted)] sm:block"
                      >
                        <span className="inline-flex items-center rounded-md bg-[var(--ui-muted-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ui-fg-subtle)] border border-[var(--ui-border-subtle)]">
                          {typeBadge(entry)}
                        </span>
                      </span>

                      {/* Modified */}
                      <span
                        role="cell"
                        className="hidden truncate text-[12px] tabular-nums text-[var(--ui-fg-muted)] sm:block"
                      >
                        {formatDate(entry.updatedAt)}
                      </span>

                      {/* Size */}
                      <span
                        role="cell"
                        className="hidden text-right text-[12px] tabular-nums text-[var(--ui-fg-muted)] sm:block"
                      >
                        {entry.kind === "file" ? formatSize(entry.size) : "—"}
                      </span>

                      {/* Action Menu */}
                      <span role="cell" className="flex justify-end">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${entry.name}`}
                              className="size-7 grid place-items-center rounded-md text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] opacity-70 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="size-4" strokeWidth={1.75} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={4}
                            className="w-[180px] p-1"
                          >
                            <DropdownMenuItem
                              onSelect={() => openEntry(entry)}
                              className="gap-2 text-[12.5px]"
                            >
                              {entry.kind === "folder" ? (
                                <Folder className="size-3.5" />
                              ) : (
                                <Download className="size-3.5" />
                              )}
                              <span>{entry.kind === "folder" ? "Open folder" : "Download"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameTarget(entry);
                                setRenameValue(entry.name);
                              }}
                              className="gap-2 text-[12.5px]"
                            >
                              <Pencil className="size-3.5" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setSelected(new Set([key]));
                                setMoveOpen(true);
                              }}
                              className="gap-2 text-[12.5px]"
                            >
                              <FolderInput className="size-3.5" />
                              <span>Move to…</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() =>
                                setDeleteTargets([
                                  { id: entry.id, kind: entry.kind },
                                ])
                              }
                              className="gap-2 text-[12.5px] text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= Grid / Cards Mode ================= */
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredEntries.map((entry) => {
                const key = entryKey(entry);
                const isChecked = selected.has(key);
                const style = iconStyle(entry);
                const Icon = iconFor(entry);

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEntry(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openEntry(entry);
                    }}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left outline-none transition-all cursor-pointer",
                      isChecked
                        ? "border-[var(--ui-fg)] bg-[color-mix(in_oklab,var(--ui-fg)_5%,transparent)] shadow-xs"
                        : "border-[var(--ui-border)] bg-[var(--ui-card-bg)] hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)]",
                    )}
                  >
                    {/* Top Row: Checkbox and More */}
                    <div className="flex items-center justify-between">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelected(key)}
                        aria-label={`Select ${entry.name}`}
                        className={cn(
                          "cx-check",
                          isChecked || selected.size > 0
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100 transition-opacity",
                        )}
                      />

                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Options for ${entry.name}`}
                            className="size-6 grid place-items-center rounded-md text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[180px] p-1"
                        >
                          <DropdownMenuItem
                            onSelect={() => openEntry(entry)}
                            className="gap-2 text-[12.5px]"
                          >
                            {entry.kind === "folder" ? (
                              <Folder className="size-3.5" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            <span>{entry.kind === "folder" ? "Open" : "Download"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenameTarget(entry);
                              setRenameValue(entry.name);
                            }}
                            className="gap-2 text-[12.5px]"
                          >
                            <Pencil className="size-3.5" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setSelected(new Set([key]));
                              setMoveOpen(true);
                            }}
                            className="gap-2 text-[12.5px]"
                          >
                            <FolderInput className="size-3.5" />
                            <span>Move to…</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              setDeleteTargets([
                                { id: entry.id, kind: entry.kind },
                              ])
                            }
                            className="gap-2 text-[12.5px] text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Middle: Icon */}
                    <div className="my-3 flex justify-center">
                      <div
                        className={cn(
                          "grid size-12 place-items-center rounded-xl transition-transform group-hover:scale-105",
                          style.wrap,
                        )}
                      >
                        <Icon
                          className={cn("size-6", style.glyph)}
                          strokeWidth={1.8}
                          fill={style.fill ? "currentColor" : "none"}
                          fillOpacity={style.fill ? 0.2 : 0}
                        />
                      </div>
                    </div>

                    {/* Bottom: Info */}
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[var(--ui-fg)] group-hover:underline">
                        {entry.name}
                      </span>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--ui-fg-muted)]">
                        <span>{typeBadge(entry)}</span>
                        <span>
                          {entry.kind === "file"
                            ? formatSize(entry.size)
                            : formatDate(entry.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Selection Bar */}
      {selected.size > 0 ? (
        <div
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--app-panel-bg)] px-3.5 py-1.5 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="toolbar"
          aria-label="Batch selection actions"
        >
          <span className="text-[12.5px] font-medium tabular-nums text-[var(--ui-fg)] pr-1">
            {selected.size} selected
          </span>
          <span className="h-3.5 w-px bg-[var(--ui-border)]" />
          <button
            type="button"
            onClick={() => setMoveOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)] transition-colors"
          >
            <FolderInput className="size-3.5" /> Move
          </button>
          <button
            type="button"
            onClick={() => setDeleteTargets(selectedRefs)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="size-6 grid place-items-center rounded-full text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Drag & Drop Overlay */}
      {draggingOver ? (
        <div className="pointer-events-none absolute inset-4 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-[var(--ui-fg)] bg-[color-mix(in_oklab,var(--app-panel-bg)_92%,transparent)] backdrop-blur-xs text-center animate-in fade-in duration-100">
          <div>
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--ui-hover-wash)] text-[var(--ui-fg)] shadow-xs">
              <Upload className="size-6" strokeWidth={2} />
            </div>
            <p className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--ui-fg)]">
              Drop files to upload
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--ui-fg-muted)]">
              Files will be saved into {currentFolderName}.
            </p>
          </div>
        </div>
      ) : null}

      {/* Dialog: Paste text */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-[500px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-tight text-[var(--ui-fg)]">
              Create text file
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--ui-fg-muted)]">
              Paste or draft notes, code, or datasets to store in your Library.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3.5 py-2">
            <div>
              <label
                htmlFor="library-paste-name"
                className="block text-[12px] font-medium text-[var(--ui-fg-muted)] mb-1.5"
              >
                File name
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="library-paste-name"
                  autoFocus
                  value={pasteName}
                  onChange={(e) => setPasteName(e.target.value)}
                  placeholder="notes"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-2.5 text-[13px] text-[var(--ui-fg)] outline-none focus:border-[var(--ui-field-focus-border)]"
                />
                <div className="flex items-center rounded-lg border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] p-0.5">
                  {TEXT_EXTENSIONS.map((ext) => (
                    <button
                      key={ext}
                      type="button"
                      onClick={() => setPasteExt(ext)}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-mono transition-colors",
                        pasteExt === ext
                          ? "bg-[var(--app-panel-bg)] font-semibold text-[var(--ui-fg)] shadow-xs"
                          : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                      )}
                    >
                      {ext}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="library-paste-content"
                  className="block text-[12px] font-medium text-[var(--ui-fg-muted)]"
                >
                  Content
                </label>
                <span className="text-[11px] tabular-nums text-[var(--ui-fg-placeholder)]">
                  {pasteContent.length.toLocaleString()} characters
                </span>
              </div>
              <textarea
                id="library-paste-content"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    void createPastedFile();
                  }
                }}
                placeholder="Type or paste contents here…"
                rows={9}
                className="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] p-2.5 font-mono text-[12px] leading-relaxed text-[var(--ui-fg)] outline-none focus:border-[var(--ui-field-focus-border)]"
              />
            </div>
          </DialogBody>
          <DialogFooter className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[var(--ui-fg-placeholder)]">
              ⌘ Enter to create
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className={cn(appBtn.secondarySm, "h-8 px-3")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !pasteName.trim() || !pasteContent.trim()}
                onClick={() => void createPastedFile()}
                className={cn(appBtn.primarySm, "h-8 px-3.5")}
              >
                Create file
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Folder */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-[360px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[var(--ui-fg)]">
              Create folder
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[var(--ui-fg-muted)]">
              Add a folder inside {currentFolderName}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) void createFolder();
              }}
              placeholder="e.g. Research Papers"
              aria-label="Folder name"
              className="h-8 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-2.5 text-[13px] text-[var(--ui-fg)] outline-none focus:border-[var(--ui-field-focus-border)]"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFolderOpen(false)}
              className={cn(appBtn.secondarySm, "h-8 px-3")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !folderName.trim()}
              onClick={() => void createFolder()}
              className={cn(appBtn.primarySm, "h-8 px-3.5")}
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-[360px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[var(--ui-fg)]">
              Rename {renameTarget?.kind === "folder" ? "folder" : "file"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onFocus={(e) => {
                const dot = e.currentTarget.value.lastIndexOf(".");
                if (renameTarget?.kind === "file" && dot > 0) {
                  e.currentTarget.setSelectionRange(0, dot);
                } else {
                  e.currentTarget.select();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmRename();
              }}
              aria-label="New name"
              className="h-8 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-2.5 text-[13px] text-[var(--ui-fg)] outline-none focus:border-[var(--ui-field-focus-border)]"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className={cn(appBtn.secondarySm, "h-8 px-3")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !renameValue.trim()}
              onClick={() => void confirmRename()}
              className={cn(appBtn.primarySm, "h-8 px-3.5")}
            >
              Rename
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Move */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-[380px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[var(--ui-fg)]">
              Move {selectedRefs.length || 1}{" "}
              {(selectedRefs.length || 1) === 1 ? "item" : "items"}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[var(--ui-fg-muted)]">
              Select destination folder.
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-2 max-h-64 space-y-1 overflow-y-auto py-2">
            <button
              type="button"
              onClick={() => void move(selectedRefs, null)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)] transition-colors"
            >
              <Folder className="size-4 text-amber-500" />
              <span className="font-medium">Library (Root)</span>
            </button>
            {listing?.allFolders
              .filter((f) => !selected.has(`folder:${f.id}`))
              .map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => void move(selectedRefs, folder.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)] transition-colors"
                >
                  <Folder className="size-4 text-amber-500" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
          </div>
          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setMoveOpen(false)}
              className={cn(appBtn.secondarySm, "h-8 px-3")}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete confirmation */}
      <Dialog
        open={deleteTargets !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets(null);
        }}
      >
        <DialogContent className="max-w-[380px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[var(--ui-fg)]">
              Delete {deleteTargets?.length === 1 ? "item" : `${deleteTargets?.length ?? 0} items`}?
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-relaxed text-[var(--ui-fg-muted)]">
              This will permanently remove the selected{" "}
              {deleteTargets?.length === 1 ? "item" : "items"} from your
              Library and all chats where they are attached.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <button
              type="button"
              onClick={() => setDeleteTargets(null)}
              className={cn(appBtn.secondarySm, "h-8 px-3")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmDelete()}
              className={cn(
                appBtn.primarySm,
                "h-8 px-3.5 bg-destructive hover:bg-destructive/90 text-white shadow-none",
              )}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
