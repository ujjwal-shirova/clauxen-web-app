---
name: clauxen-onboarding
description: >-
  Clauxen first-run onboarding: /onboarding steps, answers persistence, profile hydrate into settings. Use when editing onboarding UI, onboarding API, or post-auth redirects for new users.
---

# Clauxen onboarding

## Read first

- `docs/systems/onboarding.md`
- Skill `clauxen-auth`

## Flow

Auth success → if incomplete → `/onboarding` → steps via `onboarding-steps.ts` → PATCH/POST `/api/v1/onboarding` → `/new`.

Answers hydrate Settings personalization (name/role). Grandfather migration completed historical users.

## Key paths

`src/app/onboarding/page.tsx`, `src/components/onboarding/*`  
`onboarding.service.ts`, `onboarding.repository.ts`, `src/lib/onboarding-steps.ts`
