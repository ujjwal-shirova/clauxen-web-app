/**
 * Clauxen marketing website — brand, nav, and route helpers.
 * Chat app stays at `/` / `/new`. Marketing lives on parallel public URLs.
 */

export const SITE = {
  brand: "Clauxen",
  company: "Shirova AI",
  domain: "clauxen.com",
  supportEmail: "support@clauxen.com",
  appHome: "/new",
  login: "/login",
  /** Marketing pricing — do not use /pricing (in-app overlay). */
  plans: "/plans",
} as const;

export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string; description?: string }[];
};

export const PRIMARY_NAV: NavItem[] = [
  {
    label: "Product",
    href: "/product/overview",
    children: [
      {
        label: "Overview",
        href: "/product/overview",
        description: "Chat, projects, agents, and tools in one workspace",
      },
      {
        label: "Work",
        href: "/work",
        description: "Turn goals into finished deliverables",
      },
      {
        label: "Codex",
        href: "/codex",
        description: "Coding agents across editor, terminal, and chat",
      },
      {
        label: "Canvas",
        href: "/canvas",
        description: "Side-by-side writing and code collaboration",
      },
      {
        label: "Features",
        href: "/features",
        description: "Models, tools, memory, and connectors",
      },
    ],
  },
  {
    label: "Solutions",
    href: "/solutions/enterprise",
    children: [
      { label: "Enterprise", href: "/solutions/enterprise" },
      { label: "Coding", href: "/solutions/coding" },
      { label: "Education", href: "/solutions/education" },
      { label: "Healthcare", href: "/solutions/healthcare" },
      { label: "Legal", href: "/solutions/legal" },
      { label: "Financial services", href: "/solutions/financial-services" },
      { label: "All solutions", href: "/solutions" },
    ],
  },
  {
    label: "Business",
    href: "/business",
    children: [
      { label: "Clauxen Business", href: "/business" },
      { label: "Enterprise", href: "/business/enterprise" },
      { label: "Education", href: "/business/education" },
      { label: "Engineering", href: "/business/ai-for-engineering" },
      { label: "Finance", href: "/business/ai-for-finance" },
      { label: "Sales & marketing", href: "/business/ai-for-sales-marketing" },
    ],
  },
  { label: "Plans", href: "/plans" },
  {
    label: "Resources",
    href: "/resources/use-cases",
    children: [
      { label: "Use cases", href: "/resources/use-cases" },
      { label: "Tutorials", href: "/resources/tutorials" },
      { label: "Courses", href: "/resources/courses" },
      { label: "Docs", href: "/docs" },
      { label: "Blog", href: "/blog" },
      { label: "Customers", href: "/customers" },
    ],
  },
];

export const FOOTER_COLUMNS: {
  title: string;
  links: { label: string; href: string }[];
}[] = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/overview" },
      { label: "Features", href: "/features" },
      { label: "Work", href: "/work" },
      { label: "Codex", href: "/codex" },
      { label: "Download", href: "/download" },
      { label: "Plans", href: "/plans" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Enterprise", href: "/solutions/enterprise" },
      { label: "Small business", href: "/solutions/small-business" },
      { label: "Education", href: "/solutions/education" },
      { label: "Teachers", href: "/solutions/teachers" },
      { label: "Government", href: "/solutions/government" },
      { label: "Nonprofits", href: "/solutions/nonprofits" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "API", href: "/platform/api" },
      { label: "Marketplace", href: "/platform/marketplace" },
      { label: "Connectors", href: "/platform/connectors" },
      { label: "Plugins", href: "/platform/plugins" },
      { label: "Skills", href: "/skills" },
      { label: "Partners", href: "/partners" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Customers", href: "/customers" },
      { label: "Community", href: "/community" },
      { label: "Contact sales", href: "/contact-sales" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
];
