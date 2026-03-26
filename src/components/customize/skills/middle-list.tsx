'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { 
  Search, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Folder,
  BookOpen,
  X,
  Plus
} from 'lucide-react';
import { starterSkillsStructure, type FileItem } from '@/lib/starter-skills-data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateWithClaudeIcon, WriteSkillInstructionsIcon, UploadSkillIcon } from '@/components/icons';

// Lazy load dialogs for better performance
const InstructionsDialog = dynamic(() => import('./instructions-dialog').then(mod => mod.InstructionsDialog), { ssr: false });
const UploadSkillDialog = dynamic(() => import('./upload-dialog').then(mod => mod.UploadSkillDialog), { ssr: false });

// Memoized Tree Item for performance
const TreeItem = React.memo(({ 
  item, 
  path, 
  depth, 
  expandedFolders, 
  selectedSkill, 
  onToggle, 
  onSelect 
}: { 
  item: FileItem; 
  path: string; 
  depth: number; 
  expandedFolders: Set<string>; 
  selectedSkill: string | null; 
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) => {
  const isExpanded = expandedFolders.has(path);
  const isSelected = selectedSkill === path;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'folder') {
      onToggle(path);
    } else {
      onSelect(path);
    }
  };

  return (
    <div className="flex flex-col">
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 p-1 px-3 rounded-md hover:bg-black/5 text-left text-[13px] text-[#3D3D3A] transition-colors duration-75",
          isSelected && "bg-[#F0EEE6]",
          depth === 0 && "py-2 px-2"
        )}
      >
        {item.type === 'folder' ? (
          <>
            {depth === 0 ? (
              <div className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm border border-black/5 shrink-0">
                <BookOpen className="w-4 h-4 text-[#73726C]" />
              </div>
            ) : (
              <Folder className="w-3.5 h-3.5 text-[#73726C]" />
            )}
            <span className={cn("flex-1 truncate", depth === 0 && "font-semibold")}>{item.name}</span>
            <ChevronDown className={cn("w-3 h-3 text-[#73726C] transition-transform duration-200", !isExpanded && "-rotate-90")} />
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5 text-[#73726C]" />
            <span className="truncate">{item.name}</span>
          </>
        )}
      </button>
      {item.type === 'folder' && isExpanded && item.children && (
        <div className={cn("border-l border-black/5 flex flex-col gap-0.5 mt-0.5 ml-4")}>
          {item.children.map((child, idx) => (
            <TreeItem 
              key={`${path}/${child.name}`}
              item={child}
              path={`${path}/${child.name}`}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              selectedSkill={selectedSkill}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});

TreeItem.displayName = 'TreeItem';

export function SkillsMiddleList() {
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstructionsDialogOpen, setIsInstructionsDialogOpen] = useState(false);
  const [isUploadSkillDialogOpen, setIsUploadSkillDialogOpen] = useState(false);

  // Exclusive toggle logic for top-level folders
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        // Rule: Only one top-level folder expanded at a time
        if (!path.includes('/')) {
          prev.forEach(p => {
            if (!p.includes('/')) {
              newSet.delete(p);
            }
          });
        }
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handleSelectSkill = useCallback((path: string) => {
    setSelectedSkill(path);
  }, []);

  // Filter and sort root-level items only
  const filteredStarterSkills = useMemo(() => {
    // Pin skill-creator to top
    const baseList = [...starterSkillsStructure].sort((a, b) => {
      if (a.name === 'skill-creator') return -1;
      if (b.name === 'skill-creator') return 1;
      return a.name.localeCompare(b.name);
    });

    if (!searchQuery.trim()) return baseList;
    
    const lowerQuery = searchQuery.toLowerCase();
    // Search only filters root-level buttons
    return baseList.filter(item => item.name.toLowerCase().includes(lowerQuery));
  }, [searchQuery]);

  return (
    <div className="w-[320px] border-r border-[#1F1E1D]/10 flex flex-col h-full bg-[#FAF9F5] shrink-0 font-sans">
      {/* Header */}
      {isSearching ? (
        <div className="flex items-center justify-between min-h-[56px] py-3 px-6 shrink-0 bg-[#FAF9F5] animate-in fade-in duration-200">
          <div className="flex-1 flex items-center">
            <div className="relative flex-1">
              <div className="flex items-center bg-white border border-[#1F1E1D]/15 rounded-md h-8 px-3 gap-2 transition-all">
                <Search className="w-4 h-4 text-[#3D3D3A] opacity-60" />
                <input 
                  type="text" 
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent border-none outline-none text-[12px] text-[#3D3D3A]"
                />
              </div>
            </div>
            <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className="ml-2"><X className="w-4 h-4 opacity-70" /></button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between min-h-[56px] px-6 py-3 shrink-0 bg-[#FAF9F5]">
          <h2 className="text-[16px] font-semibold text-[#1F1E1D]">Skills</h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsSearching(true)} 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#3D3D3A] transition-all"
              aria-label="Search skills"
            >
              <Search className="w-5 h-5 opacity-70" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#3D3D3A] transition-all"
                  aria-label="Add skill"
                >
                  <Plus className="w-5 h-5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[209px] p-1.5 bg-white/80 backdrop-blur-3xl border-[#1F1E1D]/30 rounded-xl shadow-lg z-[60]">
                <DropdownMenuItem className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 cursor-pointer">
                  <CreateWithClaudeIcon className="w-5 h-5 text-[#3d3d3a]" />
                  <span className="text-[14px]">Create with Claude</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 cursor-pointer" onSelect={() => setIsInstructionsDialogOpen(true)}>
                  <WriteSkillInstructionsIcon className="w-5 h-5 text-[#3d3d3a]" />
                  <span className="text-[14px]">Write skill instructions</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 cursor-pointer" onSelect={() => setIsUploadSkillDialogOpen(true)}>
                  <UploadSkillIcon className="w-5 h-5 text-[#3d3d3a]" />
                  <span className="text-[14px]">Upload a skill</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* List Area */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] font-semibold text-[#73726C] uppercase tracking-tight w-full">
            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
            <span>Starter Skills</span>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            {filteredStarterSkills.map((item) => (
              <TreeItem 
                key={item.name} 
                item={item} 
                path={item.name} 
                depth={0} 
                expandedFolders={expandedFolders} 
                selectedSkill={selectedSkill} 
                onToggle={toggleFolder} 
                onSelect={handleSelectSkill} 
              />
            ))}
          </div>
        </div>
      </div>

      {isInstructionsDialogOpen && <InstructionsDialog open={isInstructionsDialogOpen} onOpenChange={setIsInstructionsDialogOpen} />}
      {isUploadSkillDialogOpen && <UploadSkillDialog open={isUploadSkillDialogOpen} onOpenChange={setIsUploadSkillDialogOpen} />}
    </div>
  );
}
