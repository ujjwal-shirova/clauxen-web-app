---
name: clauxen-storage
description: >-
  Clauxen file storage: R2 buckets, presign/complete, r2-gateway uploads, chat attachments, artifacts, quotas. Use when working on uploads, attachments, user_files, WORKER_URL, R2 buckets, or artifact storage.
---

# Clauxen storage

## Read first

- `docs/systems/storage-and-files.md`

## Rule

**Postgres = metadata. R2 = bytes.**  
No Vercel Blob / Supabase Storage binaries on product path. On Vercel, R2 is mandatory.

## Buckets

`clauxen-images`, `clauxen-documents`, `clauxen-artifacts`, `clauxen-skills`, `clauxen-chat-archives`

## Upload flow

`POST /api/v1/files/presign` → client PUT `WORKER_URL` (Bearer JWT) → `POST /api/v1/files/complete`

## Hard rules

1. Production requires `WORKER_URL`.
2. Chat attachments link via `chat_message_parts.file_id` + metadata for UI reload.
3. Do not put large bodies through Vercel functions.

## Key paths

`src/server/storage/`, `files.service.ts`, `user-files.repository.ts`  
`src/lib/composer-attachments.ts`  
`workers/r2-gateway/`

## Additional resources

- [reference.md](reference.md)
