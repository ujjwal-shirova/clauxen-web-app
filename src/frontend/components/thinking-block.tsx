'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';

const defaultSteps = [
  'Reading your message and shaping the response.',
  'Breaking the request into smaller pieces.',
  'Checking the layout and visual rhythm of the block.',
  'Aligning the shimmer treatment with the label style.',
  'Refining spacing so the block feels intentional.',
  'Keeping the pending assistant state clean and minimal.',
  'Preparing the final reply structure for the next step.',
];

const extraSteps = [
  'Reviewing whether the interaction needs any final polish before the real assistant response is connected.',
  'Holding the pending state in place so the block feels stable while the message is still in progress.',
];

interface ThinkingBlockProps {
  className?: string;
  label?: string;
  steps?: string[];
}

export function ThinkingBlock({
  className,
  label = 'Thinking',
  steps = defaultSteps,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleSteps = isExpanded ? [...steps, ...extraSteps] : steps;

  return (
    <div className={cn('w-full animate-in fade-in duration-300', className)}>
      <div className="px-2 py-2">
        <div className="grid gap-y-2">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 rounded-[10px] py-0.5 text-left text-[14px] leading-5 text-[#73726c]"
              aria-expanded="true"
            >
              <span className="truncate font-medium shimmer-text">{label}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#73726c]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="overflow-hidden pt-0.5">
            <div className="grid gap-3 rounded-[12px] border border-[#1f1e1d]/8 bg-[#faf9f5] px-3 py-2.5 text-[14px] font-[430] leading-[1.4] text-[#3d3d3a]">
              {visibleSteps.map((step) => (
                <p key={step}>{step}</p>
              ))}
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
