# Chat View / Thread UX Survey & Fix

**Date:** 2026-07-23  
**Scope:** Chat scroll follow, sticky user bubbles, sticky code/table headers, LOD jumps  
**Goal:** ChatGPT/Claude-simple behavior — no sudden scroll jumps, sticky headers dock as blocks appear

---

## What we build (surface map)

| Piece | File(s) | Job |
|-------|---------|-----|
| Shell | `chat-view.tsx` → `chat-area.tsx` → `chat-view-pane.tsx` | Layout, composer dock, ScrollArea |
| Thread | `conversation-thread.tsx` | Turns, user sticky host, assistant rows |
| Scroll | `use-chat-scroll.ts` | Pin/unpin, eased stream-follow |
| Sticky resolve | `lib/chat-sticky.ts` | Which turn elevates user bubble |
| Markdown | `streaming-markdown.tsx`, `markdown-styles.tsx` | Code/table frames with sticky headers |
| LOD | `use-message-visibility.ts` | Offscreen plain/placeholder swap |

---

## Bugs found

### 1. Scroll jumps upward while reading history (critical UX)

**Symptom:** Scrolling up suddenly jumps toward the top of a message / earlier content.

**Causes:**
1. **LOD height lock bug** — when downgrading `full → plain/placeholder`, height was never captured first (`applyHeightLock("placeholder")` used an empty lock). Offscreen turns collapsed to a short preview; scrolling back restored full markdown and hard-jumped the viewport.
2. **Unpin race** — user wheel cancelled follow RAF, but pin state waited for a scroll RAF. A same-frame follow tick could still fight the gesture.
3. **Resize compensation only handled shrink** — content growth above the viewport (LOD restore) was not compensated by preserving distance-from-bottom.

### 2. Code/table headers sticky only after message completes

**Symptom:** Headers dock correctly after the assistant turn finishes, but not while streaming with auto-scroll.

**Causes:**
1. Sticky **offset** was gated on JS `data-sticky-active` / `data-code-header-pin`. During eased follow, distance-from-bottom often exceeded the old 140px “near bottom” band, so the live turn was not elevated and headers used `top: 0` — sliding under the sticky user bubble (looked “not sticky”).
2. Tailwind `top-0` on header nodes fought the intended calc offset.
3. Heavy mutation/timer settle passes tried to paper over remounts instead of making CSS always correct.

### 3. Complexity debt

- Duplicate sticky sync in `conversation-thread` + login demo
- Per-block pin attribute thrash on every sync
- Generation-end settle storms (40/120/280/520ms)

---

## Fix (shipped)

1. **LOD** — capture full height before every downgrade; seed lock on observe.
2. **Scroll** — sync unpin on wheel/touch immediately; preserve distance-from-bottom for both growth and shrink when unpinned; slightly longer user-input cooldown.
3. **Sticky CSS-first** — every turn’s code/table headers always use  
   `top: calc(var(--header-height) + var(--turn-user-msg-height))`.  
   JS only sets `data-sticky-active` for user-bubble elevation / z-index.
4. **Wider near-bottom band while generating** (360px) so eased follow still pins the live turn.
5. **Extract** `src/lib/chat-sticky.ts` + unit tests; slim demo sticky.

---

## Security / performance notes (thread path)

| Area | Status |
|------|--------|
| Markdown HTML | No `rehype-raw` — model HTML cannot become DOM |
| Code language | Sanitized before render (`sanitizeCodeBlockLanguage`) |
| Sticky sync | Imperative DOM attrs only — no React re-render on scroll |
| LOD | Keeps offscreen markdown cheap; height lock prevents jump |
| MutationObserver | Debounced 48ms while generating |

Thread UI is not a privilege boundary; authz stays on `/api/v1/chats/*` (see app-health survey Phase A).

---

## Manual check

- [ ] Send a long code-heavy reply — header docks under user bubble while tokens stream
- [ ] Scroll up mid-generation — no yank to bottom; no jump to message top
- [ ] Scroll up through older turns with code/tables — no sudden LOD jump
- [ ] After completion, sticky still works; scroll-to-bottom re-pins
