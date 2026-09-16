#!/usr/bin/env python3
"""Generate src/marketing/lib/pages-manifest.ts from website/discovered-urls.json"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[2]
URLS_FILE = REPO / "website" / "discovered-urls.json"
OUT_FILE = REPO / "src" / "marketing" / "lib" / "pages-manifest.ts"
ROUTES_FILE = REPO / "src" / "marketing" / "lib" / "marketing-routes.ts"
APP_PREFIX = "src/app/(marketing)/"

# App routes that must stay auth-gated — never treat as public marketing.
APP_RESERVED_SEGMENTS = frozenset(
    {
        "api",
        "auth",
        "c",
        "checkout",
        "connect",
        "connectors",
        "customize",
        "library",
        "login",
        "onboarding",
        "plugins",
        "projects",
        "share",
        "signup",
        "website-plan",
    }
)

PHASE_META = [
    {"id": 0, "name": "foundation", "title": "Foundation", "description": "Layout, tokens, shared components, routing shell"},
    {"id": 1, "name": "core-marketing", "title": "Core marketing", "description": "Home, pricing, download, chrome, key landers"},
    {"id": 2, "name": "product", "title": "Product", "description": "Product overview, Cowork, Code, Design, Security, Science, Tag"},
    {"id": 3, "name": "solutions", "title": "Solutions", "description": "Industry and use-case solution pages"},
    {"id": 4, "name": "platform-ecosystem", "title": "Platform & ecosystem", "description": "API, marketplace, partners, programs, skills"},
    {"id": 5, "name": "blog-shell", "title": "Blog shell", "description": "Blog index, categories, product blogs, use-case hubs"},
    {"id": 6, "name": "blog-posts", "title": "Blog posts", "description": "Individual /blog/{slug} articles"},
    {"id": 7, "name": "resources", "title": "Resources", "description": "Courses, tutorials, use-case library"},
    {"id": 8, "name": "connectors", "title": "Connectors", "description": "Connector directory and detail pages"},
    {"id": 9, "name": "plugins", "title": "Plugins", "description": "Plugin directory and detail pages"},
    {"id": 10, "name": "customers", "title": "Customers", "description": "Customer stories"},
    {"id": 11, "name": "code-with-claude", "title": "Code with Claude", "description": "Events and city pages"},
    {"id": 12, "name": "misc", "title": "Misc & utilities", "description": "Contact sales, LP, forms, unsubscribe, edge pages"},
]

PHASE_BY_SEGMENT: dict[str, int] = {
    "(home)": 1,
    "pricing": 1,
    "download": 1,
    "claude-for-chrome": 1,
    "claude-for-microsoft-365": 1,
    "fast-mode": 1,
    "import-memory": 1,
    "problem-solvers": 1,
    "product": 2,
    "solutions": 3,
    "healthcare-administration": 3,
    "platform": 4,
    "partners": 4,
    "ecosystem": 4,
    "marketplace-partners": 4,
    "marketplace-contact-sales": 4,
    "skills": 4,
    "regional-compliance": 4,
    "programs": 4,
    "community": 4,
    "blog-category": 5,
    "blog-product": 5,
    "blog-usecases": 5,
    "resources": 7,
    "connectors": 8,
    "plugins": 9,
    "customers": 10,
    "code-with-claude": 11,
    "contact-sales": 12,
    "lp": 12,
    "form": 12,
    "newsletter": 12,
    "office-hours": 12,
    "app-unavailable-in-region": 12,
    "unsubscribe": 12,
}


def segment(path: str) -> str:
    if path == "/":
        return "(home)"
    return path.strip("/").split("/")[0]


def assign_phase(path: str) -> int:
    seg = segment(path)
    if seg == "blog":
        parts = path.strip("/").split("/")
        return 5 if len(parts) <= 1 else 6
    return PHASE_BY_SEGMENT.get(seg, 12)


def mirror_path(path: str) -> str:
    return "pages/index" if path == "/" else "pages/" + path.strip("/")


def marketing_app(rel: str) -> str:
    return APP_PREFIX + rel.removeprefix("app/")


def app_route(path: str) -> tuple[str, str, tuple[str, ...]]:
    if path == "/":
        return "static", marketing_app("app/page.tsx"), ()
    parts = path.strip("/").split("/")
    seg = parts[0]

    if seg == "blog":
        return ("static", marketing_app("app/blog/page.tsx"), ()) if len(parts) == 1 else (
            "dynamic",
            marketing_app("app/blog/[slug]/page.tsx"),
            tuple(parts[1:]),
        )
    if seg == "blog-category":
        return "dynamic", marketing_app("app/blog-category/[category]/page.tsx"), (parts[1],)
    if seg == "blog-product":
        return "dynamic", marketing_app("app/blog-product/[slug]/page.tsx"), (parts[1],)
    if seg == "blog-usecases":
        return "dynamic", marketing_app("app/blog-usecases/[slug]/page.tsx"), (parts[1],)
    if seg == "connectors":
        return ("static", marketing_app("app/connectors/page.tsx"), ()) if len(parts) == 1 else (
            "dynamic",
            marketing_app("app/connectors/[slug]/page.tsx"),
            (parts[1],),
        )
    if seg == "plugins":
        return ("static", marketing_app("app/plugins/page.tsx"), ()) if len(parts) == 1 else (
            "dynamic",
            marketing_app("app/plugins/[slug]/page.tsx"),
            (parts[1],),
        )
    if seg == "customers":
        return ("static", marketing_app("app/customers/page.tsx"), ()) if len(parts) == 1 else (
            "dynamic",
            marketing_app("app/customers/[slug]/page.tsx"),
            (parts[1],),
        )
    if seg == "resources":
        if len(parts) == 1:
            return "static", marketing_app("app/resources/page.tsx"), ()
        if parts[1] == "use-cases":
            return (
                ("static", marketing_app("app/resources/use-cases/page.tsx"), ())
                if len(parts) == 2
                else ("dynamic", marketing_app("app/resources/use-cases/[slug]/page.tsx"), (parts[2],))
            )
        if parts[1] in ("courses", "tutorials"):
            return "static", marketing_app(f"app/resources/{parts[1]}/page.tsx"), ()
        if parts[1] == "tutorials-category":
            return "dynamic", marketing_app("app/resources/tutorials-category/[slug]/page.tsx"), (parts[2],)
    if seg == "code-with-claude":
        return ("static", marketing_app("app/code-with-claude/page.tsx"), ()) if len(parts) == 1 else (
            "dynamic",
            marketing_app("app/code-with-claude/[slug]/page.tsx"),
            (parts[1],),
        )
    if seg == "contact-sales":
        return ("static", marketing_app("app/contact-sales/page.tsx"), ()) if len(parts) == 1 else (
            "dynamic",
            marketing_app("app/contact-sales/[slug]/page.tsx"),
            (parts[1],),
        )
    if seg == "solutions":
        if len(parts) == 3 and parts[1] == "life-sciences":
            return "static", marketing_app(f"app/solutions/life-sciences/{parts[2]}/page.tsx"), ()
        return "dynamic", marketing_app("app/solutions/[slug]/page.tsx"), (parts[1],)
    if seg == "platform":
        if len(parts) == 1:
            return "static", marketing_app("app/platform/page.tsx"), ()
        if parts[1] == "api":
            return "static", marketing_app("app/platform/api/page.tsx"), ()
        if parts[1] == "marketplace":
            return (
                ("static", marketing_app("app/platform/marketplace/page.tsx"), ())
                if len(parts) == 2
                else ("dynamic", marketing_app("app/platform/marketplace/[slug]/page.tsx"), (parts[2],))
            )
    if seg == "product":
        if len(parts) == 3 and parts[1] == "claude-code" and parts[2] == "enterprise":
            return "static", marketing_app("app/product/claude-code/enterprise/page.tsx"), ()
        return "dynamic", marketing_app("app/product/[slug]/page.tsx"), (parts[1],)
    if seg == "partners" and len(parts) > 1:
        return "dynamic", marketing_app("app/partners/[slug]/page.tsx"), (parts[1],)
    if seg == "lp":
        return "dynamic", marketing_app("app/lp/[slug]/page.tsx"), (parts[1],)
    if seg == "form":
        return "dynamic", marketing_app("app/form/[slug]/page.tsx"), (parts[1],)
    if seg == "programs":
        return "dynamic", marketing_app("app/programs/[slug]/page.tsx"), (parts[1],)
    if seg == "community" and len(parts) > 1:
        return "dynamic", marketing_app("app/community/[slug]/page.tsx"), (parts[1],)
    if seg == "newsletter":
        return "dynamic", marketing_app("app/newsletter/[slug]/page.tsx"), (parts[1],)

    return "static", marketing_app("app/" + "/".join(parts) + "/page.tsx"), ()


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def write_marketing_routes(segments: set[str]) -> None:
    public_segments = sorted(segments - APP_RESERVED_SEGMENTS)
    lines = [
        "/** AUTO-GENERATED — run: npm run website:manifest */",
        "",
        "/** Top-level URL segments served as public marketing pages. */",
        "export const MARKETING_PUBLIC_SEGMENTS = new Set<string>([",
    ]
    for seg in public_segments:
        lines.append(f"  {ts_string(seg)},")
    lines.extend(
        [
            "]);",
            "",
            "/**",
            " * Public marketing paths for auth middleware.",
            " * ponytail: `/` is intentionally excluded until Phase 1 migrates chat home off `/`.",
            " */",
            "export function isMarketingPublicPath(pathname: string): boolean {",
            "  if (pathname === \"/website-plan\") return true;",
            "  const parts = pathname.split(\"/\").filter(Boolean);",
            "  if (parts.length === 0) return false;",
            "  return MARKETING_PUBLIC_SEGMENTS.has(parts[0]!);",
            "}",
            "",
        ]
    )
    ROUTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    ROUTES_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {ROUTES_FILE} ({len(public_segments)} segments)")


def main() -> None:
    urls = json.loads(URLS_FILE.read_text(encoding="utf-8"))
    entries = []
    group_counts: dict[str, int] = defaultdict(int)
    phase_counts: dict[int, int] = defaultdict(int)
    marketing_segments: set[str] = set()

    for url in sorted(urls, key=lambda u: urlparse(u).path):
        path = urlparse(url).path or "/"
        grp = segment(path)
        phase = assign_phase(path)
        kind, app_file, slug_parts = app_route(path)
        slug = slug_parts[-1] if slug_parts else ("index" if path == "/" else path.strip("/").split("/")[-1])
        if path != "/":
            marketing_segments.add(grp if grp != "(home)" else path.strip("/") or "(home)")
            if path != "/":
                marketing_segments.add(path.strip("/").split("/")[0])
        entries.append(
            {
                "path": path,
                "url": url,
                "group": grp,
                "phase": phase,
                "routeKind": kind,
                "appFile": app_file,
                "slug": slug,
                "mirrorPath": mirror_path(path),
            }
        )
        group_counts[grp] += 1
        phase_counts[phase] += 1

    # Normalize segments from URL paths (exclude reserved app segments)
    marketing_segments = {
        path.strip("/").split("/")[0]
        for path in (urlparse(u).path or "/" for u in urls)
        if path != "/"
    } - APP_RESERVED_SEGMENTS

    lines = [
        "/** AUTO-GENERATED — run: npm run website:manifest */",
        f"/** Source: website/discovered-urls.json ({len(entries)} routes) */",
        "",
        "export type RouteKind = \"static\" | \"dynamic\";",
        "",
        "export type PageManifestEntry = {",
        "  /** Canonical URL path e.g. /pricing */",
        "  path: string;",
        "  /** Original claude.com URL */",
        "  url: string;",
        "  /** Top-level segment for grouping */",
        "  group: string;",
        "  /** Build phase 0–12 */",
        "  phase: number;",
        "  routeKind: RouteKind;",
        "  /** Target App Router file under src/app/(marketing)/ */",
        "  appFile: string;",
        "  /** Leaf slug for dynamic routes */",
        "  slug: string;",
        "  /** Reference mirror folder under website/ */",
        "  mirrorPath: string;",
        "};",
        "",
        "export type PhaseDefinition = {",
        "  id: number;",
        "  name: string;",
        "  title: string;",
        "  description: string;",
        "  pageCount: number;",
        "};",
        "",
        "export type RouteGroupDefinition = {",
        "  id: string;",
        "  label: string;",
        "  phase: number;",
        "  pageCount: number;",
        "  dynamic: boolean;",
        "};",
        "",
        "export const TOTAL_PAGES = " + str(len(entries)) + " as const;",
        "",
        "export const BUILD_PHASES: readonly PhaseDefinition[] = " + json.dumps(
            [
                {**p, "pageCount": phase_counts.get(p["id"], 0)}
                for p in PHASE_META
            ],
            indent=2,
        ) + " as const;",
        "",
        "export const ROUTE_GROUPS: readonly RouteGroupDefinition[] = "
        + json.dumps(
            sorted(
                [
                    {
                        "id": g,
                        "label": "Home" if g == "(home)" else g.replace("-", " ").title(),
                        "phase": PHASE_BY_SEGMENT.get(g, assign_phase("/" + g) if g != "(home)" else 1),
                        "pageCount": group_counts[g],
                        "dynamic": group_counts[g] > 3 and g not in ("(home)", "pricing", "download"),
                    }
                    for g in group_counts
                ],
                key=lambda x: (-x["pageCount"], x["id"]),
            ),
            indent=2,
        )
        + " as const;",
        "",
        "export const PAGES: readonly PageManifestEntry[] = [",
    ]

    for e in entries:
        lines.append(
            f"  {{ path: {ts_string(e['path'])}, url: {ts_string(e['url'])}, "
            f"group: {ts_string(e['group'])}, phase: {e['phase']}, "
            f"routeKind: {ts_string(e['routeKind'])}, appFile: {ts_string(e['appFile'])}, "
            f"slug: {ts_string(e['slug'])}, mirrorPath: {ts_string(e['mirrorPath'])} }},"
        )

    lines.extend(
        [
            "] as const;",
            "",
            "export function pagesByPhase(phase: number): PageManifestEntry[] {",
            "  return PAGES.filter((p) => p.phase === phase);",
            "}",
            "",
            "export function pagesByGroup(group: string): PageManifestEntry[] {",
            "  return PAGES.filter((p) => p.group === group);",
            "}",
            "",
            "export function pageByPath(path: string): PageManifestEntry | undefined {",
            "  const norm = path === \"\" ? \"/\" : path.startsWith(\"/\") ? path : `/${path}`;",
            "  return PAGES.find((p) => p.path === norm);",
            "}",
            "",
            "export function uniqueAppFiles(): string[] {",
            "  return [...new Set(PAGES.map((p) => p.appFile))].sort();",
            "}",
            "",
        ]
    )

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    write_marketing_routes(marketing_segments)
    print(f"Wrote {OUT_FILE} ({len(entries)} pages, {len(group_counts)} groups)")


if __name__ == "__main__":
    main()
