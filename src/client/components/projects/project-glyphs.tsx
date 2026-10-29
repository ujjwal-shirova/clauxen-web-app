import type { ComponentType, ReactNode, SVGProps } from "react";

/**
 * Project glyphs, drawn to the same grid as `icons/app-icons.tsx`:
 * 24×24 viewBox, 1.75 stroke, round caps, `currentColor`, `1em` box so the
 * glyph scales with the font size of whatever chip or card holds it.
 */
export type ProjectGlyph = ComponentType<SVGProps<SVGSVGElement>>;

function glyph(displayName: string, children: ReactNode): ProjectGlyph {
  function Glyph({ children: _children, ...props }: SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  }
  Glyph.displayName = displayName;
  return Glyph;
}

const Folder = glyph(
  "Folder",
  <path d="M3 7.5V6.75A1.75 1.75 0 0 1 4.75 5h4l2 2h8.5A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25Z" />,
);

const Sparkle = glyph(
  "Sparkle",
  <>
    <path d="m12 3 1.6 4.9L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6Z" />
    <path d="m18.5 16 .6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6Z" />
  </>,
);

const Rocket = glyph(
  "Rocket",
  <>
    <path d="M12 3c3 1.9 4.75 5 4.75 8.75L14 15h-4l-2.75-3.25C7.25 8 9 4.9 12 3Z" />
    <circle cx="12" cy="9.5" r="1.6" />
    <path d="M10 15l-1.5 4L12 17.5 15.5 19 14 15" />
  </>,
);

const Briefcase = glyph(
  "Briefcase",
  <>
    <rect x="3" y="7.5" width="18" height="11.5" rx="2" />
    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
    <path d="M3 12h18" />
  </>,
);

const Book = glyph(
  "Book",
  <>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5Z" />
  </>,
);

const Graduation = glyph(
  "Graduation",
  <>
    <path d="m12 4 9 4.25-9 4.25L3 8.25Z" />
    <path d="M7 10.5v5c0 1.4 2.24 2.5 5 2.5s5-1.1 5-2.5v-5" />
    <path d="M20 9.5v5" />
  </>,
);

const Pen = glyph(
  "Pen",
  <>
    <path d="M4 20h4L20.5 7.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
    <path d="m15.5 6.5 3 3" />
  </>,
);

const Code = glyph(
  "Code",
  <>
    <path d="m8 8-4 4 4 4" />
    <path d="m16 8 4 4-4 4" />
    <path d="m14 5-4 14" />
  </>,
);

const Terminal = glyph(
  "Terminal",
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="m7.5 10 2.25 2.25L7.5 14.5M12.5 14.5h4" />
  </>,
);

const Database = glyph(
  "Database",
  <>
    <ellipse cx="12" cy="6.5" rx="7.5" ry="3" />
    <path d="M4.5 6.5v11c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-11" />
    <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
  </>,
);

const Chart = glyph(
  "Chart",
  <>
    <path d="M4 4v16h16" />
    <path d="M8 16v-4m4 4V8m4 8v-6" />
  </>,
);

const Coin = glyph(
  "Coin",
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5v9M14.5 10a2.5 2.5 0 0 0-2.5-1.5h-.25a2.25 2.25 0 0 0 0 4.5h1a2.25 2.25 0 0 1 0 4.5H12A2.5 2.5 0 0 1 9.5 16" />
  </>,
);

const Palette = glyph(
  "Palette",
  <>
    <path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2.2-1.8 3.5-4 3.5h-1.25a2 2 0 0 0-1.5 3.32A1.75 1.75 0 0 1 12 20.5Z" />
    <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none" />
  </>,
);

const Camera = glyph(
  "Camera",
  <>
    <path d="M3 9.25A1.75 1.75 0 0 1 4.75 7.5h2L8 5.5h8l1.25 2h2A1.75 1.75 0 0 1 21 9.25v8A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25Z" />
    <circle cx="12" cy="13" r="3.25" />
  </>,
);

const Music = glyph(
  "Music",
  <>
    <circle cx="7" cy="17.5" r="2.5" />
    <circle cx="18" cy="15.5" r="2.5" />
    <path d="M9.5 17.5V7l11-2v10.5" />
  </>,
);

const Film = glyph(
  "Film",
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7.5 5v14M16.5 5v14M3 12h18M3 8.5h4.5M3 15.5h4.5M16.5 8.5H21M16.5 15.5H21" />
  </>,
);

const Globe = glyph(
  "Globe",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z" />
  </>,
);

const Plane = glyph(
  "Plane",
  <path d="M10.5 13.5 3.5 11.5V9.25l7 1.25V5.5a1.5 1.5 0 0 1 3 0v5l7-1.25v2.25l-7 2 .75 5.25L14 20H10l.75-1.25Z" />,
);

const Compass = glyph(
  "Compass",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15 9-1.75 4.25L9 15l1.75-4.25Z" />
  </>,
);

const Home = glyph(
  "Home",
  <>
    <path d="m3.5 10.5 8.5-6.5 8.5 6.5v8A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5Z" />
    <path d="M9.5 20v-6h5v6" />
  </>,
);

const Leaf = glyph(
  "Leaf",
  <>
    <path d="M20 4c-9 0-14 3.5-14 9.5 0 2.2.9 4 2.5 5.2C10 15 14 11.5 20 10.5" />
    <path d="M4 20c.5-2.5 1.5-4.5 2.5-5.3" />
  </>,
);

const Heart = glyph(
  "Heart",
  <path d="M12 19.5 5.2 13a4.3 4.3 0 0 1 6.1-6.05L12 7.6l.7-.65A4.3 4.3 0 0 1 18.8 13Z" />,
);

const Pulse = glyph(
  "Pulse",
  <path d="M3 12.5h3.5L9 7l3 10 2.5-6.5H21" />,
);

const Flask = glyph(
  "Flask",
  <>
    <path d="M9.5 3.5h5v5.25l4.25 8A2 2 0 0 1 17 20H7a2 2 0 0 1-1.75-3.25l4.25-8Z" />
    <path d="M7.25 14.5h9.5" />
  </>,
);

const Brain = glyph(
  "Brain",
  <>
    <path d="M12 5.5a3 3 0 0 0-5.5 1.7A3 3 0 0 0 5 10a3 3 0 0 0 1.5 2.6A3 3 0 0 0 9 18a3 3 0 0 0 3-1.6Z" />
    <path d="M12 5.5A3 3 0 0 1 17.5 7.2A3 3 0 0 1 19 10a3 3 0 0 1-1.5 2.6A3 3 0 0 1 15 18a3 3 0 0 1-3-1.6Z" />
  </>,
);

const Paw = glyph(
  "Paw",
  <>
    <ellipse cx="7.5" cy="10" rx="1.9" ry="2.4" />
    <ellipse cx="16.5" cy="10" rx="1.9" ry="2.4" />
    <ellipse cx="10.5" cy="6.5" rx="1.8" ry="2.2" />
    <ellipse cx="14" cy="6.5" rx="1.8" ry="2.2" />
    <path d="M12 13c2.6 0 4.5 1.7 4.5 3.75S14.6 20.5 12 20.5s-4.5-1.7-4.5-3.75S9.4 13 12 13Z" />
  </>,
);

const Dumbbell = glyph(
  "Dumbbell",
  <>
    <path d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5M7 12h10" />
  </>,
);

const Cart = glyph(
  "Cart",
  <>
    <path d="M3 5h2l2.5 9.5h9.5L19.5 8H6" />
    <circle cx="9" cy="18.5" r="1.4" />
    <circle cx="16.5" cy="18.5" r="1.4" />
  </>,
);

const Scale = glyph(
  "Scale",
  <>
    <path d="M12 4v16M8 20h8M5 9h14M12 5l-7 4 3.5 4.5L5 9m14 0-3.5 4.5L19 9" />
  </>,
);

const Wrench = glyph(
  "Wrench",
  <path d="M15.5 3.5a5 5 0 0 0-4.1 7.85L4 18.75 6.25 21l7.4-7.4A5 5 0 0 0 20.5 8.5L17.75 11l-2.5-2.5 2.5-2.5a5 5 0 0 0-2.25-2.5Z" />,
);

const Shield = glyph(
  "Shield",
  <>
    <path d="M12 3.5l7 2.5v5.5c0 4-2.8 7.2-7 8.5-4.2-1.3-7-4.5-7-8.5V6Z" />
    <path d="m9.25 12 2 2 3.5-3.75" />
  </>,
);

const Bolt = glyph(
  "Bolt",
  <path d="M13.5 3 6 13.5h4.75L10 21l7.5-10.5H12.75Z" />,
);

const Target = glyph(
  "Target",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.75" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </>,
);

export const PROJECT_GLYPHS: Array<{
  id: string;
  label: string;
  icon: ProjectGlyph;
}> = [
  { id: "folder", label: "Folder", icon: Folder },
  { id: "sparkle", label: "Sparkle", icon: Sparkle },
  { id: "rocket", label: "Rocket", icon: Rocket },
  { id: "target", label: "Target", icon: Target },
  { id: "bolt", label: "Bolt", icon: Bolt },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "book", label: "Book", icon: Book },
  { id: "school", label: "School", icon: Graduation },
  { id: "pen", label: "Writing", icon: Pen },
  { id: "code", label: "Code", icon: Code },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "database", label: "Data", icon: Database },
  { id: "chart", label: "Analytics", icon: Chart },
  { id: "coin", label: "Finance", icon: Coin },
  { id: "cart", label: "Shopping", icon: Cart },
  { id: "art", label: "Design", icon: Palette },
  { id: "camera", label: "Photo", icon: Camera },
  { id: "music", label: "Music", icon: Music },
  { id: "film", label: "Film", icon: Film },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "plane", label: "Travel", icon: Plane },
  { id: "compass", label: "Explore", icon: Compass },
  { id: "home", label: "Home", icon: Home },
  { id: "leaf", label: "Nature", icon: Leaf },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "health", label: "Health", icon: Pulse },
  { id: "lab", label: "Research", icon: Flask },
  { id: "brain", label: "Thinking", icon: Brain },
  { id: "paw", label: "Pets", icon: Paw },
  { id: "train", label: "Fitness", icon: Dumbbell },
  { id: "scale", label: "Legal", icon: Scale },
  { id: "wrench", label: "Tools", icon: Wrench },
  { id: "shield", label: "Security", icon: Shield },
];

const GLYPHS_BY_ID = new Map(PROJECT_GLYPHS.map((item) => [item.id, item]));

/** Legacy ids that no longer have their own glyph map onto the closest match. */
const GLYPH_ALIASES: Record<string, string> = {
  dollar: "coin",
  nib: "pen",
  popcorn: "film",
  cut: "art",
  flower: "leaf",
  plant: "leaf",
  stethoscope: "health",
};

export function projectGlyph(id: string | null | undefined) {
  const key = (id || "folder").trim();
  return (
    GLYPHS_BY_ID.get(key) ??
    GLYPHS_BY_ID.get(GLYPH_ALIASES[key] ?? "") ??
    PROJECT_GLYPHS[0]
  );
}

export const PROJECT_COLORS = [
  "#14151a",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#64748b",
] as const;
