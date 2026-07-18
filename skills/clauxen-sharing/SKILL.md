---
name: clauxen-sharing
description: >-
  Clauxen chat sharing and library: share tokens, public /share/[token], library items, artifacts viewer. Use when working on share dialog, conversation_shares, library route, or artifacts API.
---

# Clauxen sharing & library

## Read first

- `docs/systems/sharing-and-library.md`

## Share

`share-dialog.tsx` → `POST /api/v1/chats/:id/share` → `conversation_shares` → public `/share/[token]` + `GET /api/v1/share/:token`.

Do not leak private attachments beyond share policy.

## Library / artifacts

`/library`, `/api/v1/artifacts`, artifact viewer context/panel.
