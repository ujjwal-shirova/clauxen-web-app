'use client';

import React from 'react';
import { ArrowUpRight, Microscope } from 'lucide-react';
import { PromptInput } from './prompt-input';

interface DeepResearchViewProps {
  onSendMessage: (prompt: string) => void;
  isGenerating: boolean;
}

const suggestions = [
  {
    title: 'Evaluate Healthcare Systems',
    description:
      'Compare access, outcomes, and costs across different countries and healthcare models. Identify which systems deliver the best results for patients and which are under strain.',
  },
  {
    title: 'Compare Music Trends',
    description:
      'Analyze streaming data, live shows, and genre popularity to understand how music tastes are shifting around the world.',
  },
  {
    title: 'Compare Credit Options',
    description:
      'Analyze interest rates, fees, and borrower outcomes across credit cards, personal loans, and mortgages. Identify which types of credit are becoming more expensive and which remain affordable.',
  },
  {
    title: 'Track Food Culture',
    description:
      'Analyze restaurant trends, grocery data, and cuisine popularity to see how eating habits are changing across regions.',
  },
];

export function DeepResearchView({ onSendMessage, isGenerating }: DeepResearchViewProps) {
  return (
    <div className="flex flex-1 w-full bg-[#faf9f5] font-sans overflow-y-auto">
      <div className="w-full px-4 sm:px-6 lg:px-16 pb-12">
        <div className="w-full max-w-[768px] mx-auto flex flex-col gap-4">
          <div className="text-center pt-10 sm:pt-14">
            <span className="mx-auto mb-3 flex items-center justify-center w-16 h-16 rounded-full bg-[#ebf4ff]/80 text-[#0285ff]">
              <Microscope className="w-[30px] h-[30px]" />
            </span>
            <h1 className="text-[28px] leading-[34px] tracking-[0.38px] font-semibold text-[#141413]">
              What can I help with?
            </h1>
            <p className="mt-2 text-[16px] leading-6 text-[#5d5d5d]">
              Ask a complex question. Get a full report, with sources.
            </p>
          </div>

          <div className="w-full pt-10">
            <PromptInput
              onSendMessage={onSendMessage}
              isConversationStarted={false}
              isGenerating={isGenerating}
            />
          </div>

          <section className="w-full pt-3" aria-label="Suggested prompts">
            <ul className="flex flex-col w-full">
              {suggestions.map((item) => (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => onSendMessage(item.title)}
                    className="w-full flex items-center gap-3 rounded-xl px-[18px] py-3 text-left transition-colors hover:bg-black/[0.02]"
                  >
                    <ArrowUpRight className="w-5 h-5 shrink-0 text-[#8f8f8f]" />
                    <span className="flex items-center gap-2 w-full overflow-hidden">
                      <span className="shrink-0 text-[14px] leading-5 text-[#141413] font-medium">
                        {item.title}
                      </span>
                      <span className="text-[14px] leading-[22px] tracking-[-0.14px] text-[#8f8f8f] truncate">
                        {item.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
