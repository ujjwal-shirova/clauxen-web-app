import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../../_components/marketing-placeholder";

const USE_CASES: Record<string, { title: string; description: string }> = {
  students: {
    title: "Students",
    description: "Study smarter with explanations, practice, and feedback.",
  },
  "university-educators": {
    title: "University Educators",
    description: "Design courses, build materials, and support students at scale.",
  },
  teachers: {
    title: "Teachers",
    description: "Plan lessons, differentiate instruction, and save hours each week.",
  },
  "science-medicine": {
    title: "Science and Medicine",
    description: "Explore research questions with clear, grounded explanations.",
  },
  parents: {
    title: "Parents",
    description: "Support your family's learning, planning, and everyday questions.",
  },
  veterans: {
    title: "Veterans",
    description: "Navigate benefits, careers, and the transition to civilian life.",
  },
  "fitness-wellness-and-health": {
    title: "Fitness, Wellness, and Health",
    description: "Build routines and explore health questions with practical guidance.",
  },
  "money-and-finances": {
    title: "Money and Finances",
    description: "Understand budgeting, planning, and financial concepts.",
  },
  "recipes-cooking": {
    title: "Recipes and Cooking",
    description: "Find recipes, plan meals, and cook with what you have.",
  },
  "travel-and-exploration": {
    title: "Travel and Exploration",
    description: "Plan trips, build itineraries, and explore new places.",
  },
  writing: {
    title: "Writing",
    description: "Turn rough notes into clear, polished writing.",
  },
  "chat-with-presentations": {
    title: "Chat with Presentations",
    description: "Ask questions about slides and build new decks faster.",
  },
  "chat-with-spreadsheets": {
    title: "Chat with Spreadsheets",
    description: "Analyze data and build models in plain language.",
  },
};

export function generateStaticParams() {
  return Object.keys(USE_CASES).map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Use Cases - Clauxen",
  description: "See how people use Clauxen for work, life, and everything in between.",
};

type UseCasePageProps = { params: Promise<{ slug: string }> };

export default async function UseCasePage({ params }: UseCasePageProps) {
  const { slug } = await params;
  const useCase = USE_CASES[slug];
  if (!useCase) notFound();

  return (
    <MarketingPlaceholder
      eyebrow="Use cases"
      title={useCase.title}
      description={useCase.description}
    />
  );
}
