'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';
import { OrbCursor } from './ui/orb-cursor';

import { useEffect, useMemo, useRef } from 'react';

interface ThinkingBlockProps {
  className?: string;
  label?: string;
  content?: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({
  className,
  label = 'Thinking',
  content = '',
  isStreaming = false,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }, [content]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, isExpanded]);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className={cn('w-full animate-in fade-in slide-in-from-top-1 duration-300', className)}>
      <div className="px-2 py-2">
        <div className="grid gap-y-2">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 rounded-[10px] py-0.5 text-left text-[14px] leading-5 text-[#73726c] transition-all duration-200"
              aria-expanded="true"
            >
              <span className="truncate font-medium shimmer-text">{label}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#73726c]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="overflow-hidden pt-0.5">
            <div className="grid gap-3 rounded-[12px] border border-[#1f1e1d]/8 bg-[#faf9f5] px-3 py-2.5 text-[14px] font-[430] leading-[1.4] text-[#3d3d3a]">
              <div
                ref={scrollRef}
                className={cn(
                  'overflow-y-auto pr-1 text-[14px] leading-[1.55] text-[#3d3d3a] scrollbar-thin',
                  isExpanded ? 'max-h-[16.4rem]' : 'max-h-[10.85rem]'
                )}
              >
                <div className="grid gap-3">
                  {lines.map((step, index) => (
                    <p key={`${index}-${step}`}>{step}</p>
                  ))}
                  {isStreaming && (
                    <div className="flex items-center">
                      <OrbCursor />
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                className="w-fit text-[12px] font-medium text-[#73726c] transition-colors hover:text-[#3d3d3a]"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
