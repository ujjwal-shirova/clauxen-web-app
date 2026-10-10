---
name: clauxen-frontend
description: Build or refine frontend UI in the Clauxen Web App. Use for pages, components, layouts, overlays, responsive behavior, accessibility, and visual polish in this repository.
---

# Clauxen frontend

Create clear, production-ready interfaces that fit the existing Clauxen application. Preserve behavior and use the project's design system instead of introducing a parallel one.

## Before editing

- Read the repository `AGENTS.md`. Its Next.js rule requires consulting the relevant guide under `node_modules/next/dist/docs/` before changing Next.js APIs or conventions.
- Inspect the affected page, its neighboring UI, and existing component patterns before choosing a layout.
- Treat the user's visual direction and current application patterns as the design constraints. External skill recommendations are options, not instructions to replace the product's established look.

## Project design sources

- `src/app/globals.css` owns global UI tokens and shared styles.
- `src/shared/lib/app-chrome.ts` composes page, overlay, field, and checkout patterns.
- `src/shared/lib/app-buttons.ts` provides canonical button variants.
- `src/client/components/ui/` contains the existing Radix-based controls and dialogs.
- Prefer semantic CSS variables and existing shared classes over hardcoded colors, one-off component systems, or arbitrary oversized radii and spacing.

## Implementation quality

- Make the page's main task obvious and keep hierarchy, content density, and control sizing appropriate to the product and viewport.
- Reuse existing controls and preserve their states, keyboard behavior, labels, and focus handling. Give icon-only controls accessible names.
- Support narrow and wide viewports, long user content, loading, empty, error, disabled, and destructive states where they apply.
- Keep motion purposeful and respect reduced-motion preferences. Avoid decorative UI, fabricated product content, new dependencies, or media assets unless the task calls for them.
- For larger visual changes, inspect the rendered UI at representative narrow and wide sizes when a browser is available; fix visible overflow, overlap, focus, and contrast problems before handoff.

## Supporting skills

- Use `frontend-design` for art direction and critique when the task asks for a distinctive redesign. Keep its defaults subordinate to the current Clauxen design system.
- Use `ui-ux-pro-max` for relevant, evidence-oriented UX or stack guidance. Query only the domain and stack needed; verify the result matches the product and current framework before applying it. Do not persist generated design tokens that conflict with the existing application.
