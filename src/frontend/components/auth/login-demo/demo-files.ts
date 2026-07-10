/** Demo-only attachment payloads — never touch main-app upload state. */

export type DemoAttachment = {
  id: string;
  name: string;
  kind: "image" | "pdf" | "doc";
  /** Thumbnail / chip preview (data URL or public path). */
  previewUrl: string;
  /** Finder icon tint */
  accent: string;
};

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PHOTO_A = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="55%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="10" fill="url(#g)"/>
  <circle cx="68" cy="28" r="10" fill="#fef08a" opacity="0.95"/>
  <path d="M0 68 L28 48 L48 60 L72 40 L96 58 L96 96 L0 96 Z" fill="#0f172a" opacity="0.28"/>
  <path d="M0 74 L28 54 L48 66 L72 46 L96 64 L96 96 L0 96 Z" fill="#fff" opacity="0.35"/>
</svg>`);

const PHOTO_B = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="10" fill="url(#g)"/>
  <rect x="14" y="22" width="68" height="52" rx="6" fill="#fff" opacity="0.22"/>
  <rect x="22" y="30" width="52" height="8" rx="2" fill="#fff" opacity="0.55"/>
  <rect x="22" y="44" width="40" height="6" rx="2" fill="#fff" opacity="0.4"/>
  <rect x="22" y="56" width="28" height="6" rx="2" fill="#fff" opacity="0.3"/>
</svg>`);

const PDF_PREVIEW = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="10" fill="#f4f4f5"/>
  <rect x="22" y="14" width="52" height="68" rx="4" fill="#fff" stroke="#e4e4e7"/>
  <path d="M54 14 L74 34 L54 34 Z" fill="#fecaca"/>
  <rect x="30" y="44" width="36" height="4" rx="1.5" fill="#d4d4d8"/>
  <rect x="30" y="54" width="28" height="4" rx="1.5" fill="#d4d4d8"/>
  <rect x="30" y="64" width="32" height="4" rx="1.5" fill="#d4d4d8"/>
  <rect x="30" y="74" width="18" height="10" rx="2" fill="#ef4444"/>
  <text x="39" y="82" text-anchor="middle" font-size="7" font-family="system-ui,sans-serif" font-weight="700" fill="#fff">PDF</text>
</svg>`);

const DOC_PREVIEW = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="10" fill="#eff6ff"/>
  <rect x="22" y="14" width="52" height="68" rx="4" fill="#fff" stroke="#bfdbfe"/>
  <rect x="30" y="28" width="36" height="5" rx="1.5" fill="#93c5fd"/>
  <rect x="30" y="40" width="30" height="4" rx="1.5" fill="#dbeafe"/>
  <rect x="30" y="50" width="34" height="4" rx="1.5" fill="#dbeafe"/>
  <rect x="30" y="60" width="22" height="4" rx="1.5" fill="#dbeafe"/>
  <rect x="30" y="72" width="20" height="8" rx="2" fill="#3b82f6"/>
  <text x="40" y="78.5" text-anchor="middle" font-size="6.5" font-family="system-ui,sans-serif" font-weight="700" fill="#fff">DOC</text>
</svg>`);

/** Files shown in the demo Finder + dropped into the composer. */
export const DEMO_FINDER_FILES: DemoAttachment[] = [
  {
    id: "receipt",
    name: "Grocery_Receipt.pdf",
    kind: "pdf",
    previewUrl: PDF_PREVIEW,
    accent: "#ef4444",
  },
  {
    id: "budget",
    name: "Family_Budget.docx",
    kind: "doc",
    previewUrl: DOC_PREVIEW,
    accent: "#3b82f6",
  },
  {
    id: "photo-a",
    name: "Homework_Photo.jpg",
    kind: "image",
    previewUrl: PHOTO_A,
    accent: "#0ea5e9",
  },
  {
    id: "photo-b",
    name: "Report_Card.png",
    kind: "image",
    previewUrl: PHOTO_B,
    accent: "#f97316",
  },
];

/** Subset the cursor selects and drags in the docs scene. */
export const DEMO_DRAG_FILE_IDS = ["receipt", "photo-a", "budget"] as const;
