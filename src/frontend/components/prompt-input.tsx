'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowDown, ArrowUp, AudioLines, ChevronDown, Square, X } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';
import { VoiceCall } from './voice-call';
import { PlusIcon } from './icons';
import { PromptAddMenu } from './prompt-add-menu';
import { HintTooltip } from './ui/hint-tooltip';

interface PromptInputProps {
  onSendMessage: (prompt: string) => void;
  onStopGeneration: () => void;
  onScrollToBottom?: () => void;
  showScrollToBottomButton?: boolean;
  isConversationStarted: boolean;
  isGenerating: boolean;
}

export function PromptInput({
  onSendMessage,
  onStopGeneration,
  onScrollToBottom,
  showScrollToBottomButton = false,
  isConversationStarted,
  isGenerating,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [selectedQuickActions, setSelectedQuickActions] = useState<Array<'image' | 'video' | 'music' | 'deep-research'>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize logic with 7 line limit (approx 168px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 168);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 168 ? 'auto' : 'hidden';
    }
  }, [prompt]);

  const handleSubmit = () => {
    if (prompt.trim() && !isGenerating) {
      onSendMessage(prompt);
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) return;
      handleSubmit();
    }
  };

  const quickActionLabelMap: Record<'image' | 'video' | 'music' | 'deep-research', string> = {
    image: 'Image',
    video: 'Video',
    music: 'Music',
    'deep-research': 'Deep research',
  };

  const handleQuickActionSelect = (action: 'image' | 'video' | 'music' | 'deep-research') => {
    setSelectedQuickActions((prev) => (prev.includes(action) ? prev : [...prev, action]));
  };

  const handleQuickActionRemove = (action: 'image' | 'video' | 'music' | 'deep-research') => {
    setSelectedQuickActions((prev) => prev.filter((item) => item !== action));
  };

  return (
    <>
      <div className="w-full flex flex-col items-center">
        <div className="relative w-full flex justify-center">
          {showScrollToBottomButton && onScrollToBottom && (
            <HintTooltip content="Scroll to latest">
              <button
                type="button"
                onClick={onScrollToBottom}
                className="absolute -top-10 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#1f1e1d]/15 bg-white/95 text-[#3d3d3a] transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                <ArrowDown className="icon-md" />
              </button>
            </HintTooltip>
          )}

          <div className={cn(
            "w-full bg-white rounded-[28px] transition-all duration-200 ring-[0.5px] ring-black/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden focus-within:ring-black/20 focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.06)] border-none",
            isConversationStarted ? "max-w-4xl" : "max-w-3xl"
          )}>
          <div className={cn("px-[10px] py-[8px] flex items-start gap-1 min-h-[56px]", selectedQuickActions.length > 0 && "min-h-[96px]")}>
            {/* Leading Icon - Fixed at Top Center of line 1 */}
            <div className="flex items-center justify-center shrink-0 w-[44px] h-[40px]">
              <PromptAddMenu
                onQuickActionSelect={handleQuickActionSelect}
                trigger={
                  <button 
                    className="menu-trigger-active flex h-9 w-9 items-center justify-center rounded-full text-[#3d3d3a]"
                    title="Add content"
                  >
                    <PlusIcon className="w-5 h-5 opacity-70" />
                  </button>
                }
              />
            </div>

            {/* Primary Input Area - This expands */}
            <div className="flex-1 px-2 min-h-[40px] py-[2px]">
              <textarea
                ref={textareaRef}
                placeholder="How can I help you today?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-[16px] text-[#3d3d3a] placeholder-[#73726c]/60 font-[430] leading-[22.4px] min-h-[22.4px] py-[8px] shadow-none ring-0 outline-none border-0 block"
                rows={1}
              />
              {selectedQuickActions.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {selectedQuickActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => handleQuickActionRemove(action)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#0285ff]/20 bg-[#0285ff]/10 px-2.5 text-[13px] font-medium text-[#0285ff] transition-colors hover:bg-[#0285ff]/15"
                    >
                      <span>{quickActionLabelMap[action]}</span>
                      <X className="icon-sm" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            
            {/* Trailing Icons - Fixed at Top Center of line 1 */}
            <div className="flex items-center gap-1 shrink-0 h-[40px]">
              <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg hover:bg-[#f0eee6] text-[#3d3d3a] transition-all">
                <span className="text-[14px] font-medium opacity-70">Sonnet 4.6</span>
                <ChevronDown className="icon-sm opacity-50" />
              </button>

              <div className="w-[40px] flex items-center justify-center">
                {isGenerating ? (
                  <HintTooltip content="Stop generating">
                    <button 
                      onClick={onStopGeneration}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-[#3d3d3a] text-white transition-all duration-200 hover:bg-black"
                    >
                      <Square className="icon-md fill-current" />
                    </button>
                  </HintTooltip>
                ) : prompt.trim() ? (
                  <HintTooltip content="Send">
                    <button 
                      onClick={handleSubmit}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-black text-white transition-all duration-200"
                    >
                      <ArrowUp className="icon-xl" />
                    </button>
                  </HintTooltip>
                ) : (
                  <HintTooltip content="Dictate">
                    <button 
                      onClick={() => setVoiceCallOpen(true)}
                      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f0eee6] text-[#3d3d3a] transition-all"
                    >
                      <AudioLines className="icon-xl opacity-70" />
                    </button>
                  </HintTooltip>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      <VoiceCall isOpen={voiceCallOpen} onClose={() => setVoiceCallOpen(false)} />
    </>
  );
}
