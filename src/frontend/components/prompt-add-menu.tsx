'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import {
  ChevronRight,
  Ellipsis,
  FileText,
  ImagePlus,
  LayoutPanelTop,
  Music4,
  Paperclip,
  Telescope,
  Video,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/frontend/components/ui/popover';
import { cn } from '@/frontend/lib/utils';
import {
  CheckIcon,
  PromptAddFilesIcon,
  PromptConnectorsIcon,
  PromptProjectIcon,
  PromptScreenshotIcon,
  PromptStyleIcon,
  PromptWebSearchIcon,
  WriteSkillInstructionsIcon,
} from './icons';

type PromptMenuItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  trailing?: 'chevron' | 'shortcut' | 'check';
  shortcut?: string;
  active?: boolean;
};

const primaryItems: PromptMenuItem[] = [
  {
    label: 'Add files or photos',
    icon: PromptAddFilesIcon,
    trailing: 'shortcut',
    shortcut: 'Ctrl+U',
  },
  {
    label: 'Take a screenshot',
    icon: PromptScreenshotIcon,
  },
  {
    label: 'Recent files',
    icon: FileText,
    trailing: 'chevron',
  },
];

const centerItems: PromptMenuItem[] = [
  {
    label: 'Add to project',
    icon: PromptProjectIcon,
    trailing: 'chevron',
  },
  {
    label: 'Web search',
    icon: PromptWebSearchIcon,
    trailing: 'check',
    active: true,
  },
];

const bottomItems: PromptMenuItem[] = [
  {
    label: 'Use style',
    icon: PromptStyleIcon,
    trailing: 'chevron',
  },
  {
    label: 'Add connectors',
    icon: PromptConnectorsIcon,
  },
  {
    label: 'Skills',
    icon: WriteSkillInstructionsIcon,
    trailing: 'chevron',
  },
];

const moreItems: PromptMenuItem[] = [
  {
    label: 'Create music',
    icon: Music4,
  },
  {
    label: 'Create image',
    icon: ImagePlus,
  },
  {
    label: 'Create videos',
    icon: Video,
  },
  {
    label: 'Deep research',
    icon: Telescope,
  },
  {
    label: 'Canvas',
    icon: LayoutPanelTop,
  },
];

function PromptAddMenuItem({ item }: { item: PromptMenuItem }) {
  const Icon = item.icon;
  const isActive = Boolean(item.active);

  return (
    <button
      type="button"
      className={cn(
        'group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0',
        isActive ? 'text-[#2c84db]' : 'text-[#141413]'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Icon className={cn('h-5 w-5', isActive ? 'text-[#2c84db]' : 'text-[#141413]')} />
        </div>
        <span className="truncate font-normal">{item.label}</span>
      </div>

      {item.trailing === 'shortcut' && item.shortcut ? (
        <span className="truncate text-right text-[12px] font-[430] leading-4 text-[#73726c] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {item.shortcut}
        </span>
      ) : null}

      {item.trailing === 'chevron' ? (
        <span className="ml-auto flex h-4 w-4 items-center justify-center text-[#73726c]">
          <ChevronRight className="h-4 w-4" />
        </span>
      ) : null}

      {item.trailing === 'check' ? (
        <span className="ml-auto flex h-4 w-4 items-center justify-center text-[#2c84db]">
          <CheckIcon className="h-4 w-4" />
        </span>
      ) : null}
    </button>
  );
}

function PromptAddMenuSeparator({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      className="mx-2 my-[6px] h-[0.5px] bg-[#1f1e1d]/15"
    />
  );
}

interface PromptAddMenuProps {
  trigger: ReactNode;
}

export function PromptAddMenu({ trigger }: PromptAddMenuProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={12}
        className={cn(
          'z-[60] min-w-[192px] max-w-[320px] rounded-[12px] border border-[#1f1e1d]/30 bg-white p-[6px] text-[16px] font-normal leading-6 text-[#141413] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl font-sans'
        )}
      >
        <div role="menu" aria-orientation="vertical" className="outline-none">
          {primaryItems.map((item) => (
            <PromptAddMenuItem key={item.label} item={item} />
          ))}

          <PromptAddMenuSeparator label="separator-center" />

          {centerItems.map((item) => (
            <PromptAddMenuItem key={item.label} item={item} />
          ))}

          <div
            className="relative mt-0.5"
            onMouseEnter={() => setIsMoreOpen(true)}
            onMouseLeave={() => setIsMoreOpen(false)}
          >
            <button
              type="button"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((open) => !open)}
              className="group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-[#141413] transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Ellipsis className="h-5 w-5 text-[#141413]" />
                </div>
                <span className="truncate font-normal">More</span>
              </div>
              <span className="ml-auto flex h-4 w-4 items-center justify-center text-[#73726c]">
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>

            {isMoreOpen ? (
              <div className="absolute bottom-[-1px] left-[calc(100%-4px)] z-[70] flex min-w-[192px] max-w-[320px] flex-col rounded-[12px] border border-[#1f1e1d]/30 bg-white p-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
                {moreItems.map((item) => (
                  <PromptAddMenuItem key={item.label} item={item} />
                ))}
              </div>
            ) : null}
          </div>

          <PromptAddMenuSeparator label="separator-bottom" />

          {bottomItems.map((item) => (
            <PromptAddMenuItem key={item.label} item={item} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
