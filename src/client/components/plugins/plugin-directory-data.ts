export type DirectoryPlugin = {
  name: string;
  description: string;
};

export type PluginSection = {
  title: string;
  plugins: DirectoryPlugin[];
  more: string[];
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
