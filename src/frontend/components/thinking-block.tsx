'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';
import { useEffect, useMemo, useRef } from 'react';
import { MarkdownRenderer } from './markdown-renderer';

interface ThinkingBlockProps {
  className?: string;
  label?: string;
  content?: string;
  isStreaming?: boolean;
  thinkingDurationSeconds?: number;
}

export function ThinkingBlock({
  className,
  label = 'Thinking',
  content = '',
  isStreaming = false,
  thinkingDurationSeconds,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(isStreaming);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousIsStreamingRef = useRef(isStreaming);

  const lineCount = useMemo(() => {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length;
  }, [content]);

  useEffect(() => {
    if (!isVisible) return;
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [content, isExpanded, isVisible]);

  useEffect(() => {
    const wasStreaming = previousIsStreamingRef.current;
    previousIsStreamingRef.current = isStreaming;

    if (!wasStreaming && isStreaming) {
      setIsVisible(true);
      return;
    }

    if (wasStreaming && !isStreaming) {
      setIsVisible(false);
    }
  }, [isStreaming]);

  if (!content.trim()) {
    return null;
  }

  const displayLabel = isStreaming
    ? label
    : `Thought for ${thinkingDurationSeconds ?? 0}s`;

  return (
    <div className={cn('w-full animate-in fade-in slide-in-from-top-1 duration-300', className)}>
      <div className="px-2 py-2">
        <div className="grid gap-y-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setIsVisible((value) => !value)}
              className="flex w-full items-center gap-2 rounded-[10px] py-0.5 text-left text-[14px] leading-5 text-[#73726c] transition-all duration-200 hover:text-[#3d3d3a]"
              aria-expanded={isVisible}
            >
              <span className={cn('truncate font-medium', isStreaming && 'shimmer-text')}>{displayLabel}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-[#73726c] transition-transform duration-200',
                  isVisible && 'rotate-180'
                )}
                strokeWidth={1.8}
              />
            </button>
          </div>

          {isVisible && (
            <div className="overflow-hidden pt-0.5">
            <div className="grid gap-3 rounded-[12px] border border-[#1f1e1d]/8 bg-[#faf9f5] px-3 py-2.5 text-[14px] font-[430] leading-[1.4] text-[#3d3d3a]">
              <div
                ref={scrollRef}
                className={cn(
                  'overflow-y-auto pr-1 text-[14px] leading-[1.55] text-[#3d3d3a] scrollbar-thin',
                  isExpanded ? 'max-h-[20.5rem]' : 'max-h-[10.85rem]'
                )}
              >
                <div className="thinking-markdown">
                  <MarkdownRenderer content={content} isStreaming={isStreaming} showCursor={false} />
                </div>
              </div>
              {lineCount > 4 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded((value) => !value)}
                  className="w-fit text-[12px] font-medium text-[#73726c] transition-colors hover:text-[#3d3d3a]"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
