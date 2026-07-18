---
name: clauxen-testing
description: >-
  Clauxen testing: npm test (tsx), high-value frontend lib tests, typecheck/lint, manual E2E chat checklist. Use when adding tests, fixing regressions, or verifying chat/auth/billing changes.
---

# Clauxen testing

## Read first

- `docs/guides/testing-guide.md`
- Skill `clauxen-debug-chat` for failure reproduction

## Commands

```bash
npm test
npm run typecheck
npm run lint
```

## Prefer testing

Pure lib modules: dedupe, hydrate, device-cache, follow-up-tags, chat-stream, agent-frames, route-seed, composer-attachments, cloudflare-challenge-post.

## Manual chat checklist

Login → new send → instant `/c/{id}` → orb → stop → edit/branch reload → attach → follow-ups on/off → pin/rename → reload hydrate → settings overlay without blanking chat.

## Do not

Commit Playwright dumps with secrets.
