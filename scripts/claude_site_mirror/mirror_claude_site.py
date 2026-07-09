#!/usr/bin/env python3
"""
Mirror https://claude.com into ./website with rendered HTML, assets, and DevTools-style DOM trees.

Discovery order:
  1. sitemap.xml (primary — robots.txt points here)
  2. Optional same-origin link crawl from rendered pages

Usage:
  pip install -r scripts/claude_site_mirror/requirements.txt
  playwright install chromium
  python scripts/claude_site_mirror/mirror_claude_site.py --max-pages 25
  python scripts/claude_site_mirror/mirror_claude_site.py --all --locale en
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse
from xml.etree import ElementTree

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

import httpx
from aria2_downloader import aria2_available, run_aria2_batch
from bs4 import BeautifulSoup
from playwright.async_api import Browser, Page, Response, async_playwright

BASE_URL = "https://claude.com"
SITEMAP_URL = f"{BASE_URL}/sitemap.xml"
LOCALE_PREFIXES = ("/ja", "/de", "/fr", "/ko", "/it")
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "website"


@dataclass
class PageRecord:
    url: str
    path: str
    title: str = ""
    status: int = 0
    saved_html: str = ""
    saved_dom_tree: str = ""
    saved_resources: str = ""
    asset_count: int = 0
    error: str | None = None


@dataclass
class MirrorState:
    discovered: list[str] = field(default_factory=list)
    completed: list[PageRecord] = field(default_factory=list)
    failed: list[PageRecord] = field(default_factory=list)
    assets_saved: dict[str, str] = field(default_factory=dict)
    asset_jobs: dict[str, Path] = field(default_factory=dict)


def normalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.netloc and parsed.netloc not in ("claude.com", "www.claude.com"):
        raise ValueError(f"off-domain: {url}")
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc or "claude.com"
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return urlunparse((scheme, netloc, path, "", "", ""))


def is_same_origin(url: str) -> bool:
    try:
        host = urlparse(url).netloc
        return host in ("", "claude.com", "www.claude.com")
    except Exception:
        return False


def locale_of_path(path: str) -> str | None:
    for loc in LOCALE_PREFIXES:
        if path == loc or path.startswith(loc + "/"):
            return loc.lstrip("/")
    return None


def filter_urls(urls: list[str], locale: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in urls:
        try:
            url = normalize_url(raw)
        except ValueError:
            continue
        path = urlparse(url).path or "/"
        loc = locale_of_path(path)
        if locale == "en" and loc is not None:
            continue
        if locale != "all" and locale != "en" and loc != locale:
            continue
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
    return sorted(out)


def fetch_sitemap_urls(client: httpx.Client) -> list[str]:
    res = client.get(SITEMAP_URL)
    res.raise_for_status()
    root = ElementTree.fromstring(res.text)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [el.text.strip() for el in root.findall(".//sm:loc", ns) if el.text]
    if not locs:
        locs = [el.text.strip() for el in root.iter() if el.tag.endswith("loc") and el.text]
    return locs


def url_to_page_dir(base_out: Path, url: str) -> Path:
    path = urlparse(url).path or "/"
    if path == "/":
        return base_out / "pages" / "index"
    clean = path.strip("/")
    return base_out / "pages" / clean


def url_to_asset_path(base_out: Path, asset_url: str) -> Path:
    parsed = urlparse(asset_url)
    rel = parsed.path.lstrip("/")
    if not rel:
        rel = "asset-root"
    if parsed.query:
        digest = hashlib.sha1(parsed.query.encode()).hexdigest()[:10]
        rel = f"{rel}__q_{digest}"
    return base_out / "assets" / rel


async def extract_dom_tree(page: Page, max_depth: int = 12, max_nodes: int = 4000) -> list[dict[str, Any]]:
    """DevTools Elements-style tree: tag, attrs, children (no text nodes)."""
    script = """
    ([maxDepth, maxNodes]) => {
      const skip = new Set(['script','style','noscript','svg','path']);
      let count = 0;
      function node(el, depth) {
        if (!el || count >= maxNodes) return null;
        const tag = el.tagName ? el.tagName.toLowerCase() : null;
        if (!tag || skip.has(tag)) return null;
        count += 1;
        const attrs = {};
        for (const a of el.attributes || []) {
          if (a.name === 'class' || a.name === 'id' || a.name.startsWith('data-') || a.name === 'role' || a.name === 'href' || a.name === 'src') {
            attrs[a.name] = a.value;
          }
        }
        const out = { tag, attrs };
        if (depth < maxDepth && el.children && el.children.length) {
          const kids = [];
          for (const c of el.children) {
            const child = node(c, depth + 1);
            if (child) kids.push(child);
            if (count >= maxNodes) break;
          }
          if (kids.length) out.children = kids;
        }
        return out;
      }
      return node(document.documentElement, 0);
    }
    """
    return await page.evaluate(script, [max_depth, max_nodes])


def extract_resources(html: str, page_url: str) -> dict[str, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    resources: dict[str, list[str]] = {
        "stylesheets": [],
        "scripts": [],
        "images": [],
        "fonts": [],
        "preconnect": [],
        "other": [],
    }

    for link in soup.find_all("link"):
        href = link.get("href")
        if not href:
            continue
        abs_url = urljoin(page_url, href)
        rel = (link.get("rel") or [""])[0] if isinstance(link.get("rel"), list) else link.get("rel", "")
        if rel == "stylesheet" or link.get("as") == "style":
            resources["stylesheets"].append(abs_url)
        elif rel == "preconnect":
            resources["preconnect"].append(abs_url)
        elif link.get("as") == "font":
            resources["fonts"].append(abs_url)
        else:
            resources["other"].append(abs_url)

    for script in soup.find_all("script"):
        src = script.get("src")
        if src:
            resources["scripts"].append(urljoin(page_url, src))

    for img in soup.find_all("img"):
        src = img.get("src")
        if src:
            resources["images"].append(urljoin(page_url, src))

    for key in resources:
        deduped = []
        seen: set[str] = set()
        for u in resources[key]:
            if u not in seen:
                seen.add(u)
                deduped.append(u)
        resources[key] = deduped
    return resources


def rewrite_html_for_local(html: str, page_url: str, asset_map: dict[str, str]) -> str:
    """Point same-origin asset URLs to local ./assets/ paths."""
    soup = BeautifulSoup(html, "html.parser")

    def rewrite_attr(tag: Any, attr: str) -> None:
        val = tag.get(attr)
        if not val or val.startswith(("data:", "mailto:", "javascript:", "#")):
            return
        abs_url = urljoin(page_url, val)
        if abs_url in asset_map:
            tag[attr] = asset_map[abs_url]

    for tag in soup.find_all(["link", "script", "img", "source", "use"]):
        for attr in ("href", "src", "xlink:href"):
            rewrite_attr(tag, attr)

    # Make offline file openable: inject <base> only when missing
    if not soup.head:
        head = soup.new_tag("head")
        if soup.html:
            soup.html.insert(0, head)
    if soup.head and not soup.head.find("base"):
        base = soup.new_tag("base")
        base["href"] = "./"
        soup.head.insert(0, base)

    return str(soup)


def queue_asset(state: MirrorState, url: str, dest: Path, website_root: Path) -> str | None:
    """Register asset for aria2c batch; returns relative assets/ path."""
    if url in state.assets_saved:
        return state.assets_saved[url]
    state.asset_jobs[url] = dest
    rel = dest.relative_to(website_root / "assets").as_posix()
    state.assets_saved[url] = rel
    return rel


def is_downloadable_asset(url: str) -> bool:
    if not url or url.startswith(("data:", "blob:", "javascript:", "mailto:")):
        return False
    return is_same_origin(url) or url.startswith(BASE_URL)


def build_asset_map(
    asset_urls: set[str],
    state: MirrorState,
    out_dir: Path,
) -> dict[str, str]:
    asset_map: dict[str, str] = {}
    for asset_url in asset_urls:
        if not is_downloadable_asset(asset_url):
            continue
        dest = url_to_asset_path(out_dir, asset_url)
        rel = queue_asset(state, asset_url, dest, out_dir)
        if rel:
            asset_map[asset_url] = (Path("..") / "assets" / rel).as_posix()
    return asset_map


def run_prettier(out_dir: Path, root: Path) -> int:
    prettier = root / "node_modules" / ".bin" / "prettier"
    if not prettier.is_file():
        print("prettier not installed — run: npm install")
        return 1
    targets = [
        str(out_dir / "index.html"),
        str(out_dir / "pages"),
        str(out_dir / "manifest.json"),
        str(out_dir / "discovered-urls.json"),
    ]
    cmd = [str(prettier), "--write", "--log-level", "warn", *targets]
    print("\nPrettier formatting mirrored pages…")
    return subprocess.run(cmd, cwd=root, check=False).returncode


async def mirror_page(
    browser: Browser,
    url: str,
    out_dir: Path,
    state: MirrorState,
    timeout_ms: int,
) -> PageRecord:
    record = PageRecord(url=url, path=urlparse(url).path or "/")
    page_dir = url_to_page_dir(out_dir, url)
    page_dir.mkdir(parents=True, exist_ok=True)

    context = await browser.new_context(user_agent=USER_AGENT, locale="en-US")
    page = await context.new_page()
    pending_assets: dict[str, Path] = {}

    async def on_response(response: Response) -> None:
        try:
            rurl = response.url
            if not is_downloadable_asset(rurl):
                return
            ctype = (response.headers.get("content-type") or "").lower()
            if response.status >= 400:
                return
            if not any(
                t in ctype
                for t in ("text/css", "javascript", "image/", "font/", "woff", "json")
            ) and not rurl.endswith((".css", ".js", ".woff2", ".png", ".jpg", ".svg", ".webp")):
                return
            dest = url_to_asset_path(out_dir, rurl)
            pending_assets[rurl] = dest
        except Exception:
            pass

    page.on("response", on_response)

    try:
        response = await page.goto(url, wait_until="load", timeout=timeout_ms)
        record.status = response.status if response else 0
        try:
            await page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass
        await page.wait_for_timeout(500)
        record.title = await page.title()
        html = await page.content()
        dom_tree = await extract_dom_tree(page)
        resources = extract_resources(html, url)

        asset_urls: set[str] = set(pending_assets.keys())
        for group in ("stylesheets", "scripts", "fonts", "images"):
            asset_urls.update(resources.get(group, []))
        asset_map = build_asset_map(asset_urls, state, out_dir)
        record.asset_count = len(asset_urls)

        local_html = rewrite_html_for_local(html, url, asset_map)

        html_path = page_dir / "page.html"
        dom_path = page_dir / "dom-tree.json"
        res_path = page_dir / "resources.json"
        meta_path = page_dir / "meta.json"

        html_path.write_text(local_html, encoding="utf-8")
        dom_path.write_text(json.dumps(dom_tree, indent=2), encoding="utf-8")
        res_path.write_text(json.dumps(resources, indent=2), encoding="utf-8")
        meta_path.write_text(
            json.dumps(
                {
                    "url": url,
                    "title": record.title,
                    "status": record.status,
                    "saved_html": str(html_path.relative_to(out_dir)),
                    "saved_dom_tree": str(dom_path.relative_to(out_dir)),
                    "saved_resources": str(res_path.relative_to(out_dir)),
                    "asset_count": record.asset_count,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

        record.saved_html = str(html_path.relative_to(out_dir))
        record.saved_dom_tree = str(dom_path.relative_to(out_dir))
        record.saved_resources = str(res_path.relative_to(out_dir))
    except Exception as exc:
        record.error = str(exc)
    finally:
        await context.close()

    return record


async def discover_from_page(browser: Browser, seed: str, limit: int) -> list[str]:
    found: set[str] = {normalize_url(seed)}
    context = await browser.new_context(user_agent=USER_AGENT)
    page = await context.new_page()
    try:
        await page.goto(seed, wait_until="load", timeout=60_000)
        hrefs = await page.eval_on_selector_all(
            "a[href]",
            "els => els.map(e => e.href)",
        )
        for href in hrefs:
            if not href or not is_same_origin(href):
                continue
            try:
                found.add(normalize_url(href))
            except ValueError:
                continue
            if len(found) >= limit:
                break
    finally:
        await context.close()
    return sorted(found)


async def run_mirror(args: argparse.Namespace) -> int:
    out_dir: Path = args.output.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    state = MirrorState()

    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(headers=headers, timeout=30.0, follow_redirects=True) as sync_client:
        print(f"Fetching sitemap: {SITEMAP_URL}")
        urls = fetch_sitemap_urls(sync_client)

    urls = filter_urls(urls, args.locale)
    state.discovered = urls

    if args.crawl:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            extra = await discover_from_page(browser, BASE_URL, args.crawl_limit)
            await browser.close()
        merged = filter_urls(list(dict.fromkeys(urls + extra)), args.locale)
        state.discovered = merged

    # Homepage first, then cap
    home = normalize_url(BASE_URL)
    if home in state.discovered:
        state.discovered = [home] + [u for u in state.discovered if u != home]
    if args.max_pages > 0:
        state.discovered = state.discovered[: args.max_pages]

    print(f"Pages to mirror: {len(state.discovered)} (locale={args.locale})")
    (out_dir / "discovered-urls.json").write_text(
        json.dumps(state.discovered, indent=2),
        encoding="utf-8",
    )

    sem = asyncio.Semaphore(args.concurrency)
    root = Path(__file__).resolve().parents[2]

    if not args.skip_aria2 and not aria2_available():
        print("Warning: aria2c not found — install with: brew install aria2")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        async def worker(url: str) -> None:
            async with sem:
                rec = await mirror_page(
                    browser,
                    url,
                    out_dir,
                    state,
                    args.timeout_ms,
                )
                if rec.error:
                    state.failed.append(rec)
                    print(f"  FAIL {url} — {rec.error}")
                else:
                    state.completed.append(rec)
                    print(f"  OK   {url} → {rec.saved_html}")

        started = time.time()
        await asyncio.gather(*(worker(u) for u in state.discovered))
        await browser.close()

    # Phase 2: aria2c batch download (max bandwidth)
    aria_ok = aria_fail = 0
    if not args.skip_aria2 and state.asset_jobs:
        try:
            aria_ok, aria_fail = run_aria2_batch(
                state.asset_jobs,
                connections=args.aria2_connections,
                parallel=args.aria2_parallel,
                split=args.aria2_splits,
            )
            print(f"aria2c done: {aria_ok} ok, {aria_fail} missing/failed")
        except RuntimeError as exc:
            print(f"aria2c error: {exc}")
            if not args.allow_aria2_fail:
                return 1

    if not args.skip_prettier:
        fmt_rc = run_prettier(out_dir, root)
        if fmt_rc != 0:
            print(f"prettier exited {fmt_rc}")

    manifest = {
        "base_url": BASE_URL,
        "locale": args.locale,
        "started_at": started,
        "duration_sec": round(time.time() - started, 2),
        "discovered_count": len(state.discovered),
        "completed_count": len(state.completed),
        "failed_count": len(state.failed),
        "assets_count": len(state.assets_saved),
        "aria2_ok": aria_ok,
        "aria2_failed": aria_fail,
        "pages": [asdict(r) for r in state.completed],
        "failed": [asdict(r) for r in state.failed],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Root index for navigation
    links = "\n".join(
        f'<li><a href="{r.saved_html}">{r.title or r.url}</a> <code>{r.url}</code></li>'
        for r in state.completed
    )
    (out_dir / "index.html").write_text(
        f"""<!doctype html>
<html><head><meta charset="utf-8"><title>claude.com mirror index</title></head>
<body>
<h1>claude.com mirror</h1>
<p>Completed {len(state.completed)} / {len(state.discovered)} pages. Failed: {len(state.failed)}.</p>
<ul>{links}</ul>
</body></html>""",
        encoding="utf-8",
    )

    print(
        f"\nDone. {len(state.completed)} ok, {len(state.failed)} failed, "
        f"{len(state.assets_saved)} assets queued, aria2 {aria_ok}/{aria_ok + aria_fail} → {out_dir}"
    )
    return 0 if not state.failed else 1


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Mirror claude.com into ./website")
    p.add_argument("--output", type=Path, default=DEFAULT_OUT)
    p.add_argument("--locale", choices=["en", "all", "ja", "de", "fr", "ko", "it"], default="en")
    p.add_argument("--max-pages", type=int, default=0, help="0 = no limit")
    p.add_argument("--all", action="store_true", help="Mirror all discovered URLs (no max-pages cap)")
    p.add_argument("--concurrency", type=int, default=3)
    p.add_argument("--timeout-ms", type=int, default=90_000)
    p.add_argument("--crawl", action="store_true", help="Also collect same-origin links from homepage")
    p.add_argument("--crawl-limit", type=int, default=200)
    p.add_argument("--skip-aria2", action="store_true", help="Skip aria2c asset batch (HTML only)")
    p.add_argument("--skip-prettier", action="store_true", help="Skip prettier formatting pass")
    p.add_argument("--allow-aria2-fail", action="store_true", help="Continue if aria2c fails")
    p.add_argument("--aria2-connections", type=int, default=16, help="aria2 -x max conn per server")
    p.add_argument("--aria2-parallel", type=int, default=32, help="aria2 -j parallel downloads")
    p.add_argument("--aria2-splits", type=int, default=16, help="aria2 -s splits per file")
    args = p.parse_args(argv)
    if args.all:
        args.max_pages = 0
    elif args.max_pages == 0 and not args.all:
        args.max_pages = 50  # ponytail: safe default; use --all for full sitemap
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    return asyncio.run(run_mirror(args))


if __name__ == "__main__":
    raise SystemExit(main())
