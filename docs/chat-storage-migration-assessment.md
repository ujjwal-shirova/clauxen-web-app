# Clauxen chat storage migration assessment

Assessed on 10 October 2026. This is an implementation proposal, not a completed migration. Production was inspected with read-only aggregate SQL; no message contents or credentials were retrieved. No infrastructure, application behavior, or production records were changed.

Update: the user has selected Cloudflare-only storage with D1 metadata and R2 transcript bodies. The current design is in [cloudflare-chat-storage-architecture.md](./cloudflare-chat-storage-architecture.md); it supersedes the destination ambiguity and hybrid text-storage proposal below. The observations here remain historical assessment evidence.

## Observed deployment and code

The connected Supabase project, `clauxen-database-main`, is healthy in `us-west-1`. Its database occupies 32,443,539 bytes (about 32.4 MB / 30.9 MiB), including system schemas. It has 111 public base tables, 4 chats and 26 messages at the time of inspection.

`chat_messages` occupies 671,744 bytes including indexes and auxiliary storage. Across the current small sample, message text averages 445 bytes and `content_json` averages 14,655 bytes. This is not a representative production capacity forecast. Structured traces currently dominate message payload size.

Current responsibilities:

- Supabase/Postgres: active conversations, messages, branches, transcript lines, generation jobs, accounts, permissions and billing data.
- Cloudflare Hyperdrive: SQL connections from the app and history Worker to Postgres.
- Cloudflare R2: files and chat archive snapshots.
- Cloudflare Durable Objects: live generation coordination; code publishes live state approximately every 1.5 seconds.
- Postgres: generation checkpoints approximately every 4 seconds while state is streaming, plus final persistence.
- Supabase Auth and Realtime: frontend integrations, including message subscriptions.

Evidence: `src/server/db/pool.ts`, `workers/chat-history/wrangler.toml`, `src/server/repositories/messages.repository.ts`, `src/server/chat/chat-archive.ts`, `src/server/services/chat.service.ts`, `src/client/hooks/use-chat-api.ts`, and `src/client/contexts/auth-context.tsx`.

The archive code already supports writing an R2 snapshot before purging live message rows and restoring those rows on unarchive. It is not evidence that every inactive conversation is automatically moved out of Postgres.

## Candidate destinations

| Destination | Economics | Application migration effort |
| --- | --- | --- |
| D1 + R2 | Workers Paid starts at $5/month. D1 includes 5 GB total storage, 25 billion row reads/month and 50 million row writes/month. R2 Standard includes 10 GB-month, then $0.015/GB-month plus operations. | Substantial: port Postgres SQL/functions, replace authorization and realtime integrations, and establish shard routing before growth. This remains a Cloudflare architecture. |
| Turso + object storage | Free includes 5 GB, 500 million row reads and 10 million row writes/month. Developer is $5.99 month-to-month with 9 GB included, plus overages. | Substantial SQLite-family SQL port; separate object storage, authentication and realtime decisions. Useful non-Cloudflare candidate for a dedicated chat service. |
| Neon Postgres + object storage | Free currently includes 1 GB/project and 100 CU-hours/project. Launch is $0.106/CU-hour and $0.35/GB-month with no monthly minimum. | Less database-engine conversion, but Supabase Auth, `auth.users` foreign keys, `auth.uid()` policies, RPCs and Realtime are not made compatible by changing the connection string. |
| Existing Supabase | Pro starts at $25/month with one Micro instance and 8 GB database disk included. | Lowest migration effort. Current chat storage volume alone does not establish a reason to move. Actual account billing has not been inspected. |

Sources checked:

- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Turso monthly pricing](https://turso.tech/pricing?frequency=monthly)
- [Neon maintained documentation source](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md)
- [Supabase pricing](https://supabase.com/pricing)

These are provider rates, not an all-in quote. Compute, query scans, index writes, checkpoints, storage operations, queues, logs, authentication, hosting and inference can all contribute to costs. LLM inference costs are separate.

## Proposed economical storage layout

Keep a queryable database for conversation ownership, title, ordering, branch relationships, message text, completion status and object references. Put large immutable completed tool outputs, attachments and trace exports in object storage. Keep enough durable checkpoint data to recover interrupted work; avoid moving data needed on every active turn to objects without measuring latency and read costs.

Preserve cursor pagination and explicit conversation ownership checks. Treat automatic cold storage as a separate feature from the user's visible Archive action. A background archive must preserve listing, history loading, edit/regenerate, search and deletion semantics.

A D1 implementation should plan multiple databases before approaching the hard 10 GB per-database cap. Each instance executes queries serially; read replicas help read throughput but do not remove the primary write bottleneck. Large agent payloads also need review against the 2 MB row limit. Globally replicated reads require the D1 Sessions API.

At the observed average, one million messages would contain approximately 15.1 GB of text plus structured JSON before indexes, other tables and storage overhead. This is an illustration, not a forecast. It demonstrates why storing full traces in a single D1 database would eventually require partitioning or payload offloading.

## Implementation sequence after destination selection

1. Preserve existing in-progress Cloudflare hosting changes; isolate the storage migration from them.
2. Define a chat persistence interface covering branch paging, inserts, streaming checkpoints, finalization, archive/restore and deletion.
3. Implement the chosen backend and its ownership/authorization model; account for existing cross-table relationships and transactions.
4. Export from a consistent source snapshot. Backfill IDs, parent relationships, timestamps, statuses and payloads; retain an export manifest and verify counts and hashes.
5. Validate chat creation, multi-tab updates, streaming recovery, paging, edit/regenerate, sharing, archive/restore and deletion in a staging environment.
6. Handle concurrent writes during cutover with a documented brief write pause or an idempotent replication/reconciliation mechanism. Retain the source for rollback until verification completes.
7. Remove old services only after verifying the replacement and data parity.

The user's wording mentions both leaving Cloudflare and moving to D1. Destination-dependent implementation is pending clarification because D1 and R2 are Cloudflare services. If leaving Cloudflare is required, evaluate Neon first for lower SQL conversion effort and Turso for lower fixed database cost; include replacements for existing Workers, coordination, queues and object storage in the full platform estimate. If consolidating onto Cloudflare is intended, D1 + R2 is a credible low-cost design with meaningful migration work.
