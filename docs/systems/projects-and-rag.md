# Projects and RAG

## 1. Purpose

Projects are folders with:

- Custom instructions
- Uploaded files
- Chunking + embeddings (pgvector)
- Project-scoped chats / conversations

Retrieval grounds chat responses with relevant chunks.

---

## 2. Key paths

| Path | Role |
|---|---|
| `src/backend/services/project-ingestion.service.ts` | Ingest pipeline |
| `src/backend/services/project-rag.service.ts` | Retrieval |
| `src/backend/repositories/projects.repository.ts` | Projects SQL |
| `src/backend/repositories/project-files.repository.ts` | Files |
| `src/backend/repositories/project-chats.repository.ts` | Chat links |
| `src/projects/` | Frontend pieces + queue helpers |
| `scripts/worker.ts` | BullMQ ingestion worker |
| App routes | `/projects`, `/projects/[id]`, conversations |
| API | `/api/v1/projects/*` + legacy `/api/projects/*` |

---

## 3. Data model

- `projects`, `project_members`
- `project_files` — upload metadata + processing status
- `document_chunks` — text chunks
- `embeddings` — vectors
- Chats optionally reference `project_id`

---

## 4. Ingestion flow

1. Upload file (R2 via gateway or project files API)
2. Create processing job
3. BullMQ worker (`REDIS_URL`) or inline fallback extracts text (`text-extract.service.ts` — PDF/mammoth/etc.)
4. Chunk → embed → store
5. Status endpoint for UI polling/subscribe

---

## 5. Retrieval at chat time

When generating inside a project chat:

1. Embed query (or use hybrid search as implemented)
2. Top-k chunks from pgvector
3. Inject into model context with project instructions
4. Cite sources in UI when available (`chat-sources`)

---

## 6. UI

- Projects list / create dialog
- Project detail with files + conversations
- Soft-nav via `useInstantNavigate`
- `use-projects.ts`, `use-project-chat.ts`

---

## 7. Ops notes

- Redis optional locally
- Production should run `npm run worker` or equivalent for backlog
- Keep embeddings in Supabase — do not introduce Vectorize on product path

---

## 8. Related

- [`storage-and-files.md`](./storage-and-files.md)
- [`inference-and-models.md`](./inference-and-models.md)
