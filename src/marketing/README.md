# Clauxen marketing website

Public marketing surfaces — Claude/ChatGPT-style routes, Clauxen brand & zinc UI.

## Layout

```
src/marketing/
  content/           # page copy (one module per area)
    overview.ts
    plans.ts
    download.ts
    work.ts
    codex.ts
    features.ts
    product.ts
    business.ts
    solutions.ts
    core.ts
    hubs.ts
    index.ts         # registry
    _helpers.ts
  components/
    sections/        # hero, features, plans, faq, …
    marketing-shell.tsx
    site-header.tsx
    site-footer.tsx
  lib/
    types.ts
    site.ts
    public-paths.ts  # Edge middleware allowlist
src/app/(marketing)/
  layout.tsx
  [...slug]/page.tsx
```

## Routing (1A)

| Surface | URL |
|---------|-----|
| Chat app | `/`, `/new`, `/c/[id]` |
| In-app pricing overlay | `/pricing` → `#pricing` |
| Marketing pricing | `/plans` |
| Marketing pages | `/overview`, `/product/*`, `/solutions/*`, … |

All marketing paths are **public** (no login) via `isMarketingPublicPath`.

## Design notes (from Claude.com)

- Brand-forward hero, one short subtitle, two CTAs
- Capability grids (3–6 items), one job per section
- Plans as clear cards; FAQ as disclosure list
- Minimal hubs for long-tail routes
