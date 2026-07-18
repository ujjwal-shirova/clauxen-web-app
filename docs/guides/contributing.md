# Contributing

## 1. Workflow

1. Read `brain/MEMORY.md`
2. Create focused branch
3. Implement one slice
4. Update docs if durable behavior changes
5. `npm run lint && npm run typecheck && npm test`
6. Commit with verified SSH signature (Vercel Require Verified Commits)
7. Push + PR

---

## 2. Commit signing

Global git uses SSH signing (`gpg.format=ssh`). The Ed25519 pubkey must be on GitHub as **Signing** key (auth key alone is insufficient for Verified).

Unverified commits → Vercel deployments auto-canceled.

---

## 3. Do not commit

- `.env.local`, `.env.vercel`, credentials
- Playwright dumps with secrets
- `__pycache__`, large binaries
- Accidental `NEXT_PUBLIC_` secrets

---

## 4. Memory updates

When user says "remember", or you learn a durable gotcha, update `brain/MEMORY.md` via `./brain/tools/memory.sh` or direct edit.

---

## 5. PR expectations

- Summary of why
- Test plan checklist
- Note env/Worker deploys required
- Link docs updated under `docs/`

---

## 6. Related

- [`development-guide.md`](./development-guide.md)
- [`../ops/operations-runbook.md`](../ops/operations-runbook.md)
