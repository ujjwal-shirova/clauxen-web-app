# Claude.com site mirror

Mirrors [claude.com](https://claude.com/) into `./website/` using Playwright (rendered DOM like DevTools), **aria2c** for fast asset downloads, and **Prettier** for formatted HTML/JSON.

## Setup

```bash
brew install aria2          # fast parallel downloads
pip install -r scripts/claude_site_mirror/requirements.txt
playwright install chromium
npm install                 # prettier (devDependency)
```

## Run

```bash
# Default: English sitemap, first 50 pages
./scripts/claude_site_mirror/run.sh

# Full English mirror (~1641 pages) — Playwright render + aria2c assets + prettier
./scripts/claude_site_mirror/run.sh --all --locale en --concurrency 6 \
  --aria2-parallel 32 --aria2-connections 16

# HTML/DOM only (skip aria2c)
./scripts/claude_site_mirror/run.sh --max-pages 10 --skip-aria2

# Re-format existing mirror
npx prettier --write website/pages website/index.html website/manifest.json
```

## Pipeline

1. **Discover** URLs from `sitemap.xml` (robots.txt canonical source)
2. **Render** each page with Playwright → `page.html`, `dom-tree.json`, `resources.json`
3. **Download** all assets in one **aria2c** batch (`-x16 -j32`, live progress in terminal)
4. **Format** all pages with Prettier

## Output layout

```
website/
  index.html
  manifest.json
  discovered-urls.json
  pages/<path>/page.html      # formatted HTML
  pages/<path>/dom-tree.json  # DevTools Elements-style tree
  pages/<path>/resources.json
  pages/<path>/meta.json
  assets/                     # aria2c downloads (_next/static, fonts, …)
```

## Notes

- Personal/reference use; Anthropic content remains their copyright.
- Does not commit to git by default.
