import type { Metadata } from "next";

export type PageSection =
  | {
      type: "hero";
      eyebrow?: string;
      title: string;
      subtitle: string;
      primaryCta?: { label: string; href: string };
      secondaryCta?: { label: string; href: string };
    }
  | {
      type: "features";
      title?: string;
      subtitle?: string;
      items: { title: string; body: string }[];
    }
  | {
      type: "bullets";
      title: string;
      items: string[];
    }
  | {
      type: "split";
      title: string;
      body: string;
      points?: string[];
      cta?: { label: string; href: string };
    }
  | {
      type: "cta";
      title: string;
      subtitle?: string;
      primaryCta: { label: string; href: string };
      secondaryCta?: { label: string; href: string };
    }
  | {
      type: "cards";
      title?: string;
      items: { title: string; body: string; href?: string }[];
    };

export type MarketingPage = {
  /** URL path without trailing slash, e.g. /overview */
  path: string;
  title: string;
  description: string;
  sections: PageSection[];
};

function page(
  path: string,
  title: string,
  description: string,
  sections: PageSection[],
): MarketingPage {
  return { path, title, description, sections };
}

function hero(
  title: string,
  subtitle: string,
  opts?: Partial<Extract<PageSection, { type: "hero" }>>,
): PageSection {
  return {
    type: "hero",
    title,
    subtitle,
    primaryCta: { label: "Try Clauxen", href: "/login" },
    secondaryCta: { label: "View plans", href: "/plans" },
    ...opts,
  };
}

function features(
  items: { title: string; body: string }[],
  title = "What you get",
): PageSection {
  return { type: "features", title, items };
}

function cta(
  title: string,
  subtitle?: string,
): PageSection {
  return {
    type: "cta",
    title,
    subtitle,
    primaryCta: { label: "Get started", href: "/login" },
    secondaryCta: { label: "Contact sales", href: "/contact-sales" },
  };
}

/** Union of Claude + ChatGPT-style main surfaces, adapted for Clauxen. */
export const MARKETING_PAGES: MarketingPage[] = [
  page(
    "/overview",
    "Clauxen overview",
    "Chat, work, and code in one AI workspace — built by Shirova AI.",
    [
      hero(
        "Chat, work & code in one place",
        "Clauxen is an AI workspace for individuals and teams. Start conversations, run agents, organize projects, and ship finished work — from the web and desktop.",
        { eyebrow: "Clauxen" },
      ),
      features([
        {
          title: "Chat",
          body: "Ask questions, draft messaging, search the web, generate images, and think through decisions with frontier models.",
        },
        {
          title: "Work",
          body: "Turn goals into docs, decks, spreadsheets, and analyses using your files, apps, and company context.",
        },
        {
          title: "Codex",
          body: "A coding agent alongside chat — plan, write, test, review, and ship across editor, terminal, and cloud.",
        },
      ]),
      {
        type: "cards",
        title: "Explore",
        items: [
          { title: "Plans", body: "Free through Enterprise", href: "/plans" },
          { title: "Business", body: "Secure workspace for teams", href: "/business" },
          { title: "Download", body: "Desktop and mobile apps", href: "/download" },
          { title: "Features", body: "Models, tools, and connectors", href: "/features" },
        ],
      },
      cta("Try Clauxen today", "Sign in to start a new chat in seconds."),
    ],
  ),

  page(
    "/plans",
    "Clauxen plans",
    "Free, Go, Plus, Pro, Business, and Enterprise plans for individuals and teams.",
    [
      hero(
        "Plans for every stage",
        "Start free. Upgrade when you need more usage, advanced models, Codex, Work, and admin controls.",
        {
          eyebrow: "Pricing",
          primaryCta: { label: "Start free", href: "/login" },
          secondaryCta: { label: "Business plans", href: "/business" },
        },
      ),
      {
        type: "cards",
        title: "Individuals",
        items: [
          {
            title: "Free",
            body: "Core chat, limited advanced model access, and essential tools to get started.",
            href: "/login",
          },
          {
            title: "Go & Plus",
            body: "More usage, longer memory, projects, custom skills, and expanded Codex.",
            href: "/login",
          },
          {
            title: "Pro",
            body: "Maximum research, coding, and image capacity for power users.",
            href: "/login",
          },
        ],
      },
      {
        type: "cards",
        title: "Organizations",
        items: [
          {
            title: "Business",
            body: "Shared workspace, SSO, connectors, analytics, and no training on business data by default.",
            href: "/business/business-plan",
          },
          {
            title: "Enterprise",
            body: "SCIM, EKM, data residency, SLAs, and priority support for scale.",
            href: "/business/enterprise",
          },
          {
            title: "Education",
            body: "Campus-wide AI for students, faculty, and research with admin controls.",
            href: "/business/education",
          },
        ],
      },
      cta("Compare plans in the app", "Sign in to manage billing and seats."),
    ],
  ),

  page(
    "/download",
    "Download Clauxen",
    "Get Clauxen for desktop and mobile — Work, Codex, and chat wherever you are.",
    [
      hero(
        "Download Clauxen",
        "Bring Clauxen to your desktop with Work and Codex, plus context from your screen, files, and apps. Chat on the go with mobile.",
        {
          eyebrow: "Apps",
          primaryCta: { label: "Open web app", href: "/login" },
          secondaryCta: { label: "View plans", href: "/plans" },
        },
      ),
      features(
        [
          {
            title: "Desktop",
            body: "macOS and Windows builds with local files, screenshots, and deeper Work workflows.",
          },
          {
            title: "Mobile",
            body: "iOS and Android for voice, images, and delegated Work tasks on the go.",
          },
          {
            title: "Web",
            body: "Full Clauxen in the browser at clauxen.com — no install required.",
          },
        ],
        "Available on",
      ),
      cta("Start on the web now"),
    ],
  ),

  page(
    "/features",
    "Clauxen features",
    "Models, memory, projects, connectors, canvas, agents, and more.",
    [
      hero(
        "Built for real work",
        "Everything from everyday chat to multi-step agents — with privacy controls for individuals and teams.",
      ),
      features([
        {
          title: "Advanced models",
          body: "Frontier reasoning for chat, analysis, coding, and creative work.",
        },
        {
          title: "Projects & memory",
          body: "Organize threads and files; keep useful context across conversations.",
        },
        {
          title: "Connectors & skills",
          body: "Plug into Drive, Slack, GitHub, and more — or package workflows as skills.",
        },
        {
          title: "Canvas",
          body: "Collaborate on documents and code in a dedicated side panel.",
        },
        {
          title: "Deep research",
          body: "Multi-step research with sources for reports and decisions.",
        },
        {
          title: "Image generation",
          body: "Create and iterate on visuals with thinking-aware generation.",
        },
      ]),
      {
        type: "cards",
        title: "Feature deep dives",
        items: [
          { title: "Work agent", body: "Goals to finished deliverables", href: "/features/agent" },
          { title: "Codex", body: "Coding agents", href: "/codex" },
          { title: "Canvas", body: "Docs and code side-by-side", href: "/canvas" },
        ],
      },
      cta("Explore features in the product"),
    ],
  ),

  page(
    "/features/agent",
    "Clauxen Work",
    "An agent that gathers context, plans, and produces polished deliverables.",
    [
      hero(
        "Introducing Clauxen Work",
        "Work brings together your apps, files, and browser context to create polished docs, decks, spreadsheets, and more — while you stay in control.",
        { eyebrow: "Agent" },
      ),
      features([
        {
          title: "From goals to finished work",
          body: "Give Work an outcome. It gathers context, makes a plan, and checks in when judgment matters.",
        },
        {
          title: "Work from anywhere",
          body: "Steer tasks on web and mobile; use desktop for local files and deeper workflows.",
        },
        {
          title: "Schedule and watch",
          body: "Recurring work and updates so projects keep moving without constant prompting.",
        },
      ]),
      cta("Try Work in Clauxen", "Available on supported plans."),
    ],
  ),

  page(
    "/work",
    "Clauxen Work for every team",
    "Turn scattered notes into finished work with company context and tools.",
    [
      hero(
        "Work for every team",
        "Clauxen Work uses your tools and approved business context to create share-ready deliverables and keep projects moving.",
      ),
      {
        type: "bullets",
        title: "Ways teams use Work",
        items: [
          "Sales — account plans and pipeline next steps",
          "Marketing — campaigns, briefs, and creative drafts",
          "Finance — forecasts, summaries, and board packs",
          "Engineering — specs, reviews, and release notes",
          "Operations — initiatives, metrics, and decision memos",
        ],
      },
      cta("Bring Work to your team", "Start with Business or Enterprise."),
    ],
  ),

  page(
    "/codex",
    "Clauxen Codex",
    "AI coding agents for software engineering — in chat, IDE, and CLI.",
    [
      hero(
        "Codex in Clauxen",
        "The same powerful coding agent across Chat, your editor, and the terminal — connected by your Clauxen account.",
        { eyebrow: "Coding" },
      ),
      features([
        {
          title: "End-to-end tasks",
          body: "Features, refactors, migrations, and tests — from understanding to shipping.",
        },
        {
          title: "Parallel agents",
          body: "Work across projects with cloud environments and review-ready changes.",
        },
        {
          title: "Enterprise controls",
          body: "Admin visibility, compliance, and secure workspace options on Business and Enterprise.",
        },
      ]),
      {
        type: "cards",
        items: [
          { title: "Codex pricing", body: "Included in Clauxen plans", href: "/codex/pricing" },
          { title: "Engineering solutions", body: "For software teams", href: "/business/ai-for-engineering" },
        ],
      },
      cta("Try Codex"),
    ],
  ),

  page(
    "/codex/pricing",
    "Codex pricing",
    "Codex is included in Clauxen Free through Enterprise — usage scales by plan.",
    [
      hero(
        "Codex pricing",
        "Codex ships with your Clauxen plan. Business and Enterprise unlock org-wide seats, credits, and admin controls.",
        {
          primaryCta: { label: "View all plans", href: "/plans" },
          secondaryCta: { label: "Contact sales", href: "/contact-sales" },
        },
      ),
      features([
        {
          title: "Individuals",
          body: "Free, Go, Plus, and Pro include Codex with plan-based usage limits and optional credits.",
        },
        {
          title: "Business",
          body: "Per-user workspace pricing with SSO, connectors, and flexible Codex seats.",
        },
        {
          title: "Enterprise",
          body: "Seat or usage models, Compliance API, data residency, and priority processing.",
        },
      ]),
      cta("Choose a plan"),
    ],
  ),

  page(
    "/canvas",
    "Clauxen Canvas",
    "A dedicated surface for collaborating on documents and code with Clauxen.",
    [
      hero(
        "Canvas",
        "Open a side panel to draft, edit, version, and refine documents or code — without losing the chat thread.",
      ),
      features([
        {
          title: "Targeted edits",
          body: "Select passages or functions and ask Clauxen to revise in place.",
        },
        {
          title: "Versioning",
          body: "Iterate safely and compare changes as the draft evolves.",
        },
        {
          title: "Run code",
          body: "Execute Python and inspect results alongside the conversation.",
        },
      ]),
      cta("Open Canvas in chat"),
    ],
  ),

  page(
    "/atlas",
    "Clauxen Atlas",
    "A browser experience with Clauxen built in — research and act without leaving the page.",
    [
      hero(
        "Clauxen Atlas",
        "Browse with Clauxen beside you — understand the page you’re on, remember useful context, and complete tasks without copy-paste.",
        { eyebrow: "Browser" },
      ),
      features([
        {
          title: "In-page assistance",
          body: "Ask about what you see and get help in a side panel.",
        },
        {
          title: "Agent mode",
          body: "Let Clauxen take multi-step actions across the web when you approve.",
        },
        {
          title: "Memory",
          body: "Carry relevant chat context into browsing when enabled.",
        },
      ]),
      cta("Learn about Atlas", "Rolling out on supported platforms."),
    ],
  ),

  page(
    "/team",
    "Clauxen for teams",
    "A secure shared workspace with admin controls for growing companies.",
    [
      hero(
        "Built for teams",
        "Shared projects, connectors, usage analytics, and SSO — so every teammate works in one secure workspace.",
      ),
      features([
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
      ]),
      cta("Start Clauxen Business", undefined),
    ],
  ),

  page(
    "/enterprise",
    "Clauxen Enterprise",
    "Enterprise-grade AI, security, and support for organizations at scale.",
    [
      hero(
        "Enterprise-grade Clauxen",
        "Deploy Chat, Work, and Codex with SCIM, EKM, data residency, SLAs, and dedicated support.",
        {
          primaryCta: { label: "Contact sales", href: "/contact-sales" },
          secondaryCta: { label: "See Business", href: "/business" },
        },
      ),
      {
        type: "bullets",
        title: "Built for scale",
        items: [
          "Expanded context and large file support",
          "Role-based access, domain verification, and auditability",
          "Custom retention and encryption controls",
          "Data residency options",
          "24/7 priority support and AI advisors for eligible customers",
        ],
      },
      cta("Talk to sales", "We’ll help you design the right rollout."),
    ],
  ),

  page(
    "/business",
    "Clauxen Business",
    "Secure workspace with admin controls and apps for your company tools.",
    [
      hero(
        "Clauxen for business",
        "The fastest way to put Clauxen to work — shared workspace, SSO, connectors, and no training on your business data by default.",
        { eyebrow: "Business" },
      ),
      features([
        {
          title: "Work & Codex",
          body: "Finish deliverables and ship code with company context and admin oversight.",
        },
        {
          title: "60+ apps",
          body: "Bring Slack, Drive, SharePoint, GitHub, Linear, Figma, and more into chat.",
        },
        {
          title: "Simple to manage",
          body: "Predictable per-user pricing with optional credits for power users.",
        },
      ]),
      {
        type: "cards",
        title: "Solutions by team",
        items: [
          { title: "Engineering", href: "/business/ai-for-engineering", body: "Plan, code, and deploy" },
          { title: "Finance", href: "/business/ai-for-finance", body: "Analyze and forecast" },
          { title: "Sales & marketing", href: "/business/ai-for-sales-marketing", body: "Pipeline and campaigns" },
          { title: "Education", href: "/business/education", body: "Campus-wide AI" },
          { title: "Enterprise", href: "/business/enterprise", body: "Security at scale" },
          { title: "Business plan", href: "/business/business-plan", body: "Plan details" },
        ],
      },
      cta("Try Clauxen Business"),
    ],
  ),

  page(
    "/business/business-plan",
    "Clauxen Business plan",
    "Shared workspace, admin console, SSO, and connectors for growing companies.",
    [
      hero(
        "Business plan details",
        "Unlimited access to flagship models within plan guardrails, Work, Codex seats, and essential admin controls.",
      ),
      {
        type: "bullets",
        title: "Includes",
        items: [
          "Dedicated workspace and admin console",
          "SAML SSO and MFA",
          "Connectors to company tools",
          "Usage analytics and spend controls",
          "No training on business data by default",
          "Encryption in transit and at rest",
        ],
      },
      cta("Get Business"),
    ],
  ),

  page(
    "/business/enterprise",
    "Clauxen Enterprise",
    "Frontier AI with enterprise security, compliance, and support.",
    [
      hero(
        "Frontier AI for enterprise",
        "Help every team turn goals into finished work with the controls you need to scale responsibly.",
        { primaryCta: { label: "Contact sales", href: "/contact-sales" } },
      ),
      features([
        {
          title: "Security & compliance",
          body: "SCIM, EKM, Compliance API visibility, and custom retention policies.",
        },
        {
          title: "Work & Codex at scale",
          body: "Agentic workflows across docs and codebases with governance.",
        },
        {
          title: "Success",
          body: "Playbooks, analytics, training, and AI advisors for eligible customers.",
        },
      ]),
      cta("Contact sales"),
    ],
  ),

  page(
    "/business/education",
    "Clauxen Education",
    "Bring AI to campus at scale for students, faculty, and research.",
    [
      hero(
        "Clauxen Edu",
        "An accessible option for universities to deploy AI with higher limits, admin controls, and strong privacy commitments.",
        { primaryCta: { label: "Contact sales", href: "/contact-sales" } },
      ),
      features([
        {
          title: "Campus-wide access",
          body: "Students, faculty, researchers, and campus operations in one workspace.",
        },
        {
          title: "Admin controls",
          body: "SSO, SCIM, GPT management, and analytics for IT.",
        },
        {
          title: "Privacy",
          body: "No training on education data by default; certified controls.",
        },
      ]),
      cta("Talk to our education team"),
    ],
  ),

  page(
    "/business/ai-for-engineering",
    "Clauxen for engineering",
    "Plan smarter, code efficiently, and deploy reliably in a secure workspace.",
    [
      hero(
        "Clauxen for engineering",
        "Accelerate development with Codex, shared projects, and apps tied into GitHub, GitLab, Linear, and Azure DevOps.",
      ),
      features([
        { title: "Codex agent", body: "Write, debug, and ship with review-ready changes." },
        { title: "Aligned teams", body: "Research, specs, and status in Slack and Notion." },
        { title: "Protected code", body: "Enterprise identity and access controls." },
      ]),
      cta("Start for engineering"),
    ],
  ),

  page(
    "/business/ai-for-finance",
    "Clauxen for finance",
    "Analyze statements, forecast, and report in a secure shared workspace.",
    [
      hero(
        "Clauxen for finance",
        "Keep analysis consistent, collaborate faster, and protect sensitive information — all in one workspace.",
      ),
      features([
        { title: "Instant analysis", body: "KPIs, cash flow, and filings in seconds." },
        { title: "Connected tools", body: "Pull from Drive, Slack, and finance systems." },
        { title: "Compliant by design", body: "SSO, roles, and no training on business data by default." },
      ]),
      cta("Start for finance"),
    ],
  ),

  page(
    "/business/ai-for-sales-marketing",
    "Clauxen for sales & marketing",
    "Collaborate on campaigns, pitches, and pipeline with secure company context.",
    [
      hero(
        "Sales & marketing",
        "Save time on writing, research, and campaign analysis while keeping brand and customer data protected.",
      ),
      features([
        { title: "Campaigns", body: "Draft, edit, and analyze with Canvas and connectors." },
        { title: "Pipeline", body: "Synthesize CRM context into next steps." },
        { title: "Brand control", body: "SSO and roles for agencies and regional teams." },
      ]),
      cta("Start for GTM teams"),
    ],
  ),

  page(
    "/college-students",
    "Clauxen for students",
    "Study partner, career guide, and everyday assistant for college life.",
    [
      hero(
        "Get the most out of college",
        "Use Clauxen for studying, interview prep, writing, and organizing class projects.",
        { eyebrow: "Students" },
      ),
      features([
        { title: "Study mode", body: "Step-by-step guidance, quizzes, and flashcards." },
        { title: "Career prep", body: "Resumes, cover letters, and interview practice." },
        { title: "Projects", body: "Keep courses and notes organized in one place." },
      ]),
      cta("Try Clauxen free"),
    ],
  ),

  page(
    "/plans/k12-teachers",
    "Clauxen for teachers",
    "Secure workspace for K–12 teachers and school leaders.",
    [
      hero(
        "Built for teachers",
        "Personalize lessons, reclaim prep time, and collaborate in a secure Clauxen workspace designed for schools.",
        { eyebrow: "K–12" },
      ),
      features([
        { title: "Classroom-ready", body: "Lesson planning, materials, and grading support." },
        { title: "School admin", body: "Domain claim, SSO, and role-based access." },
        { title: "Student data care", body: "Not used for training by default; FERPA-minded controls." },
      ]),
      cta("Get started for teachers"),
    ],
  ),

  page(
    "/contact-sales",
    "Contact sales",
    "Talk to Clauxen about Business, Enterprise, and Education deployments.",
    [
      hero(
        "Talk to sales",
        "Tell us about your team size, security requirements, and goals — we’ll recommend Business, Enterprise, or Edu.",
        {
          primaryCta: { label: "Email sales", href: "mailto:support@clauxen.com" },
          secondaryCta: { label: "View plans", href: "/plans" },
        },
      ),
      {
        type: "bullets",
        title: "Good fit if you need",
        items: [
          "SSO, SCIM, or data residency",
          "Volume pricing or invoicing",
          "Campus or district rollout",
          "Custom legal terms and SLAs",
        ],
      },
      cta("Or start self-serve", "Create a Business workspace in the app."),
    ],
  ),

  page(
    "/customers",
    "Customers",
    "How teams use Clauxen across engineering, ops, and knowledge work.",
    [
      hero(
        "Trusted by modern teams",
        "From startups to enterprises — Clauxen helps people chat, ship code, and finish work faster.",
        { primaryCta: { label: "Read solutions", href: "/solutions" }, secondaryCta: { label: "Contact sales", href: "/contact-sales" } },
      ),
      {
        type: "cards",
        items: [
          { title: "Engineering", body: "Faster reviews and migrations with Codex", href: "/solutions/coding" },
          { title: "Enterprise", body: "Secure rollout with admin controls", href: "/solutions/enterprise" },
          { title: "Education", body: "Campus AI with privacy controls", href: "/solutions/education" },
        ],
      },
      cta("Become a customer"),
    ],
  ),

  page(
    "/community",
    "Community",
    "Builders, ambassadors, and creators around Clauxen.",
    [
      hero(
        "Clauxen community",
        "Learn with other builders, share skills, and get early access to programs.",
        { secondaryCta: { label: "Ambassadors", href: "/community/ambassadors" } },
      ),
      features([
        { title: "Ambassadors", body: "Represent Clauxen on campus and in local communities." },
        { title: "Builders", body: "Ship skills, connectors, and demos on the marketplace." },
        { title: "Office hours", body: "Live sessions with the product team.", },
      ]),
      cta("Join the conversation"),
    ],
  ),

  page(
    "/community/ambassadors",
    "Ambassadors",
    "Represent Clauxen in your community.",
    [
      hero(
        "Ambassador program",
        "Host events, mentor builders, and help others get started with Clauxen.",
        { primaryCta: { label: "Apply", href: "/contact-sales" } },
      ),
      cta("Apply to become an ambassador"),
    ],
  ),

  page(
    "/connectors",
    "Connectors",
    "Connect Clauxen to the tools your team already uses.",
    [
      hero(
        "Connectors directory",
        "Ground answers in Drive, Slack, GitHub, Notion, and dozens more — with admin controls on Business plans.",
      ),
      features([
        { title: "Company knowledge", body: "Retrieve from approved sources in chat." },
        { title: "Admin governance", body: "Control which connectors are available." },
        { title: "Personal productivity", body: "Link the apps you use every day." },
      ]),
      cta("Browse connectors in the app", "Sign in → Customize → Connectors."),
    ],
  ),

  page(
    "/plugins",
    "Plugins",
    "Extend Clauxen with plugins for Work and team workflows.",
    [
      hero(
        "Plugins",
        "Package repeatable workflows for finance, legal, marketing, and ops — share them across your workspace.",
      ),
      cta("Explore plugins in Clauxen"),
    ],
  ),

  page(
    "/skills",
    "Skills",
    "Teach Clauxen specialized workflows with skills.",
    [
      hero(
        "Skills",
        "Bundle instructions, tools, and knowledge so Clauxen can run specialized jobs consistently.",
      ),
      features([
        { title: "Personal skills", body: "Codify how you like to write, research, and review." },
        { title: "Team skills", body: "Share brand, legal, and ops playbooks." },
        { title: "Marketplace", body: "Discover skills from partners and the community.", },
      ]),
      cta("Create a skill", "Customize → Skills in the app."),
    ],
  ),

  page(
    "/docs",
    "Documentation",
    "Guides for Clauxen chat, API, connectors, and admin.",
    [
      hero(
        "Clauxen docs",
        "Product guides and platform references to help you build and administer Clauxen.",
        {
          primaryCta: { label: "Open the app", href: "/login" },
          secondaryCta: { label: "API platform", href: "/platform/api" },
        },
      ),
      {
        type: "cards",
        items: [
          { title: "Tutorials", href: "/resources/tutorials", body: "Step-by-step product guides" },
          { title: "Use cases", href: "/resources/use-cases", body: "Patterns by role" },
          { title: "API", href: "/platform/api", body: "Platform and inference" },
        ],
      },
      cta("Start building"),
    ],
  ),

  page(
    "/blog",
    "Blog",
    "Product news, research, and stories from Clauxen.",
    [
      hero(
        "Clauxen blog",
        "Announcements, how-we-built-it notes, and customer stories.",
        { secondaryCta: { label: "Product updates", href: "/blog-product/clauxen-work" } },
      ),
      {
        type: "cards",
        title: "Categories",
        items: [
          { title: "Announcements", href: "/blog-category/announcements", body: "Launches and milestones" },
          { title: "Agents", href: "/blog-category/agents", body: "Work, Codex, and automation" },
          { title: "Enterprise AI", href: "/blog-category/enterprise-ai", body: "Security and rollout" },
          { title: "Clauxen Code", href: "/blog-category/clauxen-code", body: "Developer workflows" },
        ],
      },
      cta("Follow product updates"),
    ],
  ),

  page(
    "/ecosystem",
    "Ecosystem",
    "Partners, marketplace, and integrations around Clauxen.",
    [
      hero(
        "Clauxen ecosystem",
        "Cloud partners, ISVs, and service firms helping teams adopt Clauxen.",
      ),
      {
        type: "cards",
        items: [
          { title: "Partners", href: "/partners", body: "Cloud and services" },
          { title: "Marketplace", href: "/platform/marketplace", body: "Skills and apps" },
          { title: "Powered by Clauxen", href: "/partners/powered-by-clauxen", body: "Build on our platform" },
        ],
      },
      cta("Become a partner", undefined),
    ],
  ),

  page(
    "/fast-mode",
    "Fast mode",
    "Lower-latency responses when you need quick answers.",
    [
      hero(
        "Fast mode",
        "Prioritize speed for everyday questions while keeping deeper reasoning available when you need it.",
      ),
      cta("Try it in chat"),
    ],
  ),

  page(
    "/partners",
    "Partners",
    "Cloud, services, and technology partners for Clauxen.",
    [
      hero(
        "Partner with Clauxen",
        "Deploy on major clouds, integrate your product, or deliver services for customers.",
      ),
      {
        type: "cards",
        items: [
          { title: "Clauxen on AWS", href: "/partners/clauxen-on-aws", body: "Deploy with AWS" },
          { title: "Google Cloud", href: "/partners/google-cloud", body: "GCP deployments" },
          { title: "Microsoft Foundry", href: "/partners/microsoft-foundry", body: "Azure ecosystem" },
          { title: "Services", href: "/partners/services", body: "Implementation partners" },
          { title: "Powered by Clauxen", href: "/partners/powered-by-clauxen", body: "ISV program" },
        ],
      },
      cta("Contact partnerships", "Email support@clauxen.com"),
    ],
  ),

  // Product pages (Claude-style)
  ...[
    ["overview", "Product overview", "The Clauxen workspace for chat, agents, and tools."],
    ["cowork", "Clauxen Work", "Agentic work from goals to deliverables."],
    ["design", "Clauxen Design", "Stay on-brand for everyday creative work."],
    ["tag", "Clauxen Tag", "Organize and retrieve knowledge across teams."],
    ["clauxen-security", "Clauxen Security", "Security product capabilities and controls."],
    ["clauxen-science", "Clauxen Science", "Research and scientific workflows."],
  ].map(([slug, title, description]) =>
    page(`/product/${slug}`, title, description, [
      hero(title, description, { eyebrow: "Product" }),
      features([
        { title: "Built into Clauxen", body: "Available where you already chat and collaborate." },
        { title: "Team-ready", body: "Works with Business and Enterprise admin controls." },
        { title: "Extensible", body: "Combine with skills, connectors, and Codex." },
      ]),
      cta("Open Clauxen"),
    ]),
  ),

  // Solutions
  ...[
    ["agents", "Agents", "Deploy agentic workflows across your organization."],
    ["coding", "Coding", "Ship software faster with Codex and chat."],
    ["code-modernization", "Code modernization", "Migrate and refactor large codebases."],
    ["customer-support", "Customer support", "Assist agents with grounded answers."],
    ["cybersecurity", "Cybersecurity", "Accelerate reviews and investigations."],
    ["education", "Education", "Teaching, learning, and campus operations."],
    ["enterprise", "Enterprise", "Secure AI at organizational scale."],
    ["financial-services", "Financial services", "Analysis and reporting with controls."],
    ["government", "Government", "Public-sector ready deployments."],
    ["healthcare", "Healthcare", "Clinical and admin workflows with privacy."],
    ["legal", "Legal", "Research, drafting, and review assistance."],
    ["life-sciences", "Life sciences", "R&D and documentation support."],
    ["nonprofits", "Nonprofits", "Do more with lean teams."],
    ["small-business", "Small business", "AI workspace for growing companies."],
    ["teachers", "Teachers", "Lesson planning and school collaboration."],
  ].map(([slug, title, description]) =>
    page(`/solutions/${slug}`, `Clauxen for ${title.toLowerCase()}`, description, [
      hero(`Solutions: ${title}`, description, { eyebrow: "Solutions" }),
      features([
        { title: "Tailored workflows", body: `Patterns and prompts tuned for ${title.toLowerCase()}.` },
        { title: "Secure by default", body: "Business and Enterprise privacy controls." },
        { title: "Integrate your stack", body: "Connectors for the tools you already use." },
      ]),
      cta("Explore Clauxen"),
    ]),
  ),

  page(
    "/solutions",
    "Solutions",
    "Clauxen by industry and use case.",
    [
      hero(
        "Solutions",
        "See how teams apply Clauxen across coding, support, education, healthcare, and more.",
      ),
      {
        type: "cards",
        items: [
          { title: "Enterprise", href: "/solutions/enterprise", body: "Scale with controls" },
          { title: "Coding", href: "/solutions/coding", body: "Codex for engineers" },
          { title: "Education", href: "/solutions/education", body: "Campus and classroom" },
          { title: "Healthcare", href: "/solutions/healthcare", body: "Care and admin" },
          { title: "Legal", href: "/solutions/legal", body: "Research and drafting" },
          { title: "Financial services", href: "/solutions/financial-services", body: "Analysis with guardrails" },
        ],
      },
      cta("Talk to sales"),
    ],
  ),

  // Platform, programs, resources, partners subpages, LPs, forms, blog tags
  ...[
    ["/platform/api", "API platform", "Build on Clauxen’s inference and agent APIs."],
    ["/platform/marketplace", "Marketplace", "Skills, plugins, and partner apps."],
    ["/programs/campus", "Campus program", "Clauxen for universities and labs."],
    ["/programs/startups", "Startups", "Credits and support for early-stage teams."],
    ["/programs/clauxen-team-plan-for-research-labs", "Research labs", "Team plans for research groups."],
    ["/resources/courses", "Courses", "Structured learning paths for Clauxen."],
    ["/resources/tutorials", "Tutorials", "Step-by-step product tutorials."],
    ["/resources/use-cases", "Use cases", "Practical patterns by role and industry."],
    ["/partners/clauxen-on-aws", "Clauxen on AWS", "Deploy with Amazon Web Services."],
    ["/partners/google-cloud", "Google Cloud", "Run Clauxen with GCP."],
    ["/partners/microsoft-foundry", "Microsoft Foundry", "Clauxen in the Azure ecosystem."],
    ["/partners/powered-by-clauxen", "Powered by Clauxen", "Build products on our platform."],
    ["/partners/services", "Services partners", "Implementation and consulting partners."],
    ["/healthcare-administration", "Healthcare administration", "Admin workflows for care organizations."],
    ["/import-memory", "Import memory", "Bring useful context into Clauxen."],
    ["/problem-solvers", "Problem solvers", "Stories of teams shipping with Clauxen."],
    ["/regional-compliance", "Regional compliance", "Data residency and regional controls."],
    ["/office-hours", "Office hours", "Live sessions with the Clauxen team."],
    ["/code-with-clauxen", "Code with Clauxen", "Events and workshops for builders."],
    ["/newsletter/developers", "Developer newsletter", "Updates for builders on the Clauxen platform."],
    ["/custom-gpts", "Custom agents", "Create specialized Clauxen agents for your workflows."],
    ["/100chats", "100 chats", "Curated example conversations to learn from."],
    ["/100chats-project", "100 chats project", "A collection of real-world chat patterns."],
    ["/clauxen-for-chrome", "Clauxen for Chrome", "Use Clauxen beside any tab in Chrome."],
    ["/clauxen-for-microsoft-365", "Clauxen for Microsoft 365", "Bring Clauxen into Word, Excel, PowerPoint, and Outlook."],
    ["/marketplace-contact-sales", "Marketplace sales", "Partner or list on the Clauxen marketplace."],
    ["/marketplace-partners", "Marketplace partners", "ISVs and publishers on the Clauxen marketplace."],
    ["/solutions/life-sciences/ai-adoption-index", "Life sciences AI adoption", "Index and insights for AI adoption in life sciences."],
  ].map(([path, title, description]) =>
    page(path, title, description, [
      hero(title, description),
      cta("Continue in Clauxen"),
    ]),
  ),

  // Landing pages (Claude LP equivalents)
  ...[
    "banking-analysts",
    "cowork-for-data",
    "cowork-for-finance",
    "cowork-for-legal",
    "cowork-for-marketing",
    "cowork-for-product",
    "cowork-for-sales",
  ].map((slug) =>
    page(
      `/lp/${slug}`,
      `Clauxen for ${slug.replace(/-/g, " ")}`,
      `Landing page for ${slug.replace(/-/g, " ")} workflows.`,
      [
        hero(
          slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          "A focused Clauxen experience for your role — chat, Work, and connectors included.",
          { eyebrow: "Use case" },
        ),
        cta("Try this workflow"),
      ],
    ),
  ),

  // Forms / waitlists
  ...["clauxen-tag-teams-waitlist", "ema-waitlist", "mythos-access-interest"].map((slug) =>
    page(`/form/${slug}`, "Join the waitlist", "Register interest for upcoming Clauxen capabilities.", [
      hero("Join the waitlist", "We’re expanding access gradually. Leave your interest and we’ll follow up.", {
        primaryCta: { label: "Email us", href: "mailto:support@clauxen.com" },
        secondaryCta: { label: "Back to overview", href: "/overview" },
      }),
    ]),
  ),

  // Blog taxonomy hubs
  ...["agents", "announcements", "clauxen-code", "enterprise-ai"].map((slug) =>
    page(`/blog-category/${slug}`, `Blog: ${slug}`, `Posts in the ${slug} category.`, [
      hero(`Category · ${slug}`, "Product news and deep dives from the Clauxen team."),
      cta("Read the blog", undefined),
    ]),
  ),
  ...["clauxen-cowork", "clauxen-design", "clauxen-enterprise", "clauxen-security", "clauxen-tag"].map(
    (slug) =>
      page(`/blog-product/${slug}`, `Product · ${slug}`, `Updates related to ${slug}.`, [
        hero(slug.replace(/-/g, " "), "Product notes and launch posts."),
        cta("See product overview"),
      ]),
  ),
  ...["government", "legal", "sales", "startups"].map((slug) =>
    page(`/blog-usecases/${slug}`, `Use cases · ${slug}`, `Stories for ${slug}.`, [
      hero(`${slug} use cases`, "How teams apply Clauxen in the field."),
      cta("Explore solutions"),
    ]),
  ),

  page(
    "/app-unavailable-in-region",
    "Unavailable in your region",
    "Clauxen may not be available where you are.",
    [
      hero(
        "Clauxen isn’t available in your region",
        "We’re expanding access carefully. Check back later or contact support if you believe this is an error.",
        {
          primaryCta: { label: "Contact support", href: "mailto:support@clauxen.com" },
          secondaryCta: { label: "About Clauxen", href: "/about" },
        },
      ),
    ],
  ),

  page(
    "/unsubscribe",
    "Unsubscribe",
    "Manage email preferences.",
    [
      hero(
        "Email preferences",
        "To unsubscribe from Clauxen emails, use the link in any message or contact support@clauxen.com.",
        { primaryCta: { label: "Email support", href: "mailto:support@clauxen.com" } },
      ),
    ],
  ),
];

const byPath = new Map(MARKETING_PAGES.map((p) => [p.path, p]));

export function getMarketingPage(path: string): MarketingPage | undefined {
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return byPath.get(normalized.startsWith("/") ? normalized : `/${normalized}`);
}

export function allMarketingPaths(): string[] {
  return MARKETING_PAGES.map((p) => p.path);
}

export function metadataForPage(path: string): Metadata {
  const p = getMarketingPage(path);
  if (!p) {
    return { title: "Clauxen" };
  }
  return {
    title: p.title,
    description: p.description,
  };
}
