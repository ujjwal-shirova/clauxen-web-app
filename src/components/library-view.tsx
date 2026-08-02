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
import { cn } from "@/lib/utils";

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
      <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
        <DropdownMenuItem onClick={() => uploadInputRef.current?.click()} className="gap-2 rounded-lg py-2">
          <Upload className="icon-md" /> Upload files
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPasteOpen(true)} className="gap-2 rounded-lg py-2">
          <FileText className="icon-md" /> Paste text
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setFolderOpen(true)} className="gap-2 rounded-lg py-2">
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
            <p className={cn(appPage.subtitle, "hidden sm:block")}>Your uploads, generated files, images, and saved text.</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-zinc-100 p-1 dark:bg-white/10">
              {(["all", "images", "files"] as Filter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setFilter(value); setSelected(new Set()); }}
                  className={cn(
                    "no-hover-overlay rounded-md px-3 py-1 text-[12.5px] font-medium capitalize transition",
                    filter === value
                      ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
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
          <nav className="flex items-center gap-1 text-[13px] text-zinc-500">
            <button type="button" onClick={() => void load(null)} className="no-hover-overlay rounded-md px-2 py-1 font-medium hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white">Library</button>
            {listing?.breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="icon-sm text-zinc-300" />
                <button type="button" onClick={() => void load(crumb.id)} className="no-hover-overlay max-w-36 truncate rounded-md px-2 py-1 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white">{crumb.name}</button>
              </React.Fragment>
            ))}
          </nav>
        </div>
      </div>

      <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto" data-scroll-region="">
        <div className="mobile-page-inset mx-auto w-full max-w-[1120px] px-4 pb-24 pt-3 sm:px-8">
          {selected.size > 0 ? (
            <div className="mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 dark:border-white/10 dark:bg-white/5">
              <span className="text-[13px] font-medium">{selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)} className="ml-auto h-8 gap-1.5"><FolderInput className="icon-md" /> Move</Button>
              <Button variant="ghost" size="sm" onClick={() => void remove(selectedRefs)} className="h-8 gap-1.5 text-red-600 hover:text-red-700"><Trash2 className="icon-md" /> Delete</Button>
              <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="no-hover-overlay grid h-8 w-8 place-items-center rounded-md hover:bg-zinc-200 dark:hover:bg-white/10"><X className="icon-md" /></button>
            </div>
          ) : null}

          <div className="grid grid-cols-[32px_minmax(0,1fr)_150px_90px_44px] items-center pb-2 text-[12px] font-medium text-zinc-500 max-sm:grid-cols-[28px_minmax(0,1fr)_44px]">
            <input type="checkbox" aria-label="Select all" checked={entries.length > 0 && entries.every((entry) => selected.has(entryKey(entry)))} onChange={() => {
              if (entries.every((entry) => selected.has(entryKey(entry)))) setSelected(new Set());
              else setSelected(new Set(entries.map(entryKey)));
            }} className="h-4 w-4 rounded accent-zinc-950" />
            <button type="button" onClick={() => toggleSort("name")} className="no-hover-overlay text-left">Name</button>
            <button type="button" onClick={() => toggleSort("modified")} className="no-hover-overlay text-left max-sm:hidden">Modified</button>
            <button type="button" onClick={() => toggleSort("size")} className="no-hover-overlay text-right max-sm:hidden">Size</button>
            <span />
          </div>

          {loading ? (
            <div className="grid place-items-center py-24 text-[13px] text-zinc-400">Loading your library…</div>
          ) : entries.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-[var(--radius-md)] bg-zinc-100 text-zinc-500 dark:bg-white/10"><Folder className="icon-2xl" /></div>
              <h2 className="app-page-section-title mt-4">{query ? "Nothing found" : "This folder is empty"}</h2>
              <p className="mt-1 text-[13px] leading-5 text-zinc-500">Upload files, paste text, or create a folder. Files created by the assistant also appear here.</p>
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
                      "group grid min-h-[52px] grid-cols-[32px_minmax(0,1fr)_150px_90px_44px] items-center rounded-xl px-0 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5 max-sm:grid-cols-[28px_minmax(0,1fr)_44px]",
                      checked && "bg-zinc-100 dark:bg-white/10",
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    })} aria-label={`Select ${entry.name}`} className="h-4 w-4 rounded accent-zinc-950" />
                    <button
                      type="button"
                      onClick={() => openEntry(entry)}
                      className="no-hover-overlay flex min-w-0 items-center gap-3 text-left"
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                          entry.kind === "folder"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-400/10"
                            : "bg-zinc-100 text-zinc-500 dark:bg-white/10",
                        )}
                      >
                        <Icon className="icon-md" />
                      </span>
                      <span className="app-page-body truncate font-medium">{entry.name}</span>
                    </button>
                    <span className="text-[13px] text-zinc-500 max-sm:hidden">{formatDate(entry.updatedAt)}</span>
                    <span className="text-right text-[13px] tabular-nums text-zinc-500 max-sm:hidden">{entry.kind === "file" ? formatSize(entry.size) : "—"}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${entry.name}`}
                          className="no-hover-overlay grid h-8 w-8 place-items-center rounded-lg text-zinc-400 opacity-0 hover:bg-zinc-200 group-hover:opacity-100 data-[state=open]:opacity-100 dark:hover:bg-white/10"
                        >
                          <MoreHorizontal className="icon-md" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
                        <DropdownMenuItem onClick={() => openEntry(entry)} className="gap-2 rounded-lg"><Grid2X2 className="icon-md" /> Open</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => rename(entry)} className="gap-2 rounded-lg"><Pencil className="icon-md" /> Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelected(new Set([key])); setMoveOpen(true); }} className="gap-2 rounded-lg"><FolderInput className="icon-md" /> Move to…</DropdownMenuItem>
                        {entry.kind === "file" ? <DropdownMenuItem onClick={() => openEntry(entry)} className="gap-2 rounded-lg"><Download className="icon-md" /> Download</DropdownMenuItem> : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void remove([{ id: entry.id, kind: entry.kind }])} className="gap-2 rounded-lg text-red-600 focus:text-red-600"><Trash2 className="icon-md" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {draggingOver ? <div className="pointer-events-none absolute inset-4 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-zinc-400 bg-white/90 text-center backdrop-blur dark:bg-zinc-950/90"><div><Upload className="icon-2xl mx-auto" /><p className="mt-3 text-[15px] font-semibold">Drop files to upload</p><p className="mt-1 text-[13px] text-zinc-500">They’ll be saved in this folder.</p></div></div> : null}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className={cn(chrome.overlay.panel, "gap-0 overflow-hidden p-0 sm:max-w-[560px]")}>
          <DialogHeader className="border-b px-5 py-4 text-left"><DialogTitle className="text-[16px]">Create text file</DialogTitle><DialogDescription>Paste text and choose the filename and extension to store in your Library.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-5 py-5">
            <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-zinc-600">File name</span><input value={pasteName} onChange={(event) => setPasteName(event.target.value)} placeholder="notes.txt" className="app-page-search !pl-3 outline-none" /></label>
            <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-zinc-600">Content</span><textarea value={pasteContent} onChange={(event) => setPasteContent(event.target.value)} placeholder="Paste or type text here…" rows={10} className="w-full resize-y rounded-xl border border-zinc-200 p-3 font-mono text-[13px] leading-5 outline-none focus:border-zinc-400 dark:border-white/10 dark:bg-zinc-900" /></label>
          </div>
          <DialogFooter className="border-t bg-zinc-50 px-5 py-3 dark:bg-white/5"><Button variant="ghost" onClick={() => setPasteOpen(false)}>Cancel</Button><Button disabled={busy || !pasteName.trim() || !pasteContent.trim()} onClick={() => void createPastedFile()} className="bg-zinc-950 text-white hover:bg-zinc-800">Create file</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className={cn(chrome.overlay.panel, "sm:max-w-[420px]")}><DialogHeader><DialogTitle>New folder</DialogTitle><DialogDescription>Create a folder inside the current location.</DialogDescription></DialogHeader><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFolder(); }} placeholder="Folder name" className="app-page-search !h-9 !pl-3 outline-none" /><DialogFooter><Button variant="ghost" onClick={() => setFolderOpen(false)}>Cancel</Button><Button disabled={busy || !folderName.trim()} onClick={() => void createFolder()} className="bg-zinc-950 text-white hover:bg-zinc-800">Create folder</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className={cn(chrome.overlay.panel, "sm:max-w-[460px]")}><DialogHeader><DialogTitle>Move {selected.size || 1} item{(selected.size || 1) === 1 ? "" : "s"}</DialogTitle><DialogDescription>Choose a destination folder.</DialogDescription></DialogHeader><div className="max-h-72 space-y-1 overflow-y-auto"><button onClick={() => void move(selectedRefs, null)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-white/10"><Folder className="icon-md text-amber-500" /><span className="app-page-body font-medium">Library root</span></button>{listing?.allFolders.filter((folder) => !selected.has(`folder:${folder.id}`)).map((folder) => <button key={folder.id} onClick={() => void move(selectedRefs, folder.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-white/10"><Folder className="icon-md text-amber-500" /><span className="app-page-body truncate">{folder.name}</span></button>)}</div><DialogFooter><Button variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
