"use client";

import React from "react";
import { Plus, Loader2 } from "lucide-react"; // Lucide icons — New artifact (Plus), loading spinner (Loader2)
import { Button } from "@/components/ui/button"; // shadcn Button — header CTA "New artifact" styling
import { cn } from "@/lib/utils"; // Tailwind className merge — tab/category active state classes conflict-free
import { appBtn } from "@/lib/app-buttons";
import { useArtifacts } from "@/hooks/use-artifacts"; // custom hook — artifacts list fetch + createArtifact mutation
import { useAuth } from "@/hooks/use-auth";

const categories = [
  "All",
  "Learn something", // educational / learning templates
  "Life hacks", // productivity / utility templates
  "Play a game", // interactive game-style artifacts
  "Be creative", // creative / builder templates
  "Touch grass", // outdoor / wellness themed placeholder category
];

const MAX_ARTIFACT_TITLE_LENGTH = 200;

const inspirations = [
  {
    title: "Writing editor",
    category: "Be creative",
    image: "https://claude.ai/images/artifacts-studio/writing_editor.svg",
  },
  {
    title: "PRD To Prototype",
    category: "Be creative",
    image: "https://claude.ai/images/artifacts-studio/c4e_prd_to_prototype.svg",
  },
  {
    title: "Slack Project Insights",
    category: "Learn something",
    image:
      "https://claude.ai/images/artifacts-studio/slack_project_insights.svg",
  },
  {
    title: "Raw Note Transformer",
    category: "Life hacks",
    image:
      "https://claude.ai/images/artifacts-studio/c4e_raw_note_transformer.svg",
  },
  {
    title: "Brainstorm Idea Generator",
    category: "Be creative",
    image:
      "https://claude.ai/images/artifacts-studio/c4e_brainstorm_idea_generator.svg",
  },
  {
    title: "Flashcards",
    category: "Learn something",
    image: "https://claude.ai/images/artifacts-studio/flashcards.svg",
  },
  {
    title: "Anthropic office simulator",
    category: "Play a game",
    image: "https://claude.ai/images/artifacts-studio/office_sim.svg",
  },
  {
    title: "CodeVerter",
    category: "Be creative",
    image: "https://claude.ai/images/artifacts-studio/codeverter.svg",
  },
  {
    title: "PyLingo",
    category: "Learn something",
    image: "https://claude.ai/images/artifacts-studio/pylingo.svg",
  },
  {
    title: "Molecule studio",
    category: "Learn something",
    image: "https://claude.ai/images/artifacts-studio/molecule.svg",
  },
  {
    title: "QR code generator",
    category: "Life hacks",
    image: "https://claude.ai/images/artifacts-studio/qr_code.svg",
  },
  {
    title: "AI platformer game",
    category: "Play a game",
    image: "https://claude.ai/images/artifacts-studio/ai_platformer.svg",
  },
];

export function ArtifactsView() {
  const auth = useAuth();
  const { artifacts, loading, createArtifact } = useArtifacts(
    auth.isAuthenticated,
  );
  const [activeTab, setActiveTab] = React.useState<"inspiration" | "yours">( // tab state — inspiration gallery vs owned artifacts
    "inspiration",
  );
  const [activeCategory, setActiveCategory] = React.useState("All");
  const [creating, setCreating] = React.useState(false); // mutation in-flight — New button disable + spinner

  const filteredInspirations = inspirations.filter(
    (item) => activeCategory === "All" || item.category === activeCategory,
  );

  const handleNewArtifact = async () => {
    const title = window.prompt("Artifact name");
    if (!title?.trim()) return;
    setCreating(true);
    try {
      await createArtifact(title.trim()); // POST new blank artifact — backend created row return
      setActiveTab("yours");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromInspiration = async (title: string) => {
    if (!auth.isAuthenticated) return;
    await createArtifact(title, "template");
  };

  return (
    // full-page layout — sticky header + scrollable main grid
    <div className="flex flex-col flex-1 w-full bg-zinc-50 animate-in fade-in duration-500 font-sans h-full">
      {" "}
      {/* root flex column — warm background + page fade-in */}
      <div className="sticky top-0 z-20 bg-zinc-50">
        <header className="flex items-center justify-center h-16 sm:h-20 w-full shrink-0 px-3 sm:px-5 max-w-[780px] mx-auto">
          {" "}
          {/* top bar — responsive height */}
          <div className="flex items-center justify-between w-full px-2 sm:px-6">
            <h1 className="text-[21px] sm:text-[22px] font-serif font-medium text-zinc-800">
              Artifacts
            </h1>
            <Button
              onClick={() => void handleNewArtifact()} // async handler — void floating promise lint suppress
              disabled={creating || !auth.isAuthenticated}
              className={cn(
                appBtn.primarySm,
                "gap-1.5 px-3 sm:px-3.5 text-[13px]",
              )}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 text-white" /> // default plus icon
              )}
              <span>New artifact</span>
            </Button>
          </div>
        </header>

        <div className="max-w-[780px] mx-auto px-4 sm:px-10 mb-4 sm:mb-5">
          {" "}
          {/* tab switcher container */}
          <div className="flex gap-1 border-b border-zinc-200 w-full">
            {" "}
            {/* underline-style tab bar */}
            <button
              onClick={() => setActiveTab("inspiration")} // Inspiration gallery tab activate
              className={cn(
                "h-11 px-1.5 text-[13px] font-medium transition-all relative",
                activeTab === "inspiration"
                  ? "text-zinc-900" // active tab — dark text
                  : "text-zinc-500 hover:text-zinc-900", // inactive — muted + hover
              )}
            >
              <span>Inspiration</span>
              {activeTab === "inspiration" && ( // active indicator underline
                <div className="absolute bottom-0 left-0 right-0 h-[1.33333px] bg-zinc-900 no-hover-overlay" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("yours")} // user saved artifacts tab activate
              className={cn(
                "h-11 px-1.5 text-[13px] font-medium transition-all relative",
                activeTab === "yours"
                  ? "text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              <span>Your artifacts</span>
              {activeTab === "yours" && (
                <div className="absolute bottom-0 left-0 right-0 h-[1.33333px] bg-zinc-900 no-hover-overlay" />
              )}
            </button>
          </div>
        </div>

        {activeTab === "inspiration" && (
          <div className="app-scrollbar mx-auto max-w-[780px] overflow-x-auto px-4 pb-3 sm:px-10">
            <div className="flex gap-2">
              {categories.map((cat) => (
                <button
                  key={cat} // React list key — category label unique
                  onClick={() => setActiveCategory(cat)} // category filter apply
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-all border border-transparent",
                    activeCategory === cat
                      ? "bg-[#e8e6dc] text-zinc-900 font-medium" // selected pill — filled background
                      : "text-zinc-500 hover:bg-zinc-100", // unselected — subtle hover
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <main className="app-scrollbar mx-auto w-full max-w-[780px] flex-1 overflow-y-auto px-4 pb-16 sm:px-10">
        {activeTab === "inspiration" ? ( // Inspiration tab — template card grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-3">
            {" "}
            {/* responsive 1/2/3 column grid */}
            {filteredInspirations.map((item) => (
              <button
                key={item.title}
                type="button" // explicit button — accidental form submit avoid
                onClick={() => void createArtifact(item.title, "template")}
                className="flex flex-col gap-2.5 group cursor-pointer text-left"
              >
                <div className="aspect-[260/164] bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  {" "}
                  {/* fixed aspect preview frame */}
                  <img
                    src={item.image} // external SVG/PNG preview URL
                    alt={item.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <span className="text-[13px] font-medium text-zinc-800 line-clamp-1">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : artifacts.length === 0 ? (
          <p className="text-center text-[14px] text-zinc-500 py-16">
            No artifacts yet. Create one to get started.
          </p>
        ) : (
          // populated user artifacts grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-3">
            {artifacts.map((artifact) => (
              <article
                key={artifact.id} // stable server id — list key
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <h3 className="text-[14px] font-medium text-zinc-800 truncate">
                  {artifact.title}
                </h3>
                <p className="text-[12px] text-zinc-500 capitalize">
                  {artifact.kind} · {artifact.status}{" "}
                  {/* kind (template/custom) + lifecycle status */}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
