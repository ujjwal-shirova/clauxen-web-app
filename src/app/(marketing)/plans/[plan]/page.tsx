import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../../_components/marketing-placeholder";

const PLANS: Record<string, { title: string; description: string }> = {
  free: {
    title: "Free",
    description: "Get started with Clauxen at no cost.",
  },
  go: {
    title: "Go",
    description: "More access and higher limits for everyday use.",
  },
  plus: {
    title: "Plus",
    description: "More features, more models, and more room to explore.",
  },
  pro: {
    title: "Pro",
    description: "Our most capable plan for power users and professionals.",
  },
  business: {
    title: "Business",
    description: "For teams that need shared workspaces and admin controls.",
  },
  enterprise: {
    title: "Enterprise",
    description: "Advanced security, privacy, and deployment options at scale.",
  },
  education: {
    title: "Higher Education",
    description: "Built for universities and their students and educators.",
  },
};

export function generateStaticParams() {
  return Object.keys(PLANS).map((plan) => ({ plan }));
}

export const metadata: Metadata = {
  title: "Plans - Clauxen",
  description: "Compare Clauxen plans.",
};

type PlanPageProps = { params: Promise<{ plan: string }> };

export default async function PlanPage({ params }: PlanPageProps) {
  const { plan } = await params;
  const planInfo = PLANS[plan];
  if (!planInfo) notFound();

  return (
    <MarketingPlaceholder
      eyebrow="Pricing"
      title={planInfo.title}
      description={planInfo.description}
    />
  );
}
