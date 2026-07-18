# Sharing and Library

## 1. Chat sharing

1. Owner opens share dialog (`share-dialog.tsx`)
2. `POST /api/v1/chats/:chatId/share` creates `conversation_shares` token
3. Public page `/share/[token]` + `GET /api/v1/share/:token`
4. Revoke via share API as implemented

Shares should expose a read-only snapshot appropriate for public access — never leak other users' data.

---

## 2. Library

- Route: `/library`
- Backed by `library_items` (+ artifacts surfaces)
- Soft-nav from sidebar
- Artifacts viewer panel/context for generated files

API: `/api/v1/artifacts`

---

## 3. Saved prompts

`saved_prompts` table supports prompt library features where wired in UI.

---

## 4. Related

- [`chat-system.md`](./chat-system.md)
- [`storage-and-files.md`](./storage-and-files.md)
