import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Clauxen line icons. One component, path data only.
 * 24px grid, 1.5px stroke, currentColor. Drawn for the 16px product size.
 */
const glyphs = {
  plus: ["M12 5.5v13M5.5 12h13"],
  search: [
    "M7 3.5h5.2a3.5 3.5 0 0 1 3.5 3.5v5.2a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V7A3.5 3.5 0 0 1 7 3.5z",
    "M14.2 14.2 20 20",
  ],
  x: ["M7 7l10 10M17 7 7 17"],
  check: ["M5 12.5 9.2 16.8 19 7"],
  "chevron-down": ["M7 10l5 5 5-5"],
  "chevron-up": ["M7 14l5-5 5 5"],
  "chevron-left": ["M14 7 9 12l5 5"],
  "chevron-right": ["M10 7l5 5-5 5"],
  mic: [
    "M12 3.5a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0v-4a3 3 0 0 1 3-3z",
    "M7.5 11a4.5 4.5 0 0 0 9 0M12 15.5V19M9.2 19h5.6",
  ],
  globe: [
    "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z",
    "M4.5 12h15M12 4.5c2 1.9 3.1 4.5 3.1 7.5s-1.1 5.6-3.1 7.5c-2-1.9-3.1-4.5-3.1-7.5s1.1-5.6 3.1-7.5",
  ],
  image: [
    "M6 5.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z",
    "M8.5 10a1.2 1.2 0 1 0 0.01 0M4.5 15.5 8.2 12.6 11 15l2.6-2.8L19.5 16",
  ],
  file: [
    "M7.5 4.5H13L18 9.5V18.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18.5V6a1.5 1.5 0 0 1 1.5-1.5z",
    "M13 4.5V9.5H18",
  ],
  download: ["M12 4.5v9M8.2 10.2 12 14l3.8-3.8M5.5 18.5h13"],
  copy: [
    "M9 8.5h8.5a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 18V10A1.5 1.5 0 0 1 9 8.5z",
    "M7.5 15.5H6.5A1.5 1.5 0 0 1 5 14V6.5A1.5 1.5 0 0 1 6.5 5H14a1.5 1.5 0 0 1 1.5 1.5V7.5",
  ],
  sun: [
    "M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z",
    "M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6 6l1.3 1.3M16.7 16.7 18 18M18 6l-1.3 1.3M7.3 16.7 6 18",
  ],
  moon: ["M15.5 4.2A7.2 7.2 0 1 0 18.8 16 5.6 5.6 0 0 1 15.5 4.2z"],
  monitor: [
    "M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5z",
    "M8 19h8M12 15.5V19",
  ],
  "arrow-left": ["M19 12H6.5M6.5 12 11 7.5M6.5 12 11 16.5"],
  spark: ["M12 3.2 13.6 9.1 19.5 10.6 13.6 12.1 12 18 10.4 12.1 4.5 10.6 10.4 9.1 12 3.2z"],
  sidebar: [
    "M5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5 5z",
    "M9 5v14",
  ],
  sliders: ["M4 8h16M4 16h16", "M8 8a2 2 0 1 0 .01 0M16 16a2 2 0 1 0 .01 0"],
  message: [
    "M5.5 6.5h13A1.5 1.5 0 0 1 20 8v6.5a1.5 1.5 0 0 1-1.5 1.5H9.2L5.5 19.2V16H5.5A1.5 1.5 0 0 1 4 14.5V8a1.5 1.5 0 0 1 1.5-1.5z",
  ],
  folder: [
    "M4 8.2V17.5A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 18.5 8H12l-1.8-2.4H5.5A1.5 1.5 0 0 0 4 7.1v1.1z",
  ],
  send: ["M5 12.2 18.8 5.8 12.6 18.6 11 13.2 5 12.2z"],
} as const;

export const cxIconNames = Object.keys(glyphs) as CxIconName[];
export type CxIconName = keyof typeof glyphs;

type CxIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: CxIconName;
  size?: number;
  strokeWidth?: number;
  title?: string;
};

export function CxIcon({
  name,
  size = 16,
  strokeWidth = 1.5,
  title,
  className,
  ...props
}: CxIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {glyphs[name].map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}
