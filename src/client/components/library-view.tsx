"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  File as FileIcon,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
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
  | { kind: "folder"; id: string; name: string; updatedAt: string; folder: LibraryFolder }
  | { kind: "file"; id: string; name: string; updatedAt: string; size: number; mime: string; file: LibraryFile };

type Filter = "all" | "folders" | "images" | "documents";
type SortKey = "name" | "type" | "modified" | "size";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "folders", label: "Folders" },
  { id: "images", label: "Images" },
  { id: "documents", label: "Documents" },
];

const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".csv"] as const;

const ROW_GRID =
  "grid grid-cols-[28px_minmax(0,1fr)_40px] items-center gap-x-2 sm:grid-cols-[28px_minmax(0,1fr)_96px_112px_72px_40px] sm:gap-x-3";

function entryKey(entry: Pick<LibraryEntry, "kind" | "id">) {
  return `${entry.kind}:${entry.id}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes ? `${bytes} B` : "—";
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
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function isImage(entry: LibraryEntry) {
  return entry.kind === "file" && entry.mime.startsWith("image/");
}

function typeLabel(entry: LibraryEntry) {
  if (entry.kind === "folder") return "Folder";
  if (entry.mime.startsWith("image/")) return "Image";
  if (entry.mime === "application/pdf") return "PDF";
  const ext = entry.name.includes(".") ? entry.name.split(".").pop() : "";
  if (ext && ext.length <= 5) return ext.toUpperCase();
  if (entry.mime.startsWith("text/")) return "Text";
  return "File";
}

function iconFor(entry: LibraryEntry): LucideIcon {
  if (entry.kind === "folder") return Folder;
  if (entry.mime.startsWith("image/")) return FileImage;
  if (/\.(json|js|ts|tsx|py|html|css)$/i.test(entry.name)) return FileCode;
  if (entry.mime.startsWith("text/") || /\.(md|txt|csv|pdf|docx?)$/i.test(entry.name)) return FileText;
  return FileIcon;
}

function splitName(name: string) {
  const index = name.lastIndexOf(".");
  if (index <= 0) return { base: name, ext: ".txt" };
  const ext = name.slice(index).toLowerCase();
  return (TEXT_EXTENSIONS as readonly string[]).includes(ext)
    ? { base: name.slice(0, index), ext }
    : { base: name, ext: ".txt" };
}

function mimeForExtension(ext: string) {
  if (ext === ".md") return "text/markdown";
  if (ext === ".json") return "application/json";
  if (ext === ".csv") return "text/csv";
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
      aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "no-hover-overlay group/sort inline-flex h-6 min-w-0 items-center gap-1 rounded-[6px] text-[12px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:text-[var(--ui-fg)]",
        align === "right" && "justify-self-end",
        active && "text-[var(--ui-fg)]",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <Arrow
        className={cn(
          "size-3 shrink-0 transition-opacity",
          active ? "opacity-70" : "opacity-0 group-hover/sort:opacity-40",
        )}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}

function EntryIcon({ entry }: { entry: LibraryEntry }) {
  const Icon = iconFor(entry);
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-[7px]",
        entry.kind === "folder"
          ? "bg-[color-mix(in_oklab,var(--ui-fg)_7%,transparent)] text-[var(--ui-fg)]"
          : "bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]",
      )}
    >
      <Icon className="size-[15px]" strokeWidth={1.75} fill={entry.kind === "folder" ? "currentColor" : "none"} fillOpacity={entry.kind === "folder" ? 0.12 : 0} />
    </span>
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("Untitled");
  const [pasteExt, setPasteExt] = useState<string>(".txt");
  const [pasteContent, setPasteContent] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LibraryEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<LibraryEntryRef[] | null>(null);

  const load = useCallback(async (folderId?: string | null) => {
    setLoading(true);
    try {
      const next = await getLibrary(folderId);
      setListing(next);
      setSelected(new Set());
    } catch (error) {
      toast({
        title: "Library unavailable",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(null);
  }, [load]);

  const entries = useMemo<LibraryEntry[]>(() => {
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
    const normalizedQuery = query.trim().toLowerCase();
    return [...folders, ...files]
      .filter((entry) => {
        if (normalizedQuery && !entry.name.toLowerCase().includes(normalizedQuery)) return false;
        if (filter === "folders") return entry.kind === "folder";
        if (filter === "images") return isImage(entry);
        if (filter === "documents") return entry.kind === "file" && !isImage(entry);
        return true;
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        let result = 0;
        if (sortKey === "name") result = a.name.localeCompare(b.name);
        if (sortKey === "type") result = typeLabel(a).localeCompare(typeLabel(b));
        if (sortKey === "modified") result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        if (sortKey === "size") result = (a.kind === "file" ? a.size : 0) - (b.kind === "file" ? b.size : 0);
        return sortDirection === "asc" ? result : -result;
      });
  }, [filter, listing, query, sortDirection, sortKey]);

  const selectedRefs = useMemo<LibraryEntryRef[]>(() => entries
    .filter((entry) => selected.has(entryKey(entry)))
    .map(({ id, kind }) => ({ id, kind })), [entries, selected]);

  const allSelected = entries.length > 0 && entries.every((entry) => selected.has(entryKey(entry)));
  const someSelected = selected.size > 0 && !allSelected;
  const itemCount = (listing?.folders.length ?? 0) + (listing?.files.length ?? 0);

  const withBusy = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast({
        title: "Could not complete that action",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const uploadFiles = useCallback((files: FileList | File[]) => withBusy(async () => {
    const rows = Array.from(files);
    await Promise.all(rows.map((file) => uploadUserFile(file, { folderId: listing?.folderId })));
    await load(listing?.folderId);
    toast({ title: rows.length === 1 ? "File uploaded" : `${rows.length} files uploaded` });
  }), [listing?.folderId, load, toast, withBusy]);

  const openPaste = () => {
    setPasteName("Untitled");
    setPasteExt(".txt");
    setPasteContent("");
    setPasteOpen(true);
  };

  const createPastedFile = () => withBusy(async () => {
    const base = pasteName.trim();
    if (!base || !pasteContent.trim()) throw new Error("Enter a file name and some text.");
    const { base: cleanBase } = splitName(base);
    const name = `${cleanBase}${pasteExt}`;
    await uploadUserFile(new File([pasteContent], name, { type: mimeForExtension(pasteExt) }), { folderId: listing?.folderId });
    setPasteOpen(false);
    await load(listing?.folderId);
    toast({ title: `${name} created` });
  });

  const createFolder = () => withBusy(async () => {
    await createLibraryFolder({ name: folderName.trim(), parentId: listing?.folderId });
    setFolderName("");
    setFolderOpen(false);
    await load(listing?.folderId);
  });

  const move = (items: LibraryEntryRef[], folderId: string | null) => withBusy(async () => {
    if (!items.length) return;
    await moveLibraryEntries(items, folderId);
    setMoveOpen(false);
    await load(listing?.folderId);
  });

  const confirmDelete = () => withBusy(async () => {
    if (!deleteTargets?.length) return;
    await deleteLibraryEntries(deleteTargets);
    setDeleteTargets(null);
    await load(listing?.folderId);
  });

  const confirmRename = () => withBusy(async () => {
    const name = renameValue.trim();
    if (!renameTarget || !name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    await renameLibraryEntry({ id: renameTarget.id, kind: renameTarget.kind, name });
    setRenameTarget(null);
    await load(listing?.folderId);
  });

  const openEntry = (entry: LibraryEntry) => {
    if (entry.kind === "folder") {
      void load(entry.id);
      return;
    }
    window.location.assign(
      `/api/v1/files/${encodeURIComponent(entry.id)}/content?download=1`,
    );
  };

  const toggleSort = (next: SortKey) => {
    if (sortKey === next) setSortDirection((value) => value === "asc" ? "desc" : "asc");
    else {
      setSortKey(next);
      setSortDirection(next === "modified" || next === "size" ? "desc" : "asc");
    }
  };

  const toggleSelected = (key: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const newMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={busy} className={cn(appBtn.primarySm, "gap-1 pl-2 pr-2.5")}>
          <Plus className="size-4" strokeWidth={2} /> New
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[200px]">
        <DropdownMenuItem onSelect={() => uploadInputRef.current?.click()} className="ui-menu-row">
          <Upload /> Upload files
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openPaste} className="ui-menu-row">
          <FileText /> Paste text
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { setFolderName(""); setFolderOpen(true); }} className="ui-menu-row">
          <FolderPlus /> New folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className="cx-library app-page-surface relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDraggingOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingOver(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDraggingOver(false);
        void uploadFiles(event.dataTransfer.files);
      }}
    >
      <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={(event) => {
        if (event.target.files?.length) void uploadFiles(event.target.files);
        event.currentTarget.value = "";
      }} />

      {isMobile ? <MobilePageHeader title="Library" onOpenMobileNav={openMobileNav} isNavOpen={!isSidebarCollapsed} trailing={newMenu} /> : null}

      <header className="mx-auto w-full max-w-[960px] px-4 pb-3 pt-5 sm:px-6 sm:pt-7">
        <div className="hidden items-end justify-between gap-3 sm:flex">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-[var(--ui-fg)]">Library</h1>
            <p className="text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
              Files and folders you can attach to any chat.
            </p>
          </div>
          {newMenu}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="cx-library-search relative flex h-8 min-w-0 flex-1 items-center sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-[var(--ui-fg-placeholder)]" strokeWidth={1.75} aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="cx-field h-8 !pl-8 !pr-7"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="ui-icon-button no-hover-overlay absolute right-1 !size-6">
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>
          <div className="cx-segmented" role="tablist" aria-label="Filter">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                data-active={filter === item.id || undefined}
                onClick={() => { setFilter(item.id); setSelected(new Set()); }}
                className="cx-segmented__item no-hover-overlay"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="mt-3 flex min-h-6 items-center gap-0.5 text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]" aria-label="Breadcrumb">
          <button type="button" onClick={() => void load(null)} className="cx-crumb no-hover-overlay">Library</button>
          {listing?.breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
              <button type="button" onClick={() => void load(crumb.id)} className="cx-crumb no-hover-overlay max-w-40 truncate">{crumb.name}</button>
            </React.Fragment>
          ))}
          {!loading ? (
            <span className="ml-auto text-[12px] tabular-nums text-[var(--ui-fg-subtle)]">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          ) : null}
        </nav>
      </header>

      <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto" data-scroll-region="">
        <div className="mx-auto w-full max-w-[960px] px-4 pb-24 sm:px-6">
          <div className="cx-table" role="table" aria-label="Library files">
            <div className={cn(ROW_GRID, "cx-table__head")} role="row">
              <span className="flex justify-center" role="columnheader">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="cx-check"
                  checked={allSelected}
                  ref={(node) => { if (node) node.indeterminate = someSelected; }}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(entries.map(entryKey)))}
                />
              </span>
              <SortHeader label="Name" column="name" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
              <SortHeader label="Type" column="type" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} className="max-sm:hidden" />
              <SortHeader label="Modified" column="modified" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} className="max-sm:hidden" />
              <SortHeader label="Size" column="size" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} align="right" className="max-sm:hidden" />
              <span role="columnheader" className="sr-only">Actions</span>
            </div>

            {loading ? (
              <div aria-busy="true" role="status">
                <span className="sr-only">Loading library</span>
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className={cn(ROW_GRID, "cx-table__row pointer-events-none")}>
                    <span />
                    <span className="flex items-center gap-2.5">
                      <Skeleton className="size-7 rounded-[7px]" style={{ ["--skeleton-delay" as string]: `${index * 60}ms` }} />
                      <Skeleton variant="text" className="h-3" style={{ width: `${[48, 36, 58, 42, 30, 52, 40][index]}%`, ["--skeleton-delay" as string]: `${index * 60}ms` }} />
                    </span>
                    <Skeleton variant="text" className="h-3 w-12 max-sm:hidden" />
                    <Skeleton variant="text" className="h-3 w-16 max-sm:hidden" />
                    <Skeleton variant="text" className="h-3 w-10 justify-self-end max-sm:hidden" />
                    <span />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]">
                  {query ? <Search className="size-[18px]" strokeWidth={1.75} /> : <Folder className="size-[18px]" strokeWidth={1.75} />}
                </span>
                <h2 className="mt-3 text-[14px] font-medium leading-5 text-[var(--ui-fg)]">
                  {query ? "No matching files" : filter !== "all" ? `No ${FILTERS.find((item) => item.id === filter)?.label.toLowerCase()} here` : "This folder is empty"}
                </h2>
                <p className="mt-0.5 max-w-xs text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
                  {query ? "Try a different name." : "Upload files, paste text, or drop files anywhere on this page."}
                </p>
                {!query ? (
                  <div className="mt-4 flex items-center gap-2">
                    <button type="button" onClick={() => uploadInputRef.current?.click()} className={cn(appBtn.secondarySm, "gap-1.5")}>
                      <Upload className="size-3.5" /> Upload
                    </button>
                    <button type="button" onClick={openPaste} className={cn(appBtn.secondarySm, "gap-1.5")}>
                      <FileText className="size-3.5" /> Paste text
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div role="rowgroup">
                {entries.map((entry) => {
                  const key = entryKey(entry);
                  const checked = selected.has(key);
                  return (
                    <div
                      key={key}
                      role="row"
                      aria-selected={checked}
                      data-selected={checked || undefined}
                      data-selecting={selected.size > 0 || undefined}
                      draggable
                      onDragStart={(event) => {
                        const refs = checked && selectedRefs.length ? selectedRefs : [{ id: entry.id, kind: entry.kind }];
                        event.dataTransfer.setData("application/x-clauxen-library", JSON.stringify(refs));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={entry.kind === "folder" ? (event) => { if (event.dataTransfer.types.includes("application/x-clauxen-library")) event.preventDefault(); } : undefined}
                      onDrop={entry.kind === "folder" ? (event) => {
                        const payload = event.dataTransfer.getData("application/x-clauxen-library");
                        if (!payload) return;
                        event.preventDefault();
                        event.stopPropagation();
                        void move(JSON.parse(payload) as LibraryEntryRef[], entry.id);
                      } : undefined}
                      onDoubleClick={() => openEntry(entry)}
                      className={cn(ROW_GRID, "cx-table__row group/row")}
                    >
                      <span className="flex justify-center" role="cell">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(key)}
                          aria-label={`Select ${entry.name}`}
                          className="cx-check cx-table__check"
                        />
                      </span>
                      <button
                        type="button"
                        role="cell"
                        onClick={() => openEntry(entry)}
                        className="no-hover-overlay flex min-w-0 items-center gap-2.5 text-left outline-none"
                      >
                        <EntryIcon entry={entry} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium leading-[18px] text-[var(--ui-fg)]">{entry.name}</span>
                          <span className="block truncate text-[11.5px] leading-4 text-[var(--ui-fg-subtle)] sm:hidden">
                            {typeLabel(entry)} · {formatDate(entry.updatedAt)}{entry.kind === "file" ? ` · ${formatSize(entry.size)}` : ""}
                          </span>
                        </span>
                      </button>
                      <span role="cell" className="truncate text-[12.5px] text-[var(--ui-fg-muted)] max-sm:hidden">{typeLabel(entry)}</span>
                      <span role="cell" className="truncate text-[12.5px] tabular-nums text-[var(--ui-fg-muted)] max-sm:hidden">{formatDate(entry.updatedAt)}</span>
                      <span role="cell" className="text-right text-[12.5px] tabular-nums text-[var(--ui-fg-muted)] max-sm:hidden">{entry.kind === "file" ? formatSize(entry.size) : "—"}</span>
                      <span role="cell" className="flex justify-end">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${entry.name}`}
                              className="cx-table__action ui-icon-button no-hover-overlay"
                            >
                              <MoreHorizontal className="size-4" strokeWidth={1.75} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={4} collisionPadding={12} className="w-[184px]">
                            <DropdownMenuItem onSelect={() => openEntry(entry)} className="ui-menu-row">
                              {entry.kind === "folder" ? <Folder /> : <Download />} {entry.kind === "folder" ? "Open" : "Download"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setRenameTarget(entry); setRenameValue(entry.name); }} className="ui-menu-row">
                              <Pencil /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setSelected(new Set([key])); setMoveOpen(true); }} className="ui-menu-row">
                              <FolderInput /> Move to…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setDeleteTargets([{ id: entry.id, kind: entry.kind }])} className="ui-menu-row text-destructive focus:text-destructive">
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {selected.size > 0 ? (
        <div className="cx-selection-bar" role="toolbar" aria-label="Selection actions">
          <span className="px-1.5 text-[12.5px] font-medium tabular-nums">{selected.size} selected</span>
          <span className="h-4 w-px bg-[var(--ui-border)]" aria-hidden />
          <button type="button" onClick={() => setMoveOpen(true)} className={cn(appBtn.ghost, "h-7 gap-1.5 px-2")}>
            <FolderInput className="size-3.5" /> Move
          </button>
          <button type="button" onClick={() => setDeleteTargets(selectedRefs)} className={cn(appBtn.ghost, "h-7 gap-1.5 px-2 !text-destructive")}>
            <Trash2 className="size-3.5" /> Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="ui-icon-button no-hover-overlay !size-7">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {draggingOver ? (
        <div className="pointer-events-none absolute inset-3 z-50 grid place-items-center rounded-[14px] border border-dashed border-[var(--ui-border)] bg-[color-mix(in_oklab,var(--app-panel-bg)_92%,transparent)] text-center">
          <div>
            <Upload className="mx-auto size-6 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
            <p className="mt-2 text-[14px] font-medium">Drop to upload</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--ui-fg-muted)]">Files are saved to this folder.</p>
          </div>
        </div>
      ) : null}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create text file</DialogTitle>
            <DialogDescription>Paste or type text and save it to your Library.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div>
              <label htmlFor="library-paste-name" className="cx-label">File name</label>
              <div className="flex items-stretch gap-1.5">
                <input
                  id="library-paste-name"
                  autoFocus
                  value={pasteName}
                  onChange={(event) => setPasteName(event.target.value)}
                  placeholder="Untitled"
                  className="cx-field min-w-0 flex-1"
                />
                <div className="cx-segmented shrink-0" role="radiogroup" aria-label="File type">
                  {TEXT_EXTENSIONS.map((ext) => (
                    <button
                      key={ext}
                      type="button"
                      role="radio"
                      aria-checked={pasteExt === ext}
                      data-active={pasteExt === ext || undefined}
                      onClick={() => setPasteExt(ext)}
                      className="cx-segmented__item no-hover-overlay font-mono"
                    >
                      {ext}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="library-paste-content" className="cx-label">Content</label>
                <span className="mb-1 text-[11px] tabular-nums text-[var(--ui-fg-subtle)]">
                  {pasteContent.length.toLocaleString()} characters
                </span>
              </div>
              <textarea
                id="library-paste-content"
                value={pasteContent}
                onChange={(event) => setPasteContent(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void createPastedFile();
                }}
                placeholder="Paste or type text here…"
                rows={10}
                className="cx-field max-h-[48vh] min-h-[160px] font-mono text-[12.5px] leading-5"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <span className="mr-auto hidden text-[11px] text-[var(--ui-fg-subtle)] sm:block">⌘ Enter to save</span>
            <button type="button" onClick={() => setPasteOpen(false)} className={appBtn.secondary}>Cancel</button>
            <button type="button" disabled={busy || !pasteName.trim() || !pasteContent.trim()} onClick={() => void createPastedFile()} className={appBtn.primary}>
              Create file
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Create a folder in {listing?.breadcrumbs.at(-1)?.name ?? "Library"}.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && folderName.trim()) void createFolder(); }}
            placeholder="Folder name"
            aria-label="Folder name"
            className="cx-field"
          />
          <DialogFooter>
            <button type="button" onClick={() => setFolderOpen(false)} className={appBtn.secondary}>Cancel</button>
            <button type="button" disabled={busy || !folderName.trim()} onClick={() => void createFolder()} className={appBtn.primary}>Create</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget != null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.kind === "folder" ? "folder" : "file"}</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onFocus={(event) => {
              const dot = event.currentTarget.value.lastIndexOf(".");
              if (renameTarget?.kind === "file" && dot > 0) event.currentTarget.setSelectionRange(0, dot);
              else event.currentTarget.select();
            }}
            onKeyDown={(event) => { if (event.key === "Enter") void confirmRename(); }}
            aria-label="New name"
            className="cx-field"
          />
          <DialogFooter>
            <button type="button" onClick={() => setRenameTarget(null)} className={appBtn.secondary}>Cancel</button>
            <button type="button" disabled={busy || !renameValue.trim()} onClick={() => void confirmRename()} className={appBtn.primary}>Rename</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move {selectedRefs.length || 1} {(selectedRefs.length || 1) === 1 ? "item" : "items"}</DialogTitle>
            <DialogDescription>Choose a destination folder.</DialogDescription>
          </DialogHeader>
          <div className="-mx-1 max-h-72 space-y-px overflow-y-auto">
            <button type="button" onClick={() => void move(selectedRefs, null)} className="cx-list-row no-hover-overlay">
              <Folder className="size-4 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
              <span className="truncate font-medium">Library</span>
            </button>
            {listing?.allFolders.filter((folder) => !selected.has(`folder:${folder.id}`)).map((folder) => (
              <button key={folder.id} type="button" onClick={() => void move(selectedRefs, folder.id)} className="cx-list-row no-hover-overlay">
                <Folder className="size-4 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setMoveOpen(false)} className={appBtn.secondary}>Cancel</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTargets != null} onOpenChange={(open) => { if (!open) setDeleteTargets(null); }}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete {deleteTargets?.length === 1 ? "item" : `${deleteTargets?.length ?? 0} items`}?</DialogTitle>
            <DialogDescription>
              Deleted files are removed from your Library and from chats they were attached to. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setDeleteTargets(null)} className={appBtn.secondary}>Cancel</button>
            <button type="button" disabled={busy} onClick={() => void confirmDelete()} className={cn(appBtn.primary, "!bg-destructive hover:!bg-destructive/90 !text-white")}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
