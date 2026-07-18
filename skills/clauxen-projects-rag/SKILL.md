---
name: clauxen-projects-rag
description: >-
  Clauxen projects and RAG: project folders, file ingestion, chunking, pgvector retrieval, project chats. Use when working on /projects, project files, embeddings, BullMQ worker ingestion, or grounding chat with document chunks.
---

# Clauxen projects & RAG

## Read first

- `docs/systems/projects-and-rag.md`

## Ownership

Embeddings live in **Supabase pgvector** — not Cloudflare Vectorize.

## Pipeline

Upload → `project_files` / R2 → BullMQ `npm run worker` (or inline if no Redis) → extract → chunk → embed → retrieve at generate time with project instructions.

## Key paths

`src/backend/services/project-ingestion.service.ts`, `project-rag.service.ts`  
`src/backend/repositories/projects*.ts`, `project-files.repository.ts`  
`src/projects/`, `scripts/worker.ts`  
`/api/v1/projects/*` and legacy `/api/projects/*`

## Additional resources

- [reference.md](reference.md)
