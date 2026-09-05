"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileImage,
  FileText,
  Folder,
  FolderInput,
  Grid2X2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { ProjectsMobileHeader } from "@/components/projects/projects-mobile-header";
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
import { chrome, appPage } from "@/lib/app-chrome";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import { AppContentLoader } from "@/components/app-content-loader";

type LibraryEntry =
  | { kind: "folder"; id: string; name: string; updatedAt: string; folder: LibraryFolder }
  | { kind: "file"; id: string; name: string; updatedAt: string; size: number; mime: string; file: LibraryFile };

type Filter = "all" | "images" | "files";
type SortKey = "name" | "modified" | "size";

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
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function iconFor(entry: LibraryEntry) {
  if (entry.kind === "folder") return Folder;
  if (entry.mime.startsWith("image/")) return FileImage;
  if (entry.mime.startsWith("text/") || /\.(md|txt|json|csv)$/i.test(entry.name)) return FileText;
  return FileIcon;
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
  const [folderOpen, setFolderOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pasteName, setPasteName] = useState("untitled.txt");
  const [pasteContent, setPasteContent] = useState("");
  const [folderName, setFolderName] = useState("");

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
        if (filter === "images") return entry.kind === "file" && entry.mime.startsWith("image/");
        if (filter === "files") return entry.kind === "file" && !entry.mime.startsWith("image/");
        return true;
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        let result = 0;
        if (sortKey === "name") result = a.name.localeCompare(b.name);
        if (sortKey === "modified") result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        if (sortKey === "size") result = (a.kind === "file" ? a.size : 0) - (b.kind === "file" ? b.size : 0);
        return sortDirection === "asc" ? result : -result;
      });
  }, [filter, listing, query, sortDirection, sortKey]);

  const selectedRefs = useMemo<LibraryEntryRef[]>(() => entries
    .filter((entry) => selected.has(entryKey(entry)))
    .map(({ id, kind }) => ({ id, kind })), [entries, selected]);

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

  const createPastedFile = () => withBusy(async () => {
    const name = pasteName.trim();
    if (!name || !pasteContent.trim()) throw new Error("Enter a file name and some text.");
    const type = name.toLowerCase().endsWith(".md") ? "text/markdown" : name.toLowerCase().endsWith(".json") ? "application/json" : "text/plain";
    await uploadUserFile(new File([pasteContent], name, { type }), { folderId: listing?.folderId });
    setPasteOpen(false);
    setPasteContent("");
    setPasteName("untitled.txt");
    await load(listing?.folderId);
  });

  const createFolder = () => withBusy(async () => {
    await createLibraryFolder({ name: folderName, parentId: listing?.folderId });
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

  const remove = (items: LibraryEntryRef[]) => withBusy(async () => {
    if (!items.length) return;
    await deleteLibraryEntries(items);
    await load(listing?.folderId);
  });

  const openEntry = (entry: LibraryEntry) => {
    if (entry.kind === "folder") {
      void load(entry.id);
      return;
    }
    window.location.assign(`/api/v1/files/${encodeURIComponent(entry.id)}/content`);
  };

  const rename = (entry: LibraryEntry) => {
    const name = window.prompt("Rename", entry.name)?.trim();
    if (!name || name === entry.name) return;
    void withBusy(async () => {
      await renameLibraryEntry({ id: entry.id, kind: entry.kind, name });
      await load(listing?.folderId);
    });
  };

  const toggleSort = (next: SortKey) => {
    if (sortKey === next) setSortDirection((value) => value === "asc" ? "desc" : "asc");
    else {
      setSortKey(next);
      setSortDirection(next === "modified" ? "desc" : "asc");
    }
  };

  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={busy} className={appPage.primaryCta}>
          <Plus className="icon-md" /> New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-1">
        <DropdownMenuItem onClick={() => uploadInputRef.current?.click()} className="ui-menu-row gap-2">
          <Upload className="icon-md" /> Upload files
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPasteOpen(true)} className="ui-menu-row gap-2">
          <FileText className="icon-md" /> Paste text
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setFolderOpen(true)} className="ui-menu-row gap-2">
          <Folder className="icon-md" /> New folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className="app-page-surface relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sans"
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

      {isMobile ? <ProjectsMobileHeader title="Library" onOpenMobileNav={openMobileNav} isNavOpen={!isSidebarCollapsed} trailing={newMenu} /> : null}

      <header>
        <div className="mobile-page-inset mx-auto flex w-full max-w-[var(--ui-page-max-width-wide,1120px)] flex-wrap items-center gap-3 px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <h1 className={cn(appPage.title, "hidden sm:block")}>Library</h1>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
            <div className="flex h-7 shrink-0 items-center gap-0.5 rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,#18181b_6%,transparent)] p-0.5 dark:bg-white/10">
              {(["all", "images", "files"] as Filter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setFilter(value); setSelected(new Set()); }}
                  className={cn(
                    "no-hover-overlay h-6 rounded-[5px] px-2.5 text-[12px] font-medium capitalize leading-[18px] transition",
                    filter === value
                      ? "bg-[var(--settings-card-bg)] text-[var(--settings-fg)] shadow-[var(--settings-card-shadow)] dark:bg-zinc-800 dark:text-white"
                      : "text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="relative flex w-full max-w-[280px] items-center sm:w-[240px]">
              <Search className={appPage.searchIcon} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this folder" aria-label="Search this folder" className={appPage.searchInput} />
            </label>
            {!isMobile ? newMenu : null}
          </div>
        </div>
      </header>

      <div>
        <div className="mobile-page-inset mx-auto flex min-h-10 w-full max-w-[1120px] flex-wrap items-center gap-3 px-4 sm:px-8">
          <nav className="flex items-center gap-1 text-[13px] leading-[18px] text-[var(--settings-fg-muted)]">
            <button type="button" onClick={() => void load(null)} className="no-hover-overlay rounded-[var(--radius-sm)] px-2 py-1 font-medium hover:bg-[var(--ui-hover-wash)] hover:text-[var(--settings-fg)]">Library</button>
            {listing?.breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="icon-sm text-[var(--settings-fg-muted)] opacity-50" />
                <button type="button" onClick={() => void load(crumb.id)} className="no-hover-overlay max-w-36 truncate rounded-[var(--radius-sm)] px-2 py-1 hover:bg-[var(--ui-hover-wash)] hover:text-[var(--settings-fg)]">{crumb.name}</button>
              </React.Fragment>
            ))}
          </nav>
        </div>
      </div>

      <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto" data-scroll-region="">
        <div className="mobile-page-inset mx-auto w-full max-w-[1120px] px-4 pb-24 pt-3 sm:px-8">
          {selected.size > 0 ? (
            <div className="mb-3 flex min-h-9 items-center gap-2 rounded-[var(--settings-card-radius)] bg-[var(--settings-card-bg)] px-3 shadow-[var(--settings-card-shadow)]">
              <span className="text-[13px] font-medium leading-[18px]">{selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)} className={cn(appBtn.ghost, "ml-auto h-7 gap-1.5 px-2")}><FolderInput className="icon-md" /> Move</Button>
              <Button variant="ghost" size="sm" onClick={() => void remove(selectedRefs)} className={cn(appBtn.ghost, "h-7 gap-1.5 px-2 text-red-600 hover:text-red-700")}><Trash2 className="icon-md" /> Delete</Button>
              <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="ui-icon-button no-hover-overlay"><X className="icon-md" /></button>
            </div>
          ) : null}

          <div className="grid grid-cols-[32px_minmax(0,1fr)_150px_90px_44px] items-center border-b border-[var(--settings-hairline)] pb-2 text-[12px] font-medium leading-[18px] text-[var(--settings-fg-muted)] max-sm:grid-cols-[28px_minmax(0,1fr)_44px]">
            <input type="checkbox" aria-label="Select all" checked={entries.length > 0 && entries.every((entry) => selected.has(entryKey(entry)))} onChange={() => {
              if (entries.every((entry) => selected.has(entryKey(entry)))) setSelected(new Set());
              else setSelected(new Set(entries.map(entryKey)));
            }} className="h-3.5 w-3.5 rounded accent-[var(--settings-fg)]" />
            <button type="button" onClick={() => toggleSort("name")} className="no-hover-overlay text-left">Name</button>
            <button type="button" onClick={() => toggleSort("modified")} className="no-hover-overlay text-left max-sm:hidden">Modified</button>
            <button type="button" onClick={() => toggleSort("size")} className="no-hover-overlay text-right max-sm:hidden">Size</button>
            <span />
          </div>

          {loading ? (
            <AppContentLoader label="Loading library" className="py-24" />
          ) : entries.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
              <div className={appPage.emptyIconWell}><Folder className="icon-lg" /></div>
              <h2 className="app-page-section-title mt-1">{query ? "Nothing found" : "This folder is empty"}</h2>
              {!query ? <Button onClick={() => uploadInputRef.current?.click()} variant="outline" className={cn(appPage.outlineCta, "mt-5")}><Upload className="icon-md" /> Upload files</Button> : null}
            </div>
          ) : (
            <div>
              {entries.map((entry) => {
                const Icon = iconFor(entry);
                const key = entryKey(entry);
                const checked = selected.has(key);
                return (
                  <div
                    key={key}
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
                    className={cn(
                      "group grid min-h-[44px] grid-cols-[32px_minmax(0,1fr)_150px_90px_44px] items-center rounded-[var(--radius-sm)] px-0 transition-colors hover:bg-[var(--ui-hover-wash)] max-sm:grid-cols-[28px_minmax(0,1fr)_44px]",
                      checked && "bg-[color-mix(in_oklab,#18181b_6%,transparent)]",
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    })} aria-label={`Select ${entry.name}`} className="h-3.5 w-3.5 rounded accent-[var(--settings-fg)]" />
                    <button
                      type="button"
                      onClick={() => openEntry(entry)}
                      className="no-hover-overlay flex min-w-0 items-center gap-2.5 text-left"
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)]",
                          entry.kind === "folder"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-400/10"
                            : "bg-[color-mix(in_oklab,#18181b_6%,transparent)] text-[var(--settings-fg-muted)]",
                        )}
                      >
                        <Icon className="icon-md" />
                      </span>
                      <span className="app-page-body truncate font-medium">{entry.name}</span>
                    </button>
                    <span className="app-page-muted max-sm:hidden">{formatDate(entry.updatedAt)}</span>
                    <span className="app-page-muted text-right tabular-nums max-sm:hidden">{entry.kind === "file" ? formatSize(entry.size) : "—"}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${entry.name}`}
                          className="ui-icon-button no-hover-overlay text-[var(--settings-fg-muted)] opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="icon-md" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 p-1">
                        <DropdownMenuItem onClick={() => openEntry(entry)} className="ui-menu-row gap-2"><Grid2X2 className="icon-md" /> Open</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => rename(entry)} className="ui-menu-row gap-2"><Pencil className="icon-md" /> Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelected(new Set([key])); setMoveOpen(true); }} className="ui-menu-row gap-2"><FolderInput className="icon-md" /> Move to…</DropdownMenuItem>
                        {entry.kind === "file" ? <DropdownMenuItem onClick={() => openEntry(entry)} className="ui-menu-row gap-2"><Download className="icon-md" /> Download</DropdownMenuItem> : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void remove([{ id: entry.id, kind: entry.kind }])} className="ui-menu-row gap-2 text-red-600 focus:text-red-600"><Trash2 className="icon-md" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {draggingOver ? <div className="pointer-events-none absolute inset-4 z-50 grid place-items-center rounded-[var(--settings-card-radius)] border border-dashed border-[var(--settings-input-border)] bg-[color-mix(in_oklab,var(--settings-canvas-bg)_92%,transparent)] text-center"><div><Upload className="icon-2xl mx-auto text-[var(--settings-fg-muted)]" /><p className="app-page-section-title mt-3">Drop files to upload</p><p className="app-page-muted mt-1">They’ll be saved in this folder.</p></div></div> : null}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className={cn(chrome.overlay.panel, "gap-0 overflow-hidden p-0 sm:max-w-[560px]")}>
          <DialogHeader className="border-b border-[var(--settings-hairline)] px-5 py-3.5 text-left"><DialogTitle className="text-[15px] font-medium">Create text file</DialogTitle><DialogDescription className="settings-muted">Paste text and choose the filename and extension to store in your Library.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-[var(--settings-fg-muted)]">File name</span><input value={pasteName} onChange={(event) => setPasteName(event.target.value)} placeholder="notes.txt" className="app-page-search !pl-3 outline-none" /></label>
            <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-[var(--settings-fg-muted)]">Content</span><textarea value={pasteContent} onChange={(event) => setPasteContent(event.target.value)} placeholder="Paste or type text here…" rows={10} className="app-field w-full resize-y p-3 font-mono text-[13px] leading-5 outline-none" /></label>
          </div>
          <DialogFooter className="border-t border-[var(--settings-hairline)] bg-[var(--settings-canvas-bg)] px-5 py-3"><Button variant="ghost" onClick={() => setPasteOpen(false)} className={appBtn.ghost}>Cancel</Button><Button disabled={busy || !pasteName.trim() || !pasteContent.trim()} onClick={() => void createPastedFile()} className={appBtn.primary}>Create file</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className={cn(chrome.overlay.panel, "sm:max-w-[420px]")}><DialogHeader><DialogTitle>New folder</DialogTitle><DialogDescription>Create a folder inside the current location.</DialogDescription></DialogHeader><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFolder(); }} placeholder="Folder name" className="app-page-search !pl-3 outline-none" /><DialogFooter><Button variant="ghost" onClick={() => setFolderOpen(false)} className={appBtn.ghost}>Cancel</Button><Button disabled={busy || !folderName.trim()} onClick={() => void createFolder()} className={appBtn.primary}>Create folder</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className={cn(chrome.overlay.panel, "sm:max-w-[460px]")}><DialogHeader><DialogTitle>Move {selected.size || 1} item{(selected.size || 1) === 1 ? "" : "s"}</DialogTitle><DialogDescription>Choose a destination folder.</DialogDescription></DialogHeader><div className="max-h-72 space-y-0.5 overflow-y-auto"><button onClick={() => void move(selectedRefs, null)} className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left hover:bg-[var(--ui-hover-wash)]"><Folder className="icon-md text-amber-500" /><span className="app-page-body font-medium">Library root</span></button>{listing?.allFolders.filter((folder) => !selected.has(`folder:${folder.id}`)).map((folder) => <button key={folder.id} onClick={() => void move(selectedRefs, folder.id)} className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left hover:bg-[var(--ui-hover-wash)]"><Folder className="icon-md text-amber-500" /><span className="app-page-body truncate">{folder.name}</span></button>)}</div><DialogFooter><Button variant="ghost" onClick={() => setMoveOpen(false)} className={appBtn.ghost}>Cancel</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
