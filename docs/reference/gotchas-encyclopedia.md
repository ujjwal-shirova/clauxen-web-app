# Gotchas Encyclopedia

Operational and product gotchas distilled for humans and agents. Prefer fixing the underlying footgun when touching related code; keep this list updated. Canonical short form also lives in `brain/MEMORY.md`.

---

## Auth & email

1. **KV TTL ≥ 60s** — Cloudflare Workers KV rejects shorter `expirationTtl`; OTP cooldown of 45 crashed sends.
2. **Rotate AUTH_EMAIL_INTERNAL_TOKEN everywhere** — Worker secret + Vercel prod/preview/dev must match.
3. **Magic link is new-user-first** — existing-user magic login deferred.
4. **Auth custom domain** — X OAuth callback must be `https://auth.clauxen.com/auth/v1/callback`, never `*.supabase.co`.
5. **Unified login only** — `/signup` redirects; do not revive separate signup UX without product decision.
6. **`.auth-text-link`** — clickable auth labels must not get button hover wash.
7. **Quiet session first** — full profile sync after FCP; do not block boot on heavy session.
8. **Dev bypass disabled on Vercel** — `/api/v1/auth/login|register` → 503 in production.

## Chat & streaming

9. **SSE errors must be visible** — never swallow into blank completed assistants.
10. **Mute Realtime messages while SSE owns the turn** — except id remaps.
11. **Live streaming wins dedupe** — empty cold snapshots must not kill the orb.
12. **clientId stability** — DB id swaps must not remount turns.
13. **No loading.tsx on `/new` or `/c/[id]`** — causes shimmer races.
14. **Seed ≤120ms** — longer waits fight soft-nav optimism.
15. **Navigate on durable id** — do not await message persist before `/c/{id}`.
16. **Sparse SSR seed must not wipe live turns** — `handleSelectChat` guard.
17. **Branch PUT uses `sanitizeBranchMessages`** — never `sanitizeMessages` for branches.
18. **Single agent activity frame** — no stacked Brewed/Churned.
19. **Follow-ups are `<prompt>` buttons** — not `clauxen-prompt://` links (`[blocked]`).
20. **Recents: undefined ≠ empty** — keep chats when messages not hydrated.
21. **RAM eviction omits messageIds keys** — do not write `[]`.
22. **Realtime remap updates generation map** — else tokens write to deleted id.
23. **appendMessageField resolves by clientId** — critical mid-stream.
24. **Pin overrides until server agrees** — list cache lag otherwise yanks rows.
25. **Full-thread hydrate limit 500** — no scroll-up pagination UI.
26. **Chat ids are text** — validate with `requireChatIdParam`.

## UI / CSS

27. **Sidebar selection on row container only** — avoid nested aria-current pills.
28. **Hover is one continuous pill** — pin/menu must not paint nested hover backgrounds.
29. **Overlays portal to document.body** — agent-panel `translateZ(0)` traps fixed.
30. **Hash overlays, not path overlays** — path overlays blanked main panel.
31. **Chat fonts only on assistant content** — not chrome labels.
32. **Do not re-import streamdown CSS in main layout** — idle via StreamdownStyles.
33. **Inline edit focus** — preventScroll + blur on user viewport scroll; click agent-panel collapses.

## Infra / env

34. **Provider_* never NEXT_PUBLIC_** — fail closed.
35. **WORKER_URL required in production** for uploads.
36. **Sensitive env not allowed on Development** — use encrypted duplicate.
37. **Never overwrite unreadable sensitive with .env.local** unless forced rotation.
38. **Reconcile can nuke Provider keys** — verify after env scripts.
39. **Verified commits required** — SSH signing key on GitHub separately from auth key.
40. **Proxy skips `/api` session refresh** — handlers auth themselves.
41. **CF challenge POST→GET in proxy** — do not weaken CF rules for 405s.
42. **Do not use cf.threat_score** — deprecated.
43. **Free plan: 5 custom rules, 1 rate limit** — plan carefully.
44. **Account API token ≠ zone edit** — Cache Rules may 403.
45. **Hyperdrive chat-history caching policy** — follow current deploy (often caching-disabled for freshness).
46. **Vercel region pdx1** near Supabase us-west-1.
47. **DATABASE_POOL_MAX=1** default per isolate.
48. **Anon EXECUTE revoked on chat SECURITY DEFINER RPCs**.
49. **R2-only binaries** — no Blob/Supabase Storage on product path.
50. **No Vectorize** — pgvector only.
51. **Skip Argo unless asked**.
52. **UPI INR-only** — prefer India browser heuristic over flaky geo hide.

## Workers

53. **Attachment Worker PUTs need Bearer Supabase access token** when worker:true.
54. **chat-coord is lease authority** across isolates — local registry alone insufficient.
55. **Invalidate + warm after writes** or clients see stale list/body.

## Settings

56. **Notifications optimistic** — do not overwrite toggles from slow PATCH body.
57. **Personalization modular md** — do not hardcode personality into virgil.md.
58. **Follow-up instruction only when setting ON**.

---

## Related

- [`../complete-product-deep-dive.md`](../complete-product-deep-dive.md)
- [`../ops/operations-runbook.md`](../ops/operations-runbook.md)
- `brain/MEMORY.md`
