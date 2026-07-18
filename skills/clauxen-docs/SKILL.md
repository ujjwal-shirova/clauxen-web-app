---
name: clauxen-docs
description: >-
  Clauxen documentation library under docs/: when and how to update system docs, deep dive, gotchas, and README index. Use when writing or updating docs, after architecture changes, or when the user asks to document a feature.
---

# Clauxen docs

## Entrypoints

- Index: `docs/README.md`
- Deep dive: `docs/complete-product-deep-dive.md`
- Gotchas: `docs/reference/gotchas-encyclopedia.md`

## When to update

After durable behavior changes (chat hydrate rules, env shape, Worker APIs, auth flows, ownership).

## How

1. Update the focused file under `docs/systems/`, `docs/reference/`, or `docs/ops/`.
2. If FAQ/decision-level, also patch `complete-product-deep-dive.md` or gotchas.
3. Keep path citations accurate to real modules.
4. Mirror operational gotchas into `brain/MEMORY.md` (short, dated).
5. **Never** put secrets in docs.

## Style

Factual, path-accurate, tables for inventories. Prefer updating existing files over sprawling duplicates.

## Additional resources

- [reference.md](reference.md)
