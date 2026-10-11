# Chat send latency audit

The normal chat path previously acknowledged every send with `202` and two SSE events (`turn_ready`, `backgrounded`). It then dispatched the first model slice through a queue or another HTTP invocation. The browser never received that slice's token stream: it fetched `/generate/status` and `/live` snapshots instead.

## Verified bottlenecks and changes

- **Snapshot delivery delayed visible output.** The background poller sleeps 2.5 seconds between ticks; the runner publishes live snapshots at most once every 1.5 seconds. Depending on their phase, this can add roughly four seconds plus network time after output is available. Idle sends now atomically claim and run the first slice in the Send invocation, forwarding SSE chunks immediately. Queued turns and yielded slices retain durable background recovery.
- **Two poll loops overlapped.** Alongside each background poller's status and live requests, the discovery loop fetched generating IDs and live snapshots every 1.5 seconds. With one visible active background chat, that is up to approximately 128 browser requests per minute before accounting for network duration. Discovery now skips live reads owned by the background poller and stays on its 30-second cadence when local SSE/background polling already handles every known generation. A healthy local streamed turn uses one Send request and approximately two discovery requests per minute, plus independent title/history/realtime traffic.
- **Thinking preference was dropped before the upstream request.** The agent suppressed reasoning display when Thinking was off, but the provider adapter never sent a reasoning control. Novita now receives its documented `enable_thinking` boolean; other compatible providers receive the selected `reasoning_effort` when supplied. Provider-specific extensions are restricted to Novita hostnames. Custom providers may require their own toggle mapping; an absent effort does not universally disable their reasoning.
- **Feature flags added a serial round trip.** Their read now overlaps the two existing rate-limit checks.
- **Latency telemetry covered only total completion.** `Server-Timing` now includes authentication, preflight, and admission/claim durations. Inference telemetry metadata includes admission/dispatch, context preparation, first visible content, first answer/narration, context-to-first-content delay, logical model rounds, and the resumed step. These are server-side times; they exclude browser networking/rendering and do not count SDK retries as separate model rounds.

## Correctness and recovery

The prompt, assistant placeholder, and job still commit together before acknowledgement. The existing atomic database claim and fencing prevent a second runner from executing the same job. A browser disconnect cancels only its subscriber; the original runner continues saving checkpoints. The response buffer is capped at 256 KiB; a slow subscriber receives a background handoff. The runner's database resource scope outlives the admission request scope, and `after()` retains the same execution promise instead of starting a second invocation. Long slices still yield and chain through the existing durable mechanism.

A plain answer normally takes one logical model round. Tool use creates subsequent rounds. Title refinement can make another provider request after the answer. Automatic SDK retries are disabled; provider response headers and meaningful stream activity have a 45-second deadline, preventing a silent ten-minute wait. Active reasoning, text, and tool-call chunks renew the idle deadline. The generate endpoint retains limits of 45 submissions per user and 90 per IP per minute; progress requests are separate from those limits.

## Validation and remaining measurement

Regression tests cover immediate chunk delivery, client disconnect, bounded subscriber buffering, completed/yielded protocol handling, independent database resource lifetimes, provider thinking controls, and propagation of Thinking on/off through a single agent round. Existing background-generation and Cloudflare runtime tests cover recovery and queue semantics.

New chats still require a chat-creation request; pending attachments still require uploads; history, ownership checks, and durable admission remain necessary. Cross-tab/background snapshots retain their existing cadence. These tests do not establish latency percentiles or GPU throughput.

## Production incident and verification, October 10, 2026

The deployed application was missing the provider and internal authentication secret bindings. Queue events threw `Generation queue authentication is not configured`; watchdog requests returned 401. The user's job remained queued without a lease or model output. Restoring the live bindings made the watchdog authenticate successfully and the existing stuck job complete at 15:12:19 UTC.

The queue consumer now uses the same token precedence as the internal route: generation token, coordinator token, then scheduled-task token. Runtime admission rejects broken configuration before creating a stranded job. Deployment checks validate binding presence before and after publishing, without printing secret values.

Version `9915b456-15e1-4d17-a61e-68b81a45db06` was deployed with direct foreground streaming. Real API tests used dedicated disposable authenticated identities, a plain Virgil prompt, and Thinking off. No browser debugging was used for verification:

| Endpoint        | Response headers | First model content | Stream completion | Durable result  |
| --------------- | ---------------: | ------------------: | ----------------: | --------------- |
| Worker origin   |          2.999 s |             6.230 s |           6.797 s | Saved, inactive |
| www.clauxen.com |          0.704 s |             5.200 s |           5.784 s | Saved, inactive |

Both returned HTTP 200 with `turn_ready`, model narration, `answer_finalize`, and `done`, without a background handoff. Public-domain server timing was authentication 55 ms, preflight 27 ms, admission/claim 251 ms. These are two smoke samples, not a performance percentile. Fixture identities and their data were removed afterward. `scripts/verify-cloudflare-chat.mjs` repeats this verification through the API.

A third public-domain test cancelled its stream immediately after admission (724 ms). The server continued independently, saved the answer, and reported inactive status. Run with `--disconnect` to verify this behavior.

Validation passed: Cloudflare production build, deployment binding checks, 41 regression tests, TypeScript, targeted lint, and 10 public HTTP checks. The authenticated integration suite also passed direct admission, subscriber disconnect, live reconnect, saved history, idempotent retry without duplicate model calls, ordered queued turns, cancellation, and scheduled-task execution. Its local execution origin is explicitly isolated from production.

Novita control reference: https://docs.novita.ai/api-reference/model-apis-llm-create-chat-completion
