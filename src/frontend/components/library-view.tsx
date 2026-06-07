"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Plus,
  FileText,
  Image as FileImage,
  MoreHorizontal,
  Trash2,
  Download,
  Edit2,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { useToast } from "@/frontend/hooks/use-toast";

interface LibraryItem {
  id: string;
  name: string;
  type: "file" | "image";
  modified: string; // display label e.g. "Today"
  modifiedTs: number; // for sorting
  size: string; // display e.g. "109 KB"
  sizeBytes: number;
}

const initialItems: LibraryItem[] = [
  {
    id: "i1",
    name: "Pasted markdown(3).md",
    type: "file",
    modified: "Today",
    modifiedTs: Date.now() - 1000 * 60 * 30,
    size: "109 KB",
    sizeBytes: 111616,
  },
  {
    id: "i2",
    name: "Pasted text(37).txt",
    type: "file",
    modified: "Yesterday",
    modifiedTs: Date.now() - 1000 * 60 * 60 * 26,
    size: "12.5 KB",
    sizeBytes: 12800,
  },
  {
    id: "i3",
    name: "vacation-photo.jpg",
    type: "image",
    modified: "May 25",
    modifiedTs: Date.now() - 1000 * 60 * 60 * 24 * 3,
    size: "2.4 MB",
    sizeBytes: 2516582,
  },
  {
    id: "i4",
    name: "research-notes.pdf",
    type: "file",
    modified: "May 20",
    modifiedTs: Date.now() - 1000 * 60 * 60 * 24 * 8,
    size: "450 KB",
    sizeBytes: 460800,
  },
  {
    id: "i5",
    name: "diagram.png",
    type: "image",
    modified: "May 18",
    modifiedTs: Date.now() - 1000 * 60 * 60 * 24 * 10,
    size: "890 KB",
    sizeBytes: 911360,
  },
  {
    id: "i6",
    name: "meeting-transcript.txt",
    type: "file",
    modified: "May 12",
    modifiedTs: Date.now() - 1000 * 60 * 60 * 24 * 16,
    size: "28 KB",
    sizeBytes: 28672,
  },
  {
    id: "i7",
    name: "brand-assets.zip",
    type: "file",
    modified: "Apr 30",
    modifiedTs: Date.now() - 1000 * 60 * 60 * 24 * 28,
    size: "4.1 MB",
    sizeBytes: 4299162,
  },
];

type Tab = "all" | "images" | "files";
type SortKey = "name" | "modified" | "size";

export function LibraryView() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredSorted = useMemo(() => {
    let result = [...items];

    // Tab filter
    if (activeTab === "images") {
      result = result.filter((i) => i.type === "image");
    } else if (activeTab === "files") {
      result = result.filter((i) => i.type === "file");
    }

    // Search
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "modified") {
        cmp = a.modifiedTs - b.modifiedTs;
      } else if (sortKey === "size") {
        cmp = a.sizeBytes - b.sizeBytes;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [items, query, activeTab, sortKey, sortDir]);

  const allVisibleSelected =
    filteredSorted.length > 0 &&
    filteredSorted.every((i) => selected.has(i.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selected);
      filteredSorted.forEach((i) => next.delete(i.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filteredSorted.forEach((i) => next.add(i.id));
      setSelected(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "modified" ? "desc" : "asc");
    }
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    toast({ title: "Deleted", description: "Item removed from library." });
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    const count = selected.size;
    setSelected(new Set());
    toast({
      title: `${count} item${count > 1 ? "s" : ""} deleted`,
      description: "Removed from your library.",
    });
  };

  const handleNewAction = (action: string) => {
    if (action === "paste") {
      const name = window.prompt("Name for text note", "untitled-note.txt");
      if (!name?.trim()) return;
      const newItem: LibraryItem = {
        id: `local-${Date.now()}`,
        name: name.trim(),
        type: "file",
        modified: "Today",
        modifiedTs: Date.now(),
        size: "0 KB",
        sizeBytes: 0,
      };
      setItems((p) => [newItem, ...p]);
      toast({ title: "Added", description: "Text note created in library." });
    } else if (action === "upload") {
      const name = window.prompt(
        "Simulate upload — enter filename",
        "uploaded-file.pdf"
      );
      if (!name?.trim()) return;
      const isImg = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name);
      const newItem: LibraryItem = {
        id: `local-${Date.now()}`,
        name: name.trim(),
        type: isImg ? "image" : "file",
        modified: "Today",
        modifiedTs: Date.now(),
        size: "256 KB",
        sizeBytes: 262144,
      };
      setItems((p) => [newItem, ...p]);
      toast({ title: "Uploaded", description: "File added to library (demo)." });
    } else if (action === "folder") {
      const name = window.prompt("Folder name", "New folder");
      if (!name?.trim()) return;
      const newItem: LibraryItem = {
        id: `local-${Date.now()}`,
        name: name.trim(),
        type: "file",
        modified: "Today",
        modifiedTs: Date.now(),
        size: "—",
        sizeBytes: 0,
      };
      setItems((p) => [newItem, ...p]);
      toast({ title: "Folder created", description: "Empty folder added." });
    }
  };

  const openItem = (item: LibraryItem) => {
    toast({
      title: "Opened",
      description: `Previewing “${item.name}” (demo — content not stored).`,
    });
  };

  const renameItem = (item: LibraryItem) => {
    const newName = window.prompt("Rename item", item.name);
    if (!newName || newName === item.name) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, name: newName.trim() } : i))
    );
  };

  const downloadItem = (item: LibraryItem) => {
    toast({
      title: "Download started",
      description: `Simulating download of ${item.name}`,
    });
  };

  return (
    <div className="flex flex-col flex-1 w-full bg-white font-sans h-full overflow-hidden animate-in fade-in duration-300">
      {/* Top header: title + search + New */}
      <div className="w-full border-b border-zinc-100">
        <div className="max-w-[800px] mx-auto w-full px-4 sm:px-6 pt-8 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-3">
            <h1 className="text-[26px] sm:text-[28px] leading-[34px] font-serif font-medium text-zinc-800 tracking-[-0.2px] flex-1">
              Library
            </h1>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search library"
                  aria-label="Search library"
                  autoComplete="off"
                  className="w-full h-9 rounded-full bg-white border border-zinc-200 text-[14px] pl-9 pr-3.5 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors"
                />
              </div>

              {/* New button with menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="h-9 px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 no-hover-overlay text-white text-[14px] font-medium flex items-center gap-1.5 shadow-sm active:scale-[0.985] transition"
                    aria-haspopup="menu"
                  >
                    <span>New</span>
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-xl border border-black/10 bg-white p-1 shadow-xl"
                >
                  <DropdownMenuItem
                    onClick={() => handleNewAction("upload")}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer"
                  >
                    <Download className="h-4 w-4" /> Upload files
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleNewAction("paste")}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer"
                  >
                    <FileText className="h-4 w-4" /> Paste text
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-black/5" />
                  <DropdownMenuItem
                    onClick={() => handleNewAction("folder")}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4" /> New folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-zinc-100">
        <div className="max-w-[800px] mx-auto w-full px-4 sm:px-6">
          <div className="flex items-center justify-between min-h-[52px] py-1.5 gap-3 flex-wrap">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "all" as const, label: "All" },
                  { key: "images" as const, label: "Images" },
                  { key: "files" as const, label: "Files" },
                ] as const
              ).map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setActiveTab(t.key);
                      clearSelection();
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "h-8 px-4 rounded-full text-[13.5px] font-medium transition-all active:scale-[0.985]",
                      isActive
                        ? "bg-zinc-100 text-zinc-900 shadow-sm border border-zinc-200"
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Selection summary / bulk actions */}
              {selected.size > 0 && (
                <div className="flex items-center gap-2 text-[12.5px] text-zinc-500 pr-1">
                  <span>
                    {selected.size} selected
                  </span>
                  <button
                    onClick={deleteSelected}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-red-600 hover:bg-red-50 active:bg-red-100 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  <button
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-zinc-100 active:bg-zinc-200 transition"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Filters button (visual + placeholder) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Open filters"
                    className="h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M6 12h12M9 18h6" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem disabled className="text-[12.5px] opacity-60">
                    Date range (soon)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="text-[12.5px] opacity-60">
                    Size filter (soon)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* List area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-[800px] mx-auto w-full px-4 sm:px-6 pb-20 pt-1">
          {/* Column headers */}
          <div
            className="grid items-center text-[12.5px] text-zinc-500 select-none border-b border-zinc-100"
            style={{
              gridTemplateColumns: "28px minmax(0, 1fr) 148px 78px 52px",
            }}
          >
            {/* Select all */}
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                aria-label="Select all visible"
                className="h-3.5 w-3.5 accent-zinc-900 cursor-pointer rounded border-zinc-300"
              />
            </div>

            <button
              onClick={() => handleSort("name")}
              className="flex items-center gap-1 text-left font-medium hover:text-zinc-800 transition py-2.5"
            >
              Name
              {sortKey === "name" && (
                <span className="text-[10px] opacity-70">
                  {sortDir === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>

            <button
              onClick={() => handleSort("modified")}
              className="flex items-center gap-1 font-medium hover:text-zinc-800 transition py-2.5"
            >
              Modified
              {sortKey === "modified" && (
                <span className="text-[10px] opacity-70">
                  {sortDir === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>

            <button
              onClick={() => handleSort("size")}
              className="flex items-center gap-1 font-medium hover:text-zinc-800 transition py-2.5 text-right justify-end pr-1"
            >
              Size
              {sortKey === "size" && (
                <span className="text-[10px] opacity-70">
                  {sortDir === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>

            <div />
          </div>

          {/* Rows */}
          {filteredSorted.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-[14px]">
              No items match your search or filters.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filteredSorted.map((item) => {
                const isSelected = selected.has(item.id);
                const Icon = item.type === "image" ? FileImage : FileText;

                return (
                  <div
                    key={item.id}
                    role="row"
                    tabIndex={0}
                    onClick={() => openItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openItem(item);
                      if (e.key === " ") {
                        e.preventDefault();
                        toggleSelect(item.id);
                      }
                    }}
                    className={cn(
                      "group grid items-center gap-2 py-[13px] text-[14px] text-zinc-700 cursor-pointer hover:bg-zinc-50 rounded-md -mx-1 px-1 transition-colors",
                      isSelected && "bg-zinc-100"
                    )}
                    style={{
                      gridTemplateColumns: "28px minmax(0, 1fr) 148px 78px 52px",
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className="flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select ${item.name}`}
                        className="h-3.5 w-3.5 accent-zinc-900 cursor-pointer rounded border-zinc-300 opacity-70 group-hover:opacity-100 transition"
                      />
                    </div>

                    {/* Name + icon */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="truncate font-[450] tracking-[-0.1px]">
                        {item.name}
                      </span>
                    </div>

                    {/* Modified */}
                    <div className="text-zinc-500 text-[13.5px] tabular-nums">
                      {item.modified}
                    </div>

                    {/* Size */}
                    <div className="text-zinc-500 text-[13.5px] text-right pr-2 tabular-nums">
                      {item.size}
                    </div>

                    {/* Actions */}
                    <div
                      className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label={`Actions for ${item.name}`}
                            className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 active:bg-zinc-200"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                          <DropdownMenuItem
                            onClick={() => openItem(item)}
                            className="flex items-center gap-2 text-[13px]"
                          >
                            <FolderOpen className="h-4 w-4" /> Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => renameItem(item)}
                            className="flex items-center gap-2 text-[13px]"
                          >
                            <Edit2 className="h-4 w-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => downloadItem(item)}
                            className="flex items-center gap-2 text-[13px]"
                          >
                            <Download className="h-4 w-4" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 bg-black/5" />
                          <DropdownMenuItem
                            onClick={() => deleteItem(item.id)}
                            className="flex items-center gap-2 text-[13px] text-[#c94c4c] focus:text-[#c94c4c]"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div className="mt-8 text-[11.5px] text-zinc-400/70 text-center">
            Files you upload or paste in chats appear here. (Demo data)
          </div>
        </div>
      </div>
    </div>
  );
}
