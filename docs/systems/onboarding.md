# Onboarding

## 1. Purpose

First-run setup after auth collects name/role preferences and marks the user ready for the main app.

---

## 2. Routes & API

- Page: `/onboarding`
- Components: `src/frontend/components/onboarding/*`
- API: `/api/v1/onboarding`
- Steps helper: `src/lib/onboarding-steps.ts`
- Service/repo: `onboarding.service.ts`, `onboarding.repository.ts`

---

## 3. Data

- `onboarding_answers` table
- Profile fields
- Integrity migrations ensure step consistency
- Grandfather migration marks pre-existing users complete

Answers hydrate Settings personalization (name/role).

---

## 4. Flow

1. Auth succeeds (password / OTP / magic / OAuth)
2. If onboarding incomplete → `/onboarding`
3. User completes steps → PATCH/POST onboarding
4. Redirect to `/new`

---

## 5. Related

- [`authentication.md`](./authentication.md)
- [`settings-and-personalization.md`](./settings-and-personalization.md)
