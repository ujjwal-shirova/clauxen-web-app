import type { ComponentType, ReactNode, SVGProps } from "react";

export type AppIcon = ComponentType<SVGProps<SVGSVGElement>>;

function createIcon(displayName: string, children: ReactNode): AppIcon {
  function Icon({ children: _children, ...props }: SVGProps<SVGSVGElement>) {
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
  Icon.displayName = displayName;
  return Icon;
}

export const ArrowDown = createIcon(
  "ArrowDown",
  <>
    <path d="M12 4v15" />
    <path d="m6 13 6 6 6-6" />
  </>,
);
export const ArrowUp = createIcon(
  "ArrowUp",
  <>
    <path d="M12 20V5" />
    <path d="m6 11 6-6 6 6" />
  </>,
);
export const ArrowUpCircle = createIcon(
  "ArrowUpCircle",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16V8m-3 3 3-3 3 3" />
  </>,
);
export const Check = createIcon("Check", <path d="m5 12 4.25 4.25L19 6.5" />);
export const ChevronDown = createIcon("ChevronDown", <path d="m6 9 6 6 6-6" />);
export const ChevronRight = createIcon(
  "ChevronRight",
  <path d="m9 5 7 7-7 7" />,
);
export const Code2 = createIcon(
  "Code2",
  <>
    <path d="m8 8-4 4 4 4" />
    <path d="m16 8 4 4-4 4" />
    <path d="m14 5-4 14" />
  </>,
);
export const Devices = createIcon(
  "Devices",
  <>
    <rect x="2.5" y="4" width="14" height="11" rx="1.75" />
    <path d="M6 19h7" />
    <rect x="17" y="9" width="4.5" height="10" rx="1.25" />
    <path d="M8 15v2.5" />
  </>,
);
export const Folder = createIcon(
  "Folder",
  <path d="M3 7.5V6.75A1.75 1.75 0 0 1 4.75 5h4l2 2h8.5A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25Z" />,
);
export const FolderKanban = createIcon(
  "FolderKanban",
  <>
    <path d="M3 7.5V6.75A1.75 1.75 0 0 1 4.75 5h4l2 2h8.5A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25Z" />
    <path d="M7 10v5m5-5v3m5-3v6" />
  </>,
);
export const Globe = createIcon(
  "Globe",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.4 2.45 3.6 5.45 3.6 9S14.4 18.55 12 21c-2.4-2.45-3.6-5.45-3.6-9S9.6 5.45 12 3Z" />
  </>,
);
export const Hand = createIcon(
  "Hand",
  <path d="M8.5 11V5.5a1.5 1.5 0 0 1 3 0V10m0-5.5a1.5 1.5 0 0 1 3 0V10m0-4a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0v4.25c0 4.25-2.75 7.25-7 7.25h-1c-2.1 0-3.4-.85-4.75-2.4L4 13.5a1.65 1.65 0 0 1 2.4-2.25L8.5 13" />,
);
export const HelpCircle = createIcon(
  "HelpCircle",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9a2.5 2.5 0 1 1 3.65 2.23c-.73.4-1.25.87-1.25 1.77v.25" />
    <path d="M12 17h.01" strokeWidth={2.5} />
  </>,
);
export const ImageIcon = createIcon(
  "ImageIcon",
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9" r="1.5" />
    <path d="m3 16 5-5 4 4 2.5-2.5L21 19" />
  </>,
);
export const Keyboard = createIcon(
  "Keyboard",
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" />
  </>,
);
export const Laptop = createIcon(
  "Laptop",
  <>
    <rect x="4" y="4" width="16" height="12" rx="1.75" />
    <path d="m2 19 2-3h16l2 3Z" />
  </>,
);
export const Library = createIcon(
  "Library",
  <>
    <rect x="3" y="4" width="5" height="16" rx="1" />
    <rect x="10" y="4" width="5" height="16" rx="1" />
    <path d="m17 5 3.5-.75L22 19.5l-3.5.75Z" />
  </>,
);
export const Lightbulb = createIcon(
  "Lightbulb",
  <>
    <path d="M8.5 15.5C7 14.4 6 12.8 6 10.75a6 6 0 1 1 12 0c0 2.05-1 3.65-2.5 4.75-.7.5-1 1-1 1.5h-5c0-.5-.3-1-1-1.5Z" />
    <path d="M9.5 20h5M12 2v1" />
  </>,
);
export const LoaderCircle = createIcon(
  "LoaderCircle",
  <path d="M21 12a9 9 0 1 1-6.22-8.56" />,
);
export const LogIn = createIcon(
  "LogIn",
  <>
    <path d="M10 5H5.75A1.75 1.75 0 0 0 4 6.75v10.5A1.75 1.75 0 0 0 5.75 19H10" />
    <path d="M13 8l4 4-4 4m4-4H8" />
  </>,
);
export const LogOut = createIcon(
  "LogOut",
  <>
    <path d="M14 5h4.25A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H14" />
    <path d="m11 8-4 4 4 4m-4-4h9" />
  </>,
);
export const Mic = createIcon(
  "Mic",
  <>
    <rect x="8" y="2.5" width="8" height="13" rx="4" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5m-3 0h6" />
  </>,
);
export const MoreVertical = createIcon(
  "MoreVertical",
  <>
    <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
  </>,
);
export const Paperclip = createIcon(
  "Paperclip",
  <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-3-3L15 6" />,
);
export const Pin = createIcon(
  "Pin",
  <>
    <path d="m9 3 6 6m-7.5 1.5L12 6l6 6-4.5 4.5" />
    <path d="m12 12-7 7m2-7 5 5" />
  </>,
);
export const Plus = createIcon("Plus", <path d="M12 5v14M5 12h14" />);
export const Puzzle = createIcon(
  "Puzzle",
  <path d="M8.5 3.5a2.25 2.25 0 0 1 4.5 0V5h4.25A1.75 1.75 0 0 1 19 6.75V11h-1.5a2.25 2.25 0 0 0 0 4.5H19v2.75A1.75 1.75 0 0 1 17.25 20H13v-1.5a2.25 2.25 0 0 0-4.5 0V20H5.75A1.75 1.75 0 0 1 4 18.25V14h1.5a2.25 2.25 0 0 0 0-4.5H4V6.75A1.75 1.75 0 0 1 5.75 5H8.5Z" />,
);
export const Search = createIcon(
  "Search",
  <>
    <circle cx="10.75" cy="10.75" r="6.75" />
    <path d="m16 16 4.5 4.5" />
  </>,
);
export const Settings = createIcon(
  "Settings",
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09a1.7 1.7 0 0 0-1.1-1.51 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.38.37.72.6 1 .3.3.7.4 1.1.4H21v4h-.09a1.7 1.7 0 0 0-1.51.6Z" />
  </>,
);
export const SlidersHorizontal = createIcon(
  "SlidersHorizontal",
  <>
    <path d="M4 7h5m4 0h7M4 17h9m4 0h3" />
    <circle cx="11" cy="7" r="2" />
    <circle cx="15" cy="17" r="2" />
  </>,
);
export const Sparkles = createIcon(
  "Sparkles",
  <>
    <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" />
    <path d="m18.5 15 .75 2.25L21.5 18l-2.25.75L18.5 21l-.75-2.25L15.5 18l2.25-.75Z" />
  </>,
);
export const Square = createIcon(
  "Square",
  <rect x="5" y="5" width="14" height="14" rx="2" />,
);
export const SquarePen = createIcon(
  "SquarePen",
  <>
    <path d="M13 5H5.75A1.75 1.75 0 0 0 4 6.75v12.5A1.75 1.75 0 0 0 5.75 21h12.5A1.75 1.75 0 0 0 20 19.25V11" />
    <path d="m15.5 3.5 5 5M11 16l1-4 7.5-7.5a1.4 1.4 0 0 1 2 2L14 14Z" />
  </>,
);
export const Star = createIcon(
  "Star",
  <path d="m12 3 2.75 5.6 6.25.9-4.5 4.4 1.05 6.1L12 17.1 6.45 20l1.05-6.1L3 9.5l6.25-.9Z" />,
);
export const Telescope = createIcon(
  "Telescope",
  <>
    <path d="m4 7 12-4 2 5-12 4Z" />
    <path d="m14 10 2 4m-5-3-4 10m7-8 5 8M3 21h9" />
    <path d="m16 3 1-1 3 1 1 3-2 2" />
  </>,
);
export const X = createIcon("X", <path d="m6 6 12 12M18 6 6 18" />);
