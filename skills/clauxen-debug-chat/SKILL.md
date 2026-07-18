---
name: clauxen-debug-chat
description: >-
  Debug Clauxen chat failures: blank assistants, dead orb, hydrate flicker, duplicate messages, 409 lease, upload failures, follow-up [blocked], Recents vanishing. Use when the user reports chat bugs, streaming issues, orb disappearing, or sidebar list glitches.
---

# Debug Clauxen chat

## Read first

- Skill `clauxen-chat`
- `docs/reference/gotchas-encyclopedia.md`
- `docs/ops/operations-runbook.md` § Incidents

## Symptom → checks

### Blank completed assistant
1. Provider 401/5xx in generate logs?
2. SSE parser swallowing errors?
3. Persist visible `errorText`.

### Orb vanishes mid-turn
1. Realtime unmuted during local SSE?
2. Dedupe preferring empty cold snapshot?
3. Id remap not updating generation map / `appendMessageField` by clientId?

### Flicker / wipe on navigate
1. `loading.tsx` reintroduced on chat routes?
2. Sparse SSR seed wiping live turns?
3. Navigating before durable id?

### Duplicate assistants on reload
Branch PUT used `sanitizeMessages`? Must be `sanitizeBranchMessages`.

### Chat missing from Recents
1. Eviction wrote `messageIds: []`?
2. Filter treating `undefined` messages as empty?

### 409 on send
chat-coord lease held → stop or status/release; do not double-lease.

### Upload fails
`WORKER_URL` set? Bearer JWT on Worker PUT?

### Follow-up shows `[blocked]`
Using `clauxen-prompt://` links? Extract `<prompt>` to buttons instead.

## Reproduce matrix

New chat send · follow-up · reload hydrate · multi-tab · stop · edit/branch · attach file · pin/rename.

## Additional resources

- [examples.md](examples.md)
