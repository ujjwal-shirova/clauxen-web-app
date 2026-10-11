# Durable deep research

`present_research_plan` saves an owner-scoped plan and its 60-second approval deadline in `deep_research_plans`. It renders as a compact native card only after its complete validated content has been saved. During preparation the chat shows one shimmering status line; partial titles and task lists remain hidden. Plan arguments never need to appear in assistant prose. The assistant can write an overview after the card.

Cloudflare sends a delayed message through the existing generation queue. The watchdog scans persisted deadlines as a recovery path. The deadline is the earliest start time; queue delivery or an occupied chat can delay actual execution. Neither path requires a browser connection. Start and Cancel use the owner-authenticated research action API. Research admission reserves an assistant-only continuation and saves its job/checkpoint in one transaction; it never creates a synthetic user prompt. Saved legacy text plans migrate on an explicit action, and old internal start/cancel turns are excluded from the visible conversation. Atomic plan transitions and stable turn client IDs prevent timer/manual-start races from creating duplicate research jobs.

Edit suspends the deadline. Update saves the revised title/tasks and grants another 60 seconds. Cancel removes the card in favor of a grey cancellation label and settles that research turn. Pause yields to a saved checkpoint; Resume dispatches the same job. Paused research messages are excluded from orphan cleanup and paused jobs from terminal retention. An in-flight external tool finishes before its result is checkpointed, so pause takes effect at a safe boundary.

Research always enables provider thinking independently of the composer setting. Ordinary chat retains 10 search results. Research supports `web_search.num_results` from 1 to 30, defaulting to 30, and can run multiple searches. The source counter deduplicates returned URLs; search-call count is separate. These are retrieved sources, not a claim that every source has been read or verified. Task progress is updated explicitly through `research_task_update`; the progress bar reflects completed tasks.

Clicking Researching opens a scrollable right panel with the existing block-style agent trace. Live activity comes from the chat coordinator when it matches this job, with the persisted assistant transcript as fallback. Activity is fetched only while the panel is open. The panel docks in the app layout and resizes the chat. Expansion fills the main workspace while preserving app navigation; on narrow workspaces, closing the panel restores the mounted chat and its scroll position. The final cited report is saved as a normal assistant message.

The existing runner bounds research to 96 model rounds per run and 48 execution slices (up to roughly 3.6 hours), with retry limits. The panel displays failed runs instead of spinning indefinitely. Credentials remain in Worker secrets; browser requests require the chat owner and internal queue endpoints require the internal execution token.

## Verification

- `npx tsx --test tests/durable-research.test.ts tests/deep-research.test.ts tests/cloudflare-runtime.test.ts tests/background-generation.test.ts tests/chat-latency.test.ts`
- `npx tsx tests/durable-research.integration.ts`: disposable identity, real persistence, local continuation stub. Covers deadline suspension/reset, racing starts, source deduplication, pause/orphan preservation, resume, cancellation, and watchdog recovery.
- `node scripts/verify-cloudflare-research.mjs https://www.clauxen.com`: disposable identity, real model and Exa, server auto-start without a connected stream, pause/reconnect/resume and persisted cited report. This invokes paid provider/search APIs.

Apply `supabase/migrations/20261010160000_durable_deep_research.sql` before deploying the new Worker. Build with `npm run cf:build` and deploy with `npm run cf:deploy`. No new queue or browser automation is required.

## Saved report viewer and exports

After a successful research turn, the runner saves the complete final Markdown in the private artifacts bucket at `users/{userId}/deep-research/{planId}/report.md`. Its `user_files` row uses the plan ID as a stable file ID. Retried completion and watchdog recovery write the same key and cannot create duplicate file rows. Existing completed runs are recovered by the watchdog. The generated filename and report title come from the final report's first heading.

The chat displays a report preview card instead of duplicating the full final report inline. Opening it shows a compact scrollable viewer. Expansion is scoped to the chat area's container and never changes app navigation sidebar state. The nested Sources/Activity panel lists unique URLs actually cited in the report, rather than every retrieved result, and reuses the existing block-style activity trace. Duration is measured from research job admission to completion, excluding the approval countdown.

The owner-authenticated report endpoint reads the private R2 object and returns the Markdown with citation metadata. It is not publicly cached. Copy contents copies the full Markdown. Markdown downloads preserve that text; Word and PDF exports run locally in a browser worker loaded on demand, with a content-hashed asset URL, retaining headings, table content, paragraphs, emphasis, and citation links. Exporting does not send report content to an external conversion service.

`tests/research-report.test.ts` verifies citation deduplication and portable Markdown, and generates actual DOCX/PDF files: Word XML is checked for report/table/hyperlink content and the PDF's extracted text is checked for the final conclusion and table text. `tests/durable-research.integration.ts` adds owner-scoped report persistence and idempotency checks using local object storage; the deployed API smoke checks real R2 bindings and the final report endpoint.

## Source delivery and failure recovery

Research uses one bounded Exa search request for up to 30 source previews, with no synthesized-answer wait, second fallback search, or per-result reveal delay. Every returned source is handed to the next model round with its URL and title. Previews are bounded to 1,800 characters; full source reads use up to 8,000 characters. Accumulated tool evidence has a shared excerpt budget, preserving URLs and tool call/result pairing and explicitly marking shortened excerpts. The same normalization repairs oversized saved checkpoints when resumed.

Temporary provider failures retry the current model round at most twice, before any tools execute. Research allows up to 120 seconds of provider silence inside the existing bounded execution slice. Interrupted searches, reads, and task updates can recover; unknown outcomes for external writes still stop safely. Retry research atomically requeues the same failed job, assistant row and checkpoint, preserving source counts and completed work. Raw failures stay in private job diagnostics and telemetry; public status uses safe actionable copy.

Regression coverage includes oversized multi-search checkpoints, all-30-source delivery in one request, provider retry limits, hidden internal messages, assistant-only admission, and failed-job retry without losing collected evidence.
