# Testing Guide

## 1. Unit tests

```bash
npm test
```

Runs `tsx --test` on `src/**/*.test.ts`.

High-value modules:

- `src/frontend/lib/dedupe-chat-messages.test.ts`
- `src/frontend/lib/hydrate-chat-messages.test.ts`
- `src/frontend/lib/device-chat-cache.test.ts`
- `src/frontend/lib/chat-route-seed.test.ts`
- `src/frontend/lib/follow-up-tags.test.ts`
- `src/frontend/lib/chat-stream.test.ts`
- `src/frontend/lib/agent-frames.test.ts`
- `src/frontend/lib/composer-attachments.test.ts`
- `src/frontend/lib/cloudflare-challenge-post.test.ts`
- `src/backend/services/user-personalization.service.test.ts`
- `src/backend/inference/reasoning-message-history.test.ts`

Selfchecks (run via tsx where present): `settings-normalize.selfcheck.ts`, `phone-countries.selfcheck.ts`.

---

## 2. Typecheck & lint

```bash
npm run typecheck
npm run lint
```

---

## 3. Manual E2E checklist (chat)

1. Login (email OTP path in staging)
2. New chat send → URL becomes `/c/{id}` instantly; orb visible
3. Stop generation
4. Edit user message → branch; reload → no duplicate assistants
5. Attach image + PDF
6. Follow-ups ON → chips clickable; OFF → tags stripped
7. Pin / rename / title optimistic behavior
8. Open chat from sidebar after reload (device cache + Worker)
9. Settings overlay open/close without blanking chat
10. Theme + chat font apply to assistant content only

---

## 4. Billing manual

1. Plans load
2. INR UPI QR appears for India heuristic
3. Webhook activation in test mode

---

## 5. Perf smoke

```bash
./scripts/ops/smoke-perf-stack.sh
```

Check Speed Insights / Web Vitals against [`../perf-metrics.md`](../perf-metrics.md).

---

## 6. Playwright

Repo may contain `.playwright-cli` dumps — do not commit secrets. Prefer dedicated Playwright skill/flows for dashboard automation (X developer portal, CF dash).

---

## 7. Related

- [`development-guide.md`](./development-guide.md)
