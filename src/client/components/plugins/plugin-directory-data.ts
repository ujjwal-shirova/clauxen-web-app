export type DirectoryPlugin = {
  name: string;
  description: string;
};

export type PluginSection = {
  title: string;
  plugins: DirectoryPlugin[];
  more: string[];
};

export type PluginCategory = {
  slug: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  plugins: DirectoryPlugin[];
};

export const INITIAL_INSTALLED_PLUGINS = [
  "Hostinger Mail",
  "Higgsfield",
  "Cloudflare",
  "Data Analytics",
  "Documents",
  "GitHub",
  "Hugging Face",
  "Notion",
  "Default templates",
  "PDF",
  "Plugin Management",
  "Presentations",
  "Razorpay",
  "Spreadsheets",
  "Supabase",
  "Superhuman Mail",
  "Template Creator",
  "Vercel",
] as const;

export const PLUGIN_SECTIONS: PluginSection[] = [
  {
    title: "Popular",
    plugins: [
      { name: "Gmail", description: "Read and manage Gmail" },
      {
        name: "GitHub",
        description: "Triage PRs, issues, CI, and publish flows",
      },
      {
        name: "Google Drive",
        description: "Work across Drive, Docs, Sheets, and Slides",
      },
      { name: "Google Calendar", description: "Manage Google Calendar events" },
      {
        name: "Notion",
        description: "Workflows for specs, research, meetings, and knowledge",
      },
      { name: "Slack", description: "Read and manage Slack" },
    ],
    more: ["Outlook Email", "Granola", "Fireflies"],
  },
  {
    title: "Productivity",
    plugins: [
      { name: "Granola", description: "Add your meeting context" },
      { name: "Fireflies", description: "Search meeting transcripts" },
      { name: "Outlook Calendar", description: "Manage Outlook schedules" },
      { name: "Plaud", description: "Retrieve insights from Plaud" },
      { name: "Otter.ai", description: "Search meetings from Otter.ai" },
      { name: "Atlassian Rovo", description: "Manage Jira and Confluence" },
    ],
    more: ["Linear", "monday.com", "Spreadsheets"],
  },
  {
    title: "Creativity",
    plugins: [
      { name: "Canva", description: "Create, review, and edit designs" },
      { name: "Higgsfield", description: "Every image and video model" },
      { name: "Product Design", description: "Explore and prototype ideas" },
      { name: "Figma", description: "Design-to-code workflows" },
      { name: "Magnific", description: "Create images, video, and designs" },
      { name: "HeyGen", description: "Create AI videos" },
    ],
    more: ["Mobbin", "Runway", "B12 Website Generator"],
  },
  {
    title: "Developer Tools",
    plugins: [
      { name: "Datadog (Preview)", description: "Search and act on your data" },
      { name: "Supabase", description: "Manage and query databases" },
      { name: "Vercel", description: "Build and deploy web apps and agents" },
      { name: "Exa", description: "Web search for AI agents" },
      { name: "Neon Postgres", description: "Manage Neon Postgres databases" },
      {
        name: "Devpost Hackathons",
        description: "Find and submit to hackathons",
      },
    ],
    more: ["Context7", "Base44", "Resend"],
  },
  {
    title: "Business & Operations",
    plugins: [
      { name: "Shopify", description: "Build and manage your store" },
      { name: "Zoho CRM", description: "Automate sales operations" },
      { name: "HubSpot", description: "Turn insights into action in HubSpot" },
      { name: "Apollo.io", description: "Find buyers and close deals" },
      { name: "Webflow", description: "Manage Webflow sites" },
      { name: "ZoomInfo", description: "B2B data and GTM intelligence" },
    ],
    more: ["Attio", "Metricool for Social Media", "Ahrefs"],
  },
  {
    title: "Data & Analytics",
    plugins: [
      { name: "PostHog", description: "Analyze your product data" },
      {
        name: "Data Analytics",
        description: "Answer product and business questions with data",
      },
      { name: "Mixpanel", description: "Query and analyze Mixpanel" },
      { name: "BigQuery", description: "Query and manage BigQuery" },
      { name: "MotherDuck", description: "Get answers from your data" },
      { name: "Coupler.io", description: "Analyze data from 400+ apps" },
    ],
    more: ["Hex", "Mixpanel Headless"],
  },
  {
    title: "Communication",
    plugins: [
      { name: "Outlook Email", description: "Triage Outlook inboxes" },
      { name: "Superhuman Mail", description: "Email and calendar assistant" },
      { name: "Teams", description: "Summarize Teams and follow up" },
      { name: "Zoom", description: "Smart meeting insights from Zoom" },
      { name: "Hostinger Mail", description: "Use Hostinger Mail" },
      {
        name: "Mailopoly Inbox",
        description: "Search and send emails and messages",
      },
    ],
    more: ["Textmagic", "NoPressure", "Gmail"],
  },
  {
    title: "Education & Research",
    plugins: [
      { name: "Readwise", description: "Save, read, search, and learn" },
      { name: "Acumen by Talarion", description: "Keep your AI up to date" },
      { name: "Consensus", description: "Explore scientific research" },
      {
        name: "Sider Scholar",
        description: "Search 350M+ papers, save, and chat",
      },
      { name: "Elicit", description: "Search scientific literature" },
      { name: "SciSpace", description: "For science and research" },
    ],
    more: ["Academic Writing Toolkit", "Scite", "Undermind"],
  },
  {
    title: "Scientific Research",
    plugins: [
      { name: "Biohub ESM", description: "Understand proteins with ESM" },
      { name: "Undermind", description: "Find and read research papers" },
    ],
    more: [],
  },
  {
    title: "Security",
    plugins: [
      { name: "Codex Security", description: "Scan your codebase for risks" },
      {
        name: "Malwarebytes",
        description: "Verify links, domains, and phone numbers",
      },
      { name: "Bitdefender", description: "Check potentially unsafe URLs" },
      { name: "Vanta", description: "Build trust with Vanta" },
      { name: "NightVision", description: "Secure apps with NightVision" },
      { name: "Radar Lite", description: "Domain security with Red Sift" },
    ],
    more: ["PrivacyHawk", "Skill Risk Check"],
  },
  {
    title: "Finance",
    plugins: [
      { name: "Longbridge", description: "Stock quotes and financial data" },
      {
        name: "Interactive Brokers (IBKR)",
        description: "Analyze global markets",
      },
      {
        name: "Public Equity Investing",
        description: "Research public equities and earnings",
      },
      { name: "Quartr", description: "Company research data" },
      { name: "Alpaca", description: "Market data for stocks and crypto" },
      { name: "Binance", description: "Explore Binance market data" },
    ],
    more: ["PitchBook", "Stripe", "FactSet AI-Ready Data"],
  },
  {
    title: "Healthcare",
    plugins: [
      { name: "Health", description: "Connect and explore your health data" },
      {
        name: "Fitness AI Connector",
        description: "AI coach for your Garmin data",
      },
      { name: "COROS", description: "Workout data insights" },
      { name: "Tredict", description: "Analyze workouts and create plans" },
      { name: "Calorie Tracker", description: "Track your food and calories" },
      { name: "freddy", description: "Ask about your health data" },
    ],
    more: ["MyFitnessPal", "CalorieCam", "Caliber"],
  },
  {
    title: "Travel",
    plugins: [
      { name: "Skyscanner", description: "Find cheap flights" },
      { name: "Expedia", description: "Plan travel, flights, and hotels" },
      { name: "Trip.com", description: "All-in-one travel companion" },
      { name: "Flight Network", description: "Search and book flights" },
      { name: "eDreams", description: "Find flights and hotels" },
      { name: "Wikiloc", description: "Find your perfect trail" },
    ],
    more: ["komoot", "ForeFlight Mobile", "trivago"],
  },
  {
    title: "Entertainment",
    plugins: [
      { name: "Apple Music", description: "Build playlists and find music" },
      { name: "Podcast App", description: "Find great podcasts" },
      { name: "Chessy", description: "Play chess against Clauxen" },
      { name: "Shazam", description: "Identify songs instantly" },
      { name: "Flixor", description: "Movie and TV recommender" },
      {
        name: "Smart Chess:Train+Learn to win",
        description: "Play, improve, and learn strategy",
      },
    ],
    more: ["Spotify", "Background Music", "Caveman Mode"],
  },
  {
    title: "Other",
    plugins: [
      { name: "Indeed", description: "Find jobs tailored for you" },
      { name: "LinkedIn", description: "Find the right professional" },
      { name: "Tarot", description: "Tarot reading and divination" },
      { name: "idealista", description: "Find properties to buy or rent" },
      { name: "Ask Tarot Cards", description: "Tarot card readings" },
      { name: "Etsy", description: "Shop home, style, and more" },
    ],
    more: ["Steer Astro", "Homey", "Astro Scope: Astrology"],
  },
];

const EXTRA_PLUGINS: DirectoryPlugin[] = [
  { name: "Linear", description: "Plan and build products" },
  { name: "monday.com", description: "Manage projects, tasks, and CRM" },
  { name: "Spreadsheets", description: "Create and edit spreadsheets" },
  { name: "Documents", description: "Create and edit documents" },
  { name: "Presentations", description: "Create and edit presentations" },
  { name: "PDF", description: "Read, create, and verify PDFs" },
  { name: "Default templates", description: "Start from ready-made templates" },
  { name: "Template Creator", description: "Create reusable templates" },
  { name: "Plugin Management", description: "Discover and manage plugins" },
  { name: "Mobbin", description: "Find UI and UX design references" },
  { name: "Runway", description: "Create AI images and videos" },
  { name: "B12 Website Generator", description: "Create a website in seconds" },
  { name: "Context7", description: "Fetch up-to-date developer docs" },
  { name: "Base44", description: "Build apps and websites with AI" },
  { name: "Resend", description: "Email for developers" },
  {
    name: "Hugging Face",
    description: "Explore models, datasets, and research",
  },
  { name: "Cloudflare", description: "Build and manage Cloudflare services" },
  { name: "Attio", description: "Manage your CRM with Clauxen" },
  {
    name: "Metricool for Social Media",
    description: "Review analytics and plan posts",
  },
  { name: "Ahrefs", description: "Marketing, SEO, and AI analytics" },
  { name: "Hex", description: "Ask questions and run analyses" },
  {
    name: "Mixpanel Headless",
    description: "Analyze Mixpanel data with Python",
  },
  { name: "Metorik", description: "Run reports for your store" },
  { name: "PlaybookUX", description: "Launch and analyze UX research" },
  { name: "Textmagic", description: "Send SMS and manage contacts" },
  { name: "NoPressure", description: "Practice hard conversations" },
  { name: "Academic Writing Toolkit", description: "Review academic drafts" },
  { name: "Scite", description: "Find answers grounded in science" },
  {
    name: "OpenAI Certified",
    description: "Learn practical AI skills and earn credentials",
  },
  { name: "Skill Risk Check", description: "Scan skills before you install" },
  { name: "PrivacyHawk", description: "Protect your personal data" },
  { name: "MCP Precheck", description: "Check MCP servers before connecting" },
  { name: "PitchBook", description: "Explore private capital market data" },
  { name: "Stripe", description: "Accept payments and grow revenue" },
  {
    name: "FactSet AI-Ready Data",
    description: "Access AI-ready financial data",
  },
  { name: "Razorpay", description: "View payments and refunds" },
  { name: "MyFitnessPal", description: "Explore nutrition and activity data" },
  { name: "CalorieCam", description: "Estimate calories from food photos" },
  { name: "Caliber", description: "Plan and track strength training" },
  { name: "komoot", description: "Plan routes and outdoor adventures" },
  { name: "ForeFlight Mobile", description: "Plan and review flights" },
  { name: "trivago", description: "Compare hotels for your trip" },
  { name: "Spotify", description: "Find music and build playlists" },
  { name: "Background Music", description: "Find music for every moment" },
  { name: "Caveman Mode", description: "Discover games and entertainment" },
  { name: "Steer Astro", description: "Explore astrology insights" },
  { name: "Homey", description: "Manage your connected home" },
  {
    name: "Astro Scope: Astrology",
    description: "Read personalized astrology insights",
  },
];

const pluginByName = new Map(
  [
    ...PLUGIN_SECTIONS.flatMap((section) => section.plugins),
    ...EXTRA_PLUGINS,
  ].map((plugin) => [plugin.name, plugin]),
);

function plugins(names: string[]): DirectoryPlugin[] {
  return [...new Set(names)].map(
    (name) =>
      pluginByName.get(name) ?? {
        name,
        description: `Use ${name} with Clauxen`,
      },
  );
}

const CATEGORY_CONTENT = [
  {
    slug: "featured",
    title: "Popular",
    description: "A curated selection of useful and noteworthy plugins.",
    searchPlaceholder: "Search popular plugins",
    names: [
      "Gmail",
      "GitHub",
      "Google Drive",
      "Google Calendar",
      "Notion",
      "Slack",
      "Outlook Email",
      "Granola",
      "Fireflies",
      "Canva",
      "Superhuman Mail",
      "Outlook Calendar",
      "PostHog",
      "Plaud",
      "Datadog (Preview)",
      "Shopify",
      "Otter.ai",
      "Atlassian Rovo",
      "Linear",
      "Teams",
      "Supabase",
      "monday.com",
      "Spreadsheets",
      "Documents",
      "Zoho CRM",
      "HubSpot",
      "Apollo.io",
      "Longbridge",
      "Data Analytics",
      "Webflow",
      "ZoomInfo",
      "Health",
      "Higgsfield",
      "Vercel",
      "Product Design",
      "Codex Security",
      "Exa",
      "Attio",
      "Neon Postgres",
      "Interactive Brokers (IBKR)",
      "Devpost Hackathons",
      "Metricool for Social Media",
      "Ahrefs",
    ],
  },
  {
    slug: "productivity",
    title: "Productivity",
    description: "Organize your work, automate tasks, and get more done.",
    searchPlaceholder: "Search productivity plugins",
    names: [
      "Google Drive",
      "Google Calendar",
      "Notion",
      "Granola",
      "Fireflies",
      "Outlook Calendar",
      "Plaud",
      "Otter.ai",
      "Atlassian Rovo",
      "Linear",
      "monday.com",
      "Spreadsheets",
      "Documents",
      "Presentations",
      "PDF",
      "Default templates",
      "Template Creator",
      "Plugin Management",
    ],
  },
  {
    slug: "creativity",
    title: "Creativity",
    description: "Create with writing, design, images, audio, and more.",
    searchPlaceholder: "Search creativity plugins",
    names: [
      "Canva",
      "Higgsfield",
      "Product Design",
      "Figma",
      "Magnific",
      "HeyGen",
      "Mobbin",
      "Runway",
      "B12 Website Generator",
    ],
  },
  {
    slug: "developer-tools",
    title: "Developer Tools",
    description: "Build, test, ship, and maintain software.",
    searchPlaceholder: "Search developer tools plugins",
    names: [
      "GitHub",
      "Datadog (Preview)",
      "Supabase",
      "Vercel",
      "Exa",
      "Neon Postgres",
      "Devpost Hackathons",
      "Context7",
      "Base44",
      "Resend",
      "Hugging Face",
      "Cloudflare",
    ],
  },
  {
    slug: "business-and-operations",
    title: "Business & Operations",
    description: "Manage sales, marketing, support, HR, and operations.",
    searchPlaceholder: "Search business & operations plugins",
    names: [
      "Shopify",
      "Zoho CRM",
      "HubSpot",
      "Apollo.io",
      "Webflow",
      "ZoomInfo",
      "Attio",
      "Metricool for Social Media",
      "Ahrefs",
      "Indeed",
    ],
  },
  {
    slug: "data-and-analytics",
    title: "Data & Analytics",
    description: "Explore data, uncover insights, and find clear answers.",
    searchPlaceholder: "Search data & analytics plugins",
    names: [
      "PostHog",
      "Data Analytics",
      "Mixpanel",
      "MotherDuck",
      "Coupler.io",
      "Hex",
      "Mixpanel Headless",
      "Metorik",
      "BigQuery",
    ],
  },
  {
    slug: "communication",
    title: "Communication",
    description: "Connect through email, messaging, meetings, and more.",
    searchPlaceholder: "Search communication plugins",
    names: [
      "Gmail",
      "Slack",
      "Outlook Email",
      "Superhuman Mail",
      "Teams",
      "Zoom",
      "Hostinger Mail",
      "Mailopoly Inbox",
      "Textmagic",
      "NoPressure",
      "PlaybookUX",
    ],
  },
  {
    slug: "education-and-research",
    title: "Education & Research",
    description: "Learn, teach, and explore new ideas in depth.",
    searchPlaceholder: "Search education & research plugins",
    names: [
      "Readwise",
      "Acumen by Talarion",
      "Consensus",
      "Sider Scholar",
      "Elicit",
      "SciSpace",
      "Academic Writing Toolkit",
      "Scite",
      "OpenAI Certified",
    ],
  },
  {
    slug: "scientific-research",
    title: "Scientific Research",
    description:
      "Explore scientific literature, data, methods, and discoveries.",
    searchPlaceholder: "Search scientific research plugins",
    names: ["Biohub ESM", "Undermind"],
  },
  {
    slug: "security",
    title: "Security",
    description: "Protect systems, manage access, and reduce risk.",
    searchPlaceholder: "Search security plugins",
    names: [
      "Codex Security",
      "Malwarebytes",
      "Bitdefender",
      "Vanta",
      "Skill Risk Check",
      "PrivacyHawk",
      "Radar Lite",
      "MCP Precheck",
      "NightVision",
    ],
  },
  {
    slug: "finance",
    title: "Finance",
    description: "Manage banking, payments, accounting, and investments.",
    searchPlaceholder: "Search finance plugins",
    names: [
      "Longbridge",
      "Interactive Brokers (IBKR)",
      "Public Equity Investing",
      "Quartr",
      "Alpaca",
      "Binance",
      "PitchBook",
      "Stripe",
      "FactSet AI-Ready Data",
      "Razorpay",
    ],
  },
  {
    slug: "healthcare",
    title: "Healthcare",
    description: "Support healthcare work, clinical needs, and wellness.",
    searchPlaceholder: "Search healthcare plugins",
    names: [
      "Health",
      "Fitness AI Connector",
      "COROS",
      "Tredict",
      "Calorie Tracker",
      "freddy",
      "MyFitnessPal",
      "CalorieCam",
      "Caliber",
    ],
  },
  {
    slug: "travel",
    title: "Travel",
    description: "Plan, book, and manage every part of your trip.",
    searchPlaceholder: "Search travel plugins",
    names: [
      "Skyscanner",
      "Expedia",
      "Trip.com",
      "Flight Network",
      "eDreams",
      "Wikiloc",
      "komoot",
      "ForeFlight Mobile",
      "trivago",
    ],
  },
  {
    slug: "entertainment",
    title: "Entertainment",
    description: "Discover games, music, movies, and more.",
    searchPlaceholder: "Search entertainment plugins",
    names: [
      "Apple Music",
      "Podcast App",
      "Chessy",
      "Shazam",
      "Flixor",
      "Smart Chess:Train+Learn to win",
      "Spotify",
      "Background Music",
      "Caveman Mode",
    ],
  },
  {
    slug: "other",
    title: "Other",
    description: "Explore useful plugins across a range of interests.",
    searchPlaceholder: "Search other plugins",
    names: [
      "Indeed",
      "LinkedIn",
      "Tarot",
      "idealista",
      "Ask Tarot Cards",
      "Etsy",
      "Steer Astro",
      "Homey",
      "Astro Scope: Astrology",
    ],
  },
] as const;

export const PLUGIN_CATEGORIES: PluginCategory[] = CATEGORY_CONTENT.map(
  ({ names, ...category }) => ({ ...category, plugins: plugins([...names]) }),
);

const categoryBySlug = new Map(
  PLUGIN_CATEGORIES.map((category) => [category.slug, category]),
);

export function getPluginCategory(slug: string | null): PluginCategory | null {
  return slug ? (categoryBySlug.get(slug) ?? null) : null;
}

export function pluginCategorySlugForTitle(title: string): string {
  return (
    PLUGIN_CATEGORIES.find((category) => category.title === title)?.slug ??
    title
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

export function pluginIconPath(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `/assets/plugins/${slug}.png`;
}
