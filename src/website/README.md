# Clauxen marketing website

Public marketing surfaces live in `src/website/` (content + UI) and
`src/app/(marketing)/` (App Router).

## Routing (option 1A)

| Surface | URL |
|---------|-----|
| Chat app | `/`, `/new`, `/c/[id]` |
| In-app pricing overlay | `/pricing` → `#pricing` |
| Marketing pricing | `/plans` |
| Marketing pages | `/overview`, `/product/*`, `/solutions/*`, … |

Catch-all: `src/app/(marketing)/[...slug]/page.tsx`  
Content: `src/website/content/pages.ts`  
Auth: `isMarketingPublicPath` in `src/website/lib/public-paths.ts` (wired into Edge middleware) — no login required.

## Regenerate path list

```bash
node -e "import('./src/website/content/pages.ts').then(m=>console.log(m.allMarketingPaths().join('\n')))"
```

Do not put marketing at `/apps` or `/library` — those are app routes.
