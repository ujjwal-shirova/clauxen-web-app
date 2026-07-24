# Storage and Files

## 1. Rule

**Postgres = metadata. R2 = bytes.**  
No Vercel Blob, no Supabase Storage binaries on the product path. Local disk fallback only for non-Vercel/dev when `STORAGE_REQUIRE_R2=false`.

On Vercel, R2 is mandatory.

---

## 2. Buckets

| Bucket | Use |
|---|---|
| `clauxen-images` | Images / avatars / chat images |
| `clauxen-documents` | Docs / PDFs / user files |
| `clauxen-invoices` | Billing invoice PDFs (customer + sales archive; `clauxen-billing` Worker) |
| `clauxen-artifacts` | Generated artifacts |
| `clauxen-skills` | Skill packages |
| `clauxen-chat-archives` | History Worker durable snapshots |

Env names: `R2_*_BUCKET`, credentials `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`.

---

## 3. Upload sequence

```
Browser                Next.js                    r2-gateway              R2
  |                      |                            |                    |
  |--POST /files/presign->|                            |                    |
  |<- upload URL --------|                            |                    |
  |----------------PUT Bearer JWT ------------------->|---put object------>|
  |--POST /files/complete>| (finalize user_files)     |                    |
```

Presign may set `worker: true` → client must send Supabase access token to Worker.

---

## 4. Chat attachments

- Composer accepts images, text docs, PDFs
- Linked via `chat_message_parts.file_id`
- `metadata.attachments` for UI reload
- Text extraction / vision as needed at generate time

---

## 5. Quotas

`src/lib/storage-quota.ts` + `/api/v1/settings/storage`.

---

## 6. Key modules

- `src/server/storage/`
- `src/server/services/files.service.ts`
- `src/server/repositories/user-files.repository.ts`
- `src/lib/composer-attachments.ts`
- `workers/r2-gateway/`

---

## 7. Related

- [`cloudflare-workers.md`](./cloudflare-workers.md)
- [`projects-and-rag.md`](./projects-and-rag.md)
