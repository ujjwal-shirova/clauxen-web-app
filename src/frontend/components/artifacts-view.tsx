'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { cn } from '@/frontend/lib/utils';

const categories = [
  "All", "Learn something", "Life hacks", "Play a game", "Be creative", "Touch grass"
];

const inspirations = [
  { title: "Writing editor", image: "https://claude.ai/images/artifacts-studio/writing_editor.svg" },
  { title: "PRD To Prototype", image: "https://claude.ai/images/artifacts-studio/c4e_prd_to_prototype.svg" },
  { title: "Slack Project Insights", image: "https://claude.ai/images/artifacts-studio/slack_project_insights.svg" },
  { title: "Raw Note Transformer", image: "https://claude.ai/images/artifacts-studio/c4e_raw_note_transformer.svg" },
  { title: "Brainstorm Idea Generator", image: "https://claude.ai/images/artifacts-studio/c4e_brainstorm_idea_generator.svg" },
  { title: "Flashcards", image: "https://claude.ai/images/artifacts-studio/flashcards.svg" },
  { title: "Anthropic office simulator", image: "https://claude.ai/images/artifacts-studio/office_sim.svg" },
  { title: "CodeVerter", image: "https://claude.ai/images/artifacts-studio/codeverter.svg" },
  { title: "PyLingo", image: "https://claude.ai/images/artifacts-studio/pylingo.svg" },
  { title: "Molecule studio", image: "https://claude.ai/images/artifacts-studio/molecule.svg" },
  { title: "QR code generator", image: "https://claude.ai/images/artifacts-studio/qr_code.svg" },
  { title: "AI platformer game", image: "https://claude.ai/images/artifacts-studio/ai_platformer.svg" }
];

export function ArtifactsView() {
  const [activeTab, setActiveTab] = React.useState<'inspiration' | 'yours'>('inspiration');
  const [activeCategory, setActiveCategory] = React.useState('All');

  return (
    <div className="flex flex-col flex-1 w-full bg-[#faf9f5] animate-in fade-in duration-500 font-sans h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#faf9f5]">
        <header className="flex items-center justify-center h-24 w-full shrink-0 px-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between w-full px-8">
            <h1 className="text-[24px] font-serif font-medium text-[#3d3d3a]">Artifacts</h1>
            <Button className="bg-[#141413] text-white hover:bg-[#141413]/90 rounded-lg h-9 px-4 flex items-center gap-1.5 font-medium transition-transform active:scale-95">
              <Plus className="w-4 h-4 text-white" />
              <span>New artifact</span>
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-14 mb-6">
          <div className="flex gap-1 border-b border-[#1f1e1d]/15 w-full">
            <button 
              onClick={() => setActiveTab('inspiration')}
              className={cn(
                "h-[52px] px-1.5 text-[14px] font-medium transition-all relative",
                activeTab === 'inspiration' ? "text-[#141413]" : "text-[#73726c] hover:text-[#141413]"
              )}
            >
              <span>Inspiration</span>
              {activeTab === 'inspiration' && <div className="absolute bottom-0 left-0 right-0 h-[1.33333px] bg-[#141413]" />}
            </button>
            <button 
              onClick={() => setActiveTab('yours')}
              className={cn(
                "h-[52px] px-1.5 text-[14px] font-medium transition-all relative",
                activeTab === 'yours' ? "text-[#141413]" : "text-[#73726c] hover:text-[#141413]"
              )}
            >
              <span>Your artifacts</span>
              {activeTab === 'yours' && <div className="absolute bottom-0 left-0 right-0 h-[1.33333px] bg-[#141413]" />}
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="max-w-4xl mx-auto px-14 overflow-x-auto scrollbar-hide pb-4">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[14px] whitespace-nowrap transition-all border border-transparent",
                  activeCategory === cat 
                    ? "bg-[#e8e6dc] text-[#141413] font-medium" 
                    : "text-[#73726c] hover:bg-[#f0eee6]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-14 pb-20 overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {inspirations.map((item, i) => (
            <div key={i} className="flex flex-col gap-2.5 group cursor-pointer">
              <div className="aspect-[260/164] bg-white border border-[#1f1e1d]/15 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
              </div>
              <span className="text-[14px] font-medium text-[#3d3d3a] line-clamp-1">{item.title}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
