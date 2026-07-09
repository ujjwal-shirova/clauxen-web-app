# Claude.com site mirror

Mirrors [claude.com](https://claude.com/) into `./website/` using Playwright (rendered DOM like DevTools) plus asset download.

## Setup

```bash
pip install -r scripts/claude_site_mirror/requirements.txt
playwright install chromium
```

## Run

```bash
# Default: English sitemap pages, first 50 URLs
python scripts/claude_site_mirror/mirror_claude_site.py

# Quick smoke test
python scripts/claude_site_mirror/mirror_claude_site.py --max-pages 10

# Full English mirror (~1641 pages — takes a long time)
python scripts/claude_site_mirror/mirror_claude_site.py --all --locale en --concurrency 4

# All locales from sitemap (~3463 pages)
python scripts/claude_site_mirror/mirror_claude_site.py --all --locale all
```

## Output layout

```
website/
  index.html              # local navigation index
  manifest.json           # crawl summary
  discovered-urls.json    # URLs from sitemap
  pages/
    index/
      page.html           # rendered HTML (assets rewritten to local paths)
      dom-tree.json       # DevTools Elements-style component tree
      resources.json      # stylesheets, scripts, images, fonts
      meta.json
    pricing/
      ...
  assets/
    _next/static/...      # downloaded CSS, JS, fonts, images
```

## Notes

- Respects `robots.txt` (uses official `sitemap.xml`).
- Only mirrors `claude.com` same-origin assets.
- For personal/reference use; Anthropic content remains their copyright.
