import {
  formatInr,
  PLAN_MONTHLY_PRICES_INR,
  BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
} from "@/lib/plans-catalog";
import { definePage } from "@/marketing/lib/types";
import { CTA, ctaBand, faq, hero } from "@/marketing/content/_helpers";

/** /plans — individual cards + organization cards + FAQ. */
export const plansPage = definePage(
  "/plans",
  "Plans",
  "Clauxen plans for individuals and teams — Free, Go, Plus, Pro, Business, and Enterprise.",
  [
    hero(
      "Pricing",
      "Start free. Upgrade when you need more usage, Work, Codex, and admin controls.",
      {
        primaryCta: CTA.startFree,
        secondaryCta: CTA.contactSales,
      },
    ),
    {
      type: "plans",
      title: "Individual",
      items: [
        {
          name: "Free",
          price: formatInr(PLAN_MONTHLY_PRICES_INR.free),
          blurb: "Try Clauxen",
          features: [
            "Chat on web",
            "Write, edit, and create",
            "Basic coding help",
            "Web search when available",
          ],
          cta: CTA.startFree,
        },
        {
          name: "Go",
          price: `${formatInr(PLAN_MONTHLY_PRICES_INR.go)}/mo`,
          blurb: "Everyday productivity",
          features: [
            "Everything in Free",
            "More usage",
            "Longer conversations",
            "Expanded memory",
          ],
          cta: CTA.tryApp,
        },
        {
          name: "Plus",
          price: `${formatInr(PLAN_MONTHLY_PRICES_INR.plus)}/mo`,
          blurb: "Advanced work",
          highlight: true,
          features: [
            "Everything in Go",
            "Work and Codex access",
            "Projects and skills",
            "Expanded research and models",
          ],
          cta: CTA.tryApp,
        },
        {
          name: "Pro",
          price: `${formatInr(PLAN_MONTHLY_PRICES_INR.pro)}/mo`,
          blurb: "Power users",
          features: [
            "Everything in Plus",
            "Maximum research and coding capacity",
            "Higher output limits",
            "Priority when demand is high",
          ],
          cta: CTA.tryApp,
        },
      ],
    },
    {
      type: "plans",
      title: "Team & Enterprise",
      subtitle: "Shared workspace, SSO, and company connectors.",
      items: [
        {
          name: "Business",
          price: `From ${formatInr(BUSINESS_WORKSPACE_SEAT_MONTHLY_INR)}/user/mo`,
          blurb: "Growing teams",
          features: [
            "Shared workspace and admin console",
            "SSO and MFA",
            "Connectors to company tools",
            "No training on business data by default",
          ],
          cta: { label: "Get Business", href: "/business" },
        },
        {
          name: "Enterprise",
          price: "Custom",
          blurb: "Organizations at scale",
          features: [
            "SCIM, EKM, and advanced controls",
            "Data residency options",
            "SLAs and priority support",
            "Invoicing and volume terms",
          ],
          cta: CTA.contactSales,
        },
      ],
    },
    faq([
      {
        q: "Do I need a paid plan for the apps?",
        a: "No. The web app is available on Free. Work, Codex depth, and higher limits unlock on paid plans.",
      },
      {
        q: "Can I use the same account on web and desktop?",
        a: "Yes. Conversations, projects, and preferences sync when you’re signed in.",
      },
      {
        q: "How does Business pricing work?",
        a: "Business is priced per user per month with optional credits for power users. Contact sales for Enterprise.",
      },
    ]),
    ctaBand("Compare in the product", "Sign in to manage billing and seats."),
  ],
);
