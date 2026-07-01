# Claude Projects Clone

A production-grade recreation of Anthropic's **Claude Projects** feature — project folders with custom instructions, file uploads, RAG-powered knowledge retrieval, and streaming chat conversations.

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | Next.js App Router, Tailwind CSS v4, shadcn/ui, TanStack Query |
| API | Next.js Route Handlers (`/api/projects/*`, `/api/auth/*`) |
| Database | PostgreSQL 16 + pgvector (Prisma ORM) |
| Queue | BullMQ + Redis (file ingestion worker) |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| LLM | Anthropic `claude-sonnet-4-6` (streaming SSE) |
| Auth | JWT (`jsonwebtoken` + `bcrypt`) |
| Storage | Local disk (`storage/uploads/`) — S3-ready |

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** with pgvector on port `5433`
- **Redis** on port `6379`

### 2. Configure environment

Edit **`.env.local`** at the repo root (single env file for local dev). At minimum set:

```bash
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@db.<project-ref>.supabase.co:5432/postgres
JWT_SECRET=your-secret-here
NOVITA_AI_KEY=...
R2_S3_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

See `docs/vercel-deployment.md` for the full variable list.

### 3. Apply database schema

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:9002/projects](http://localhost:9002/projects)

### 5. Start the ingestion worker (separate terminal)

```bash
npm run worker
```

The worker processes uploaded files: text extraction → chunking → embedding → pgvector storage.

> If Redis is unavailable, files are processed inline as a fallback.

## Routes

### Pages

| Route | Description |
|-------|-------------|
| `/projects` | Project listing with search, sort, empty state |
| `/projects/[id]` | Project home — chat input, conversation list, instructions & files sidebar |
| `/projects/[id]/conversations/[convId]` | Full chat view with streaming responses |

### API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in, receive JWT |
| GET/POST | `/api/projects` | List / create projects |
| GET/PATCH/DELETE | `/api/projects/[id]` | Project CRUD |
| PATCH | `/api/projects/[id]/instructions` | Save `system_prompt` |
| GET/POST | `/api/projects/[id]/files` | List / upload files |
| DELETE | `/api/projects/[id]/files/[fileId]` | Remove file |
| GET/POST | `/api/projects/[id]/files/[fileId]/status` | Poll status / retry ingestion |
| GET/POST | `/api/projects/[id]/conversations` | List / create conversations |
| PATCH/DELETE | `/api/projects/[id]/conversations/[convId]` | Rename, star, move, delete |
| GET/POST | `/api/projects/[id]/conversations/[convId]/messages` | History / stream new message |

All project API routes require `Authorization: Bearer <token>`.

## RAG Pipeline

### Ingestion (on file upload)

1. File saved to `storage/uploads/{projectId}/`
2. Job enqueued to BullMQ
3. Text extracted (pdf-parse, mammoth, papaparse, plain text)
4. Recursive character splitter: **512 tokens** target, **64 token** overlap
5. Each chunk embedded via OpenAI `text-embedding-3-small`
6. Stored in `document_chunks` with HNSW index
7. `project_files.status` → `ready` (or `failed`)

### Retrieval (on each message)

1. User message embedded with same model
2. Cosine similarity search: top **8** chunks filtered by `project_id`
3. Context assembled as `<project_knowledge>...</project_knowledge>`
4. System prompt = project instructions + RAG context + grounding suffix
5. Streamed to client via SSE (`text/event-stream`)

## Design System

- Background: `#F5F4EF` (warm off-white)
- Headings: Playfair Display (serif)
- Body: Inter / system sans-serif
- Primary button: `bg-black text-white rounded-lg`
- Secondary: `border border-gray-300 rounded-lg`
- Modals: `rounded-2xl shadow-xl` on darkened backdrop

## Development

```bash
npm run dev          # Next.js on :9002
npm run worker       # BullMQ ingestion worker
npm run prisma:studio # Database GUI
npm run typecheck    # TypeScript check
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes* | Redis for BullMQ (*inline fallback) |
| `JWT_SECRET` | Yes | JWT signing secret |
| `ANTHROPIC_API_KEY` | Yes | Claude API for chat streaming |
| `OPENAI_API_KEY` | Yes | Embeddings for RAG |
| `STORAGE_LOCAL_PATH` | No | Local upload directory (default: `./storage/uploads`) |
| `STORAGE_BUCKET` | No | S3 bucket name (future) |
| `NEXTAUTH_SECRET` | No | Reserved for future auth integration |

## License

Private — Clauxen internal use.
