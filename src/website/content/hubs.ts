import type { MarketingPage } from "@/website/lib/types";
import { definePage } from "@/website/lib/types";
import {
  ctaBand,
  hero,
  linkGrid,
  minimalProductPage,
} from "@/website/content/_helpers";

/** Partners, platform, resources, and other hub pages — kept minimal. */
export const hubPages: MarketingPage[] = [
  definePage("/partners", "Partners", "Cloud and services partners for Clauxen.", [
    hero(
      "Partner with Clauxen",
      "Deploy on major clouds, integrate your product, or deliver services for customers.",
    ),
    linkGrid([
      { title: "Clauxen on AWS", body: "Deploy with AWS", href: "/partners/clauxen-on-aws" },
      { title: "Google Cloud", body: "GCP deployments", href: "/partners/google-cloud" },
      { title: "Microsoft Foundry", body: "Azure ecosystem", href: "/partners/microsoft-foundry" },
      { title: "Services", body: "Implementation partners", href: "/partners/services" },
      { title: "Powered by Clauxen", body: "ISV program", href: "/partners/powered-by-clauxen" },
    ]),
    ctaBand("Contact partnerships", "Email support@clauxen.com"),
  ]),
  ...[
    ["clauxen-on-aws", "Clauxen on AWS", "Deploy Clauxen with Amazon Web Services."],
    ["google-cloud", "Google Cloud", "Run Clauxen with GCP."],
    ["microsoft-foundry", "Microsoft Foundry", "Clauxen in the Azure ecosystem."],
    ["powered-by-clauxen", "Powered by Clauxen", "Build products on our platform."],
    ["services", "Services partners", "Implementation and consulting partners."],
  ].map(([slug, title, description]) =>
    minimalProductPage({
      path: `/partners/${slug}`,
      title,
      description,
      eyebrow: "Partners",
      headline: title,
      subtitle: description,
      points: [
        { title: "Deploy", body: "Run Clauxen where your stack already lives." },
        { title: "Integrate", body: "Connect products and workflows." },
        { title: "Support", body: "Work with Shirova AI on go-to-market." },
      ],
    }),
  ),

  definePage("/platform/api", "API", "Build on Clauxen’s platform APIs.", [
    hero(
      "API platform",
      "Build agents and apps on Clauxen inference and tooling.",
      {
        primaryCta: { label: "Open the app", href: "/login" },
        secondaryCta: { label: "Contact sales", href: "/contact-sales" },
      },
    ),
    ctaBand("Start building"),
  ]),
  definePage("/platform/marketplace", "Marketplace", "Skills, plugins, and partner apps.", [
    hero(
      "Marketplace",
      "Discover skills and plugins that extend Clauxen for your team.",
    ),
    linkGrid([
      { title: "Skills", body: "Specialized workflows", href: "/skills" },
      { title: "Plugins", body: "Work extensions", href: "/plugins" },
      { title: "Connectors", body: "Company tools", href: "/connectors" },
    ]),
    ctaBand("Browse in the app"),
  ]),

  definePage("/connectors", "Connectors", "Connect Clauxen to your tools.", [
    hero(
      "Connectors",
      "Ground answers in Drive, Slack, GitHub, Notion, and more — with admin controls on Business.",
    ),
    ctaBand("Open connectors", "Sign in → Customize → Connectors."),
  ]),
  definePage("/plugins", "Plugins", "Extend Clauxen Work with plugins.", [
    hero(
      "Plugins",
      "Package repeatable workflows for finance, legal, marketing, and ops.",
    ),
    ctaBand("Explore plugins"),
  ]),
  definePage("/skills", "Skills", "Teach Clauxen specialized workflows.", [
    hero(
      "Skills",
      "Bundle instructions, tools, and knowledge so Clauxen runs specialized jobs consistently.",
    ),
    ctaBand("Create a skill", "Customize → Skills in the app."),
  ]),
  definePage("/docs", "Docs", "Clauxen documentation hub.", [
    hero(
      "Documentation",
      "Product guides and platform references for builders and admins.",
    ),
    linkGrid([
      { title: "Tutorials", body: "Step-by-step", href: "/resources/tutorials" },
      { title: "Use cases", body: "By role", href: "/resources/use-cases" },
      { title: "API", body: "Platform", href: "/platform/api" },
    ]),
    ctaBand("Open Clauxen"),
  ]),
  definePage("/blog", "Blog", "Clauxen product news and stories.", [
    hero("Blog", "Announcements, how-we-built-it notes, and customer stories."),
    linkGrid([
      { title: "Announcements", body: "Launches", href: "/blog-category/announcements" },
      { title: "Agents", body: "Work & Codex", href: "/blog-category/agents" },
      { title: "Enterprise", body: "Security & rollout", href: "/blog-category/enterprise-ai" },
    ]),
    ctaBand("Follow updates"),
  ]),
  definePage("/ecosystem", "Ecosystem", "Partners and marketplace around Clauxen.", [
    hero("Ecosystem", "Partners, marketplace, and integrations around Clauxen."),
    linkGrid([
      { title: "Partners", body: "Cloud & services", href: "/partners" },
      { title: "Marketplace", body: "Skills & apps", href: "/platform/marketplace" },
    ]),
    ctaBand("Become a partner"),
  ]),
  definePage("/resources/use-cases", "Use cases", "Practical Clauxen patterns by role.", [
    hero("Use cases", "Practical patterns by role and industry."),
    linkGrid([
      { title: "Engineering", body: "Codex workflows", href: "/solutions/coding" },
      { title: "Finance", body: "Analysis", href: "/business/ai-for-finance" },
      { title: "Sales", body: "Pipeline", href: "/business/ai-for-sales-marketing" },
      { title: "Teachers", body: "Classroom", href: "/solutions/teachers" },
    ]),
    ctaBand("Try a workflow"),
  ]),
  definePage("/resources/tutorials", "Tutorials", "Step-by-step Clauxen tutorials.", [
    hero("Tutorials", "Short guides to get productive fast."),
    ctaBand("Open the app"),
  ]),
  definePage("/resources/courses", "Courses", "Structured learning for Clauxen.", [
    hero("Courses", "Structured paths for individuals and teams."),
    ctaBand("Start learning"),
  ]),

  ...[
    ["/programs/campus", "Campus", "Clauxen for universities and labs."],
    ["/programs/startups", "Startups", "Credits and support for early-stage teams."],
    ["/programs/clauxen-team-plan-for-research-labs", "Research labs", "Team plans for research groups."],
    ["/fast-mode", "Fast mode", "Lower-latency responses for everyday questions."],
    ["/healthcare-administration", "Healthcare admin", "Admin workflows for care organizations."],
    ["/import-memory", "Import memory", "Bring useful context into Clauxen."],
    ["/problem-solvers", "Problem solvers", "Stories of teams shipping with Clauxen."],
    ["/regional-compliance", "Regional compliance", "Data residency and regional controls."],
    ["/office-hours", "Office hours", "Live sessions with the Clauxen team."],
    ["/code-with-clauxen", "Code with Clauxen", "Events and workshops for builders."],
    ["/newsletter/developers", "Developer newsletter", "Updates for builders."],
    ["/custom-gpts", "Custom agents", "Specialized Clauxen agents for your workflows."],
    ["/100chats", "100 chats", "Curated example conversations."],
    ["/100chats-project", "100 chats project", "Real-world chat patterns."],
    ["/clauxen-for-chrome", "Chrome", "Use Clauxen beside any tab."],
    ["/clauxen-for-microsoft-365", "Microsoft 365", "Clauxen in Word, Excel, PowerPoint, Outlook."],
    ["/marketplace-contact-sales", "Marketplace sales", "Partner or list on the marketplace."],
    ["/marketplace-partners", "Marketplace partners", "ISVs on the Clauxen marketplace."],
    ["/app-unavailable-in-region", "Unavailable", "Clauxen may not be available in your region."],
    ["/unsubscribe", "Unsubscribe", "Manage email preferences."],
  ].map(([path, title, description]) =>
    minimalProductPage({
      path,
      title,
      description,
      headline: title,
      subtitle: description,
      points: [
        { title: "Simple by design", body: "One clear job per page — open Clauxen to go deeper." },
        { title: "Same account", body: "Web, desktop, and mobile stay in sync when signed in." },
        { title: "Need help?", body: "Email support@clauxen.com." },
      ],
    }),
  ),

  ...[
    "banking-analysts",
    "cowork-for-data",
    "cowork-for-finance",
    "cowork-for-legal",
    "cowork-for-marketing",
    "cowork-for-product",
    "cowork-for-sales",
  ].map((slug) =>
    minimalProductPage({
      path: `/lp/${slug}`,
      title: slug.replace(/-/g, " "),
      description: `Clauxen for ${slug.replace(/-/g, " ")}.`,
      eyebrow: "Use case",
      headline: slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      subtitle: "A focused Clauxen experience for your role — chat, Work, and connectors.",
      points: [
        { title: "Start from chat", body: "Ask in plain language." },
        { title: "Finish with Work", body: "Hand off goals when you need artifacts." },
        { title: "Connect tools", body: "Ground answers in your stack." },
      ],
    }),
  ),

  ...["clauxen-tag-teams-waitlist", "ema-waitlist", "mythos-access-interest"].map((slug) =>
    definePage(`/form/${slug}`, "Waitlist", "Register interest for upcoming Clauxen capabilities.", [
      hero(
        "Join the waitlist",
        "We’re expanding access gradually. Email us and we’ll follow up.",
        {
          primaryCta: { label: "Email us", href: "mailto:support@clauxen.com" },
          secondaryCta: { label: "Back to overview", href: "/overview" },
        },
      ),
    ]),
  ),

  ...["agents", "announcements", "clauxen-code", "enterprise-ai"].map((slug) =>
    definePage(`/blog-category/${slug}`, slug, `Clauxen blog · ${slug}`, [
      hero(`Category · ${slug}`, "Product news and deep dives from the Clauxen team."),
      ctaBand("Back to blog", undefined, { label: "Blog", href: "/blog" }),
    ]),
  ),
  ...["clauxen-cowork", "clauxen-design", "clauxen-enterprise", "clauxen-security", "clauxen-tag"].map(
    (slug) =>
      definePage(`/blog-product/${slug}`, slug, `Product notes · ${slug}`, [
        hero(slug.replace(/-/g, " "), "Product notes and launch posts."),
        ctaBand("See product overview", undefined, {
          label: "Products",
          href: "/product/overview",
        }),
      ]),
  ),
  ...["government", "legal", "sales", "startups"].map((slug) =>
    definePage(`/blog-usecases/${slug}`, slug, `Use cases · ${slug}`, [
      hero(`${slug} use cases`, "How teams apply Clauxen in the field."),
      ctaBand("Explore solutions", undefined, {
        label: "Solutions",
        href: "/solutions",
      }),
    ]),
  ),
];
