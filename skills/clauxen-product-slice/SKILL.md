---
name: clauxen-product-slice
description: >-
  Clauxen incremental product build workflow: pick one roadmap slice, implement end-to-end, update docs/MEMORY, avoid boiling the ocean. Use when the user starts a new feature area (auth, billing, settings, projects, chat, skills, plugins, gifts) or asks to build the next slice.
---

# Clauxen product slice

## Philosophy

Do **not** implement the full roadmap at once. Wire one vertical slice when the user asks.

Roadmap (MEMORY): Auth → Onboarding → Billing → Settings → Projects → Chat → Customize/Skills → Plugins → Gifts → …

## Workflow

1. Read `brain/MEMORY.md` + relevant `skills/clauxen-*` + `docs/systems/*`.
2. Define slice boundary (API + UI + DB + env) — one shippable cut.
3. Implement against existing patterns (repos/services/hooks).
4. Respect triple-stack ownership (`clauxen-architecture`).
5. Add/adjust tests for lib logic.
6. Update `docs/` if durable behavior changed.
7. Record decision/gotcha in MEMORY when durable.
8. Commit/push only when user wants (verified signing).

## Anti-patterns

- Scaffolding every unfinished surface “while we’re here”
- New cache plane duplicating an existing owner
- Path-based settings overlays
- Hardcoded provider URLs/keys

## Additional resources

- [examples.md](examples.md)
- `docs/guides/contributing.md`
