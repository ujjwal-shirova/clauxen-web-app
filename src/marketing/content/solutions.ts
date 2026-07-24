import type { MarketingPage } from "@/marketing/lib/types";
import { definePage } from "@/marketing/lib/types";
import {
  ctaBand,
  hero,
  linkGrid,
  minimalProductPage,
} from "@/marketing/content/_helpers";

const SOLUTIONS: {
  slug: string;
  title: string;
  description: string;
  points: { title: string; body: string }[];
}[] = [
  {
    slug: "enterprise",
    title: "Enterprise",
    description: "Secure AI at organizational scale.",
    points: [
      { title: "Governance", body: "SSO, SCIM, roles, and auditability." },
      { title: "Scale", body: "Work and Codex across every desk." },
      { title: "Partnership", body: "SLAs, training, and success support." },
    ],
  },
  {
    slug: "coding",
    title: "Coding",
    description: "Ship software faster with Codex and chat.",
    points: [
      { title: "Codex", body: "Agents for features, refactors, and reviews." },
      { title: "In your IDE", body: "Stay where you already write code." },
      { title: "Team context", body: "Connect repos and project tools." },
    ],
  },
  {
    slug: "code-modernization",
    title: "Code modernization",
    description: "Migrate and refactor large codebases.",
    points: [
      { title: "Understand legacy", body: "Map systems before you change them." },
      { title: "Safe refactors", body: "Incremental migrations with review." },
      { title: "Tests first", body: "Validate as you modernize." },
    ],
  },
  {
    slug: "agents",
    title: "Agents",
    description: "Deploy agentic workflows across your organization.",
    points: [
      { title: "Work agents", body: "Goals to deliverables with oversight." },
      { title: "Coding agents", body: "Codex for engineering workflows." },
      { title: "Governed", body: "Admin controls on Business plans." },
    ],
  },
  {
    slug: "customer-support",
    title: "Customer support",
    description: "Assist agents with grounded answers.",
    points: [
      { title: "Grounded replies", body: "Pull from approved knowledge." },
      { title: "Faster resolution", body: "Drafts agents can review and send." },
      { title: "Secure", body: "Keep customer data protected." },
    ],
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity",
    description: "Accelerate reviews and investigations.",
    points: [
      { title: "Triage faster", body: "Summarize alerts and logs." },
      { title: "Code review", body: "Spot risky changes with Codex." },
      { title: "Controlled access", body: "Enterprise identity controls." },
    ],
  },
  {
    slug: "education",
    title: "Education",
    description: "Teaching, learning, and campus operations.",
    points: [
      { title: "Teaching", body: "Lesson prep and materials." },
      { title: "Learning", body: "Study mode for students." },
      { title: "Campus IT", body: "SSO and admin for Edu." },
    ],
  },
  {
    slug: "financial-services",
    title: "Financial services",
    description: "Analysis and reporting with controls.",
    points: [
      { title: "Analysis", body: "Statements, filings, and models." },
      { title: "Controls", body: "Roles and retention options." },
      { title: "Delivery", body: "Board-ready summaries." },
    ],
  },
  {
    slug: "government",
    title: "Government",
    description: "Public-sector ready deployments.",
    points: [
      { title: "Secure by default", body: "Enterprise controls and residency options." },
      { title: "Productivity", body: "Drafting, research, and ops support." },
      { title: "Procurement", body: "Talk to sales for tailored terms." },
    ],
  },
  {
    slug: "healthcare",
    title: "Healthcare",
    description: "Clinical and admin workflows with privacy.",
    points: [
      { title: "Admin relief", body: "Documentation and scheduling support." },
      { title: "Privacy", body: "Business data not used for training by default." },
      { title: "Teams", body: "Shared workspace for staff." },
    ],
  },
  {
    slug: "legal",
    title: "Legal",
    description: "Research, drafting, and review assistance.",
    points: [
      { title: "Research", body: "Survey sources and summarize." },
      { title: "Drafting", body: "Memos and contracts with review loops." },
      { title: "Confidential", body: "Workspace controls for sensitive matters." },
    ],
  },
  {
    slug: "life-sciences",
    title: "Life sciences",
    description: "R&D and documentation support.",
    points: [
      { title: "Literature", body: "Survey and synthesize research." },
      { title: "Documentation", body: "Protocols and reports." },
      { title: "Collaboration", body: "Projects for lab teams." },
    ],
  },
  {
    slug: "nonprofits",
    title: "Nonprofits",
    description: "Do more with lean teams.",
    points: [
      { title: "Grants", body: "Draft and refine proposals." },
      { title: "Programs", body: "Plans, reports, and comms." },
      { title: "Budget-aware", body: "Start free; scale when ready." },
    ],
  },
  {
    slug: "small-business",
    title: "Small business",
    description: "AI workspace for growing companies.",
    points: [
      { title: "One workspace", body: "Chat, docs, and code help together." },
      { title: "Connectors", body: "Link the tools you already use." },
      { title: "Upgrade path", body: "Move to Business as you grow." },
    ],
  },
  {
    slug: "teachers",
    title: "Teachers",
    description: "Lesson planning and school collaboration.",
    points: [
      { title: "Prep time", body: "Lessons, activities, and rubrics." },
      { title: "School workspace", body: "Collaborate with colleagues." },
      { title: "Student data care", body: "Privacy-minded defaults." },
    ],
  },
];

export const solutionsIndexPage = definePage(
  "/solutions",
  "Solutions",
  "Clauxen by industry and use case.",
  [
    hero(
      "Solutions",
      "See how teams apply Clauxen across coding, support, education, healthcare, and more.",
    ),
    linkGrid(
      SOLUTIONS.map((s) => ({
        title: s.title,
        body: s.description,
        href: `/solutions/${s.slug}`,
      })),
    ),
    ctaBand("Talk to sales"),
  ],
);

export const solutionPages: MarketingPage[] = [
  solutionsIndexPage,
  ...SOLUTIONS.map((s) =>
    minimalProductPage({
      path: `/solutions/${s.slug}`,
      title: s.title,
      description: s.description,
      eyebrow: "Solutions",
      headline: `Clauxen for ${s.title.toLowerCase()}`,
      subtitle: s.description,
      points: s.points,
    }),
  ),
  minimalProductPage({
    path: "/solutions/life-sciences/ai-adoption-index",
    title: "Life sciences AI adoption",
    description: "Insights for AI adoption in life sciences.",
    eyebrow: "Life sciences",
    headline: "AI adoption index",
    subtitle: "How life sciences teams are putting Clauxen to work.",
    points: [
      {
        title: "Where AI helps",
        body: "Literature, documentation, and collaboration.",
      },
      {
        title: "Controls that matter",
        body: "Privacy defaults for sensitive research.",
      },
      {
        title: "Next step",
        body: "Talk to sales about a pilot.",
      },
    ],
  }),
];
