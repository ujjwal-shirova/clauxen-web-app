'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Code,
  FileSpreadsheet,
  FileText,
  Globe,
  Heart,
  Microscope,
  PenTool,
  Presentation,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollArea } from '@/frontend/components/ui/scroll-area';
import { FeaturedAgentCases } from './featured-agent-cases';
import { PromptSuggestions } from './prompt-suggestions';
import { GlossyTextReveal } from '@/frontend/components/ui/glossy-text-reveal';

interface ChatViewPaneProps {
  hasConversation: boolean;
  activeChip: string | null;
  onActiveChipChange: (chip: string | null) => void;
  onOpenAgentSwarm: () => void;
  onSendMessage: (prompt: string) => void;
  promptInput: ReactNode;
  conversation: ReactNode;
  scrollAreaRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

const allChips = [
  { icon: PenTool, label: 'Write' },
  { icon: BookOpen, label: 'Learn' },
  { icon: Code, label: 'Code' },
  { icon: Heart, label: 'Life stuff' },
  { icon: Sparkles, label: "Clauxen's choice" },
  { icon: Globe, label: 'Websites' },
  { icon: FileText, label: 'Docs' },
  { icon: Presentation, label: 'Slides' },
  { icon: FileSpreadsheet, label: 'Excel' },
  { icon: Microscope, label: 'Deep Research' },
  { icon: Users, label: 'Agent Swarm', beta: true },
];

export function ChatViewPane({
  hasConversation,
  activeChip,
  onActiveChipChange,
  onOpenAgentSwarm,
  onSendMessage,
  promptInput,
  conversation,
  scrollAreaRef,
  className,
}: ChatViewPaneProps) {
  const [mockMarkdownText, setMockMarkdownText] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    fetch('/mock/chat-animation-preview.md')
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) setMockMarkdownText(text);
      })
      .catch(() => {
        if (!cancelled) setMockMarkdownText('');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={className}>
      <ScrollArea className="flex-1 w-full" ref={scrollAreaRef}>
        <div className="flex min-h-full w-full flex-col items-center">
          {hasConversation ? (
            conversation
          ) : (
            <div className="relative flex w-full flex-1 flex-col items-center px-4 pb-20 pt-[60px] font-sans">
              <div className="flex w-full max-w-[672px] flex-col items-center gap-[28px]">
                <h2 className="select-none text-center font-handwriting text-[48px] leading-[60px] tracking-tight text-[#3d3d3a]">
                  Good afternoon, Ujjwal
                </h2>

                <div className="w-full">{promptInput}</div>

                <div className="flex min-h-[40px] w-full max-w-[640px] flex-col items-center">
                  <AnimatePresence mode="wait">
                    {activeChip ? (
                      <PromptSuggestions
                        category={activeChip}
                        onClose={() => onActiveChipChange(null)}
                        onSelect={(suggestion) => {
                          onSendMessage(suggestion);
                          onActiveChipChange(null);
                        }}
                      />
                    ) : (
                      <motion.div
                        key="chips"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 flex w-full flex-wrap justify-center gap-2"
                      >
                        {allChips.map((chip) => (
                          <button
                            key={chip.label}
                            onClick={() => {
                              if (chip.label === 'Agent Swarm') {
                                onOpenAgentSwarm();
                                return;
                              }

                              onActiveChipChange(chip.label);
                            }}
                            className="flex h-8 items-center gap-1.5 rounded-lg border-[0.666667px] border-[#1f1e1d]/15 bg-[#faf9f5] px-[12px] text-[14px] font-[430] text-[#3d3d3a] shadow-sm transition-all duration-150 hover:bg-[#f0eee6]"
                          >
                            <chip.icon className="h-4 w-4 text-[#73726c]" />
                            <span>{chip.label}</span>
                            {('beta' in chip && chip.beta) && (
                              <span className="rounded bg-blue-500/10 px-1 text-[10px] font-bold text-blue-500">
                                BETA
                              </span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <FeaturedAgentCases />

                {mockMarkdownText && (
                  <div className="w-full mt-1 rounded-2xl border border-[#1f1e1d]/10 bg-white/65 backdrop-blur-[6px] px-5 py-4 shadow-[0_10px_30px_rgba(20,20,19,0.05)]">
                    <p className="text-[12px] font-medium text-[#73726c] mb-2">
                      Animated text preview
                    </p>
                    <GlossyTextReveal
                      text={mockMarkdownText}
                      className="text-[14px] leading-[1.8] whitespace-pre-wrap"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {hasConversation && (
        <div className="mx-auto w-full max-w-4xl bg-gradient-to-t from-[#faf9f5] via-[#faf9f5] to-transparent px-6 pb-6 pt-4">
          {promptInput}
        </div>
      )}
    </section>
  );
}
