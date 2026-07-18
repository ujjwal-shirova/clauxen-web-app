import type { MarketingPage } from "@/website/lib/types";
import { definePage } from "@/website/lib/types";
import {
  CTA,
  bullets,
  ctaBand,
  features,
  hero,
  linkGrid,
  minimalProductPage,
} from "@/website/content/_helpers";

export const corePages: MarketingPage[] = [
  definePage(
    "/team",
    "Teams",
    "Clauxen for teams — shared workspace with admin controls.",
    [
      hero(
        "Built for teams",
        "Shared projects, connectors, usage analytics, and SSO — so every teammate works in one secure workspace.",
      ),
      features(
        [
          {
            title: "Centralized admin",
            body: "Billing, seats, roles, and spend controls in one place.",
          },
          {
            title: "Company knowledge",
            body: "Connect Drive, Slack, GitHub, and more for grounded answers.",
          },
          {
            title: "Privacy by default",
            body: "Business data excluded from training by default.",
          },
        ],
        "Why teams switch",
      ),
      ctaBand("Start Clauxen Business"),
    ],
  ),
  definePage(
    "/enterprise",
    "Enterprise",
    "Clauxen Enterprise — security, compliance, and support at scale.",
    [
      hero(
        "Enterprise-grade Clauxen",
        "Deploy Chat, Work, and Codex with SCIM, EKM, data residency, SLAs, and dedicated support.",
        {
          primaryCta: CTA.contactSales,
          secondaryCta: { label: "See Business", href: "/business" },
        },
      ),
      bullets("Built for scale", [
        "Expanded context and large file support",
        "Role-based access, domain verification, and auditability",
        "Custom retention and encryption controls",
        "Data residency options",
        "24/7 priority support for eligible customers",
      ]),
      ctaBand("Talk to sales", undefined, CTA.contactSales),
    ],
  ),
  definePage(
    "/contact-sales",
    "Contact sales",
    "Talk to Clauxen about Business, Enterprise, and Education.",
    [
      hero(
        "Talk to sales",
        "Tell us about team size, security needs, and goals — we’ll recommend Business, Enterprise, or Edu.",
        {
          primaryCta: {
            label: "Email sales",
            href: "mailto:support@clauxen.com",
          },
          secondaryCta: CTA.viewPlans,
        },
      ),
      bullets("Good fit if you need", [
        "SSO, SCIM, or data residency",
        "Volume pricing or invoicing",
        "Campus or district rollout",
        "Custom legal terms and SLAs",
      ]),
      ctaBand("Or start self-serve", "Create a workspace in the app."),
    ],
  ),
  definePage(
    "/college-students",
    "Students",
    "Clauxen for college students — study, career, and everyday help.",
    [
      hero(
        "Get the most out of college",
        "Study partner, career guide, and everyday assistant — free to start.",
        { eyebrow: "Students" },
      ),
      features(
        [
          {
            title: "Study mode",
            body: "Step-by-step guidance, quizzes, and flashcards.",
          },
          {
            title: "Career prep",
            body: "Resumes, cover letters, and interview practice.",
          },
          {
            title: "Projects",
            body: "Keep courses and notes organized in one place.",
          },
        ],
        "Built for campus life",
      ),
      ctaBand("Try Clauxen free"),
    ],
  ),
  definePage(
    "/plans/k12-teachers",
    "Teachers",
    "Clauxen for K–12 teachers and school leaders.",
    [
      hero(
        "Built for teachers",
        "Personalize lessons, reclaim prep time, and collaborate in a secure workspace.",
        { eyebrow: "K–12" },
      ),
      features(
        [
          {
            title: "Classroom-ready",
            body: "Lesson planning, materials, and grading support.",
          },
          {
            title: "School admin",
            body: "Domain claim, SSO, and role-based access.",
          },
          {
            title: "Student data care",
            body: "Not used for training by default.",
          },
        ],
        "For schools",
      ),
      ctaBand("Get started for teachers"),
    ],
  ),
  definePage(
    "/customers",
    "Customers",
    "How teams use Clauxen.",
    [
      hero(
        "Trusted by modern teams",
        "From startups to enterprises — Clauxen helps people chat, ship code, and finish work faster.",
        {
          primaryCta: { label: "See solutions", href: "/solutions" },
          secondaryCta: CTA.contactSales,
        },
      ),
      linkGrid(
        [
          {
            title: "Engineering",
            body: "Faster reviews with Codex",
            href: "/solutions/coding",
          },
          {
            title: "Enterprise",
            body: "Secure rollout with controls",
            href: "/solutions/enterprise",
          },
          {
            title: "Education",
            body: "Campus AI with privacy",
            href: "/solutions/education",
          },
        ],
        "Stories by industry",
      ),
      ctaBand("Become a customer"),
    ],
  ),
  definePage(
    "/community",
    "Community",
    "Clauxen community — builders and ambassadors.",
    [
      hero(
        "Clauxen community",
        "Learn with other builders, share skills, and get early access to programs.",
        {
          secondaryCta: {
            label: "Ambassadors",
            href: "/community/ambassadors",
          },
        },
      ),
      features(
        [
          {
            title: "Ambassadors",
            body: "Represent Clauxen on campus and locally.",
          },
          {
            title: "Builders",
            body: "Ship skills and connectors on the marketplace.",
          },
          {
            title: "Office hours",
            body: "Live sessions with the product team.",
          },
        ],
        "Ways to join",
      ),
      ctaBand("Join in"),
    ],
  ),
  minimalProductPage({
    path: "/community/ambassadors",
    title: "Ambassadors",
    description: "Clauxen ambassador program.",
    headline: "Ambassador program",
    subtitle: "Host events, mentor builders, and help others get started.",
    points: [
      { title: "Host", body: "Run sessions in your community." },
      { title: "Mentor", body: "Help new users find their footing." },
      { title: "Early access", body: "See what’s coming next." },
    ],
  }),
];
