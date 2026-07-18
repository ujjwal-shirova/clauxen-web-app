# Frontend Lib Encyclopedia

Every module under `src/frontend/lib/` with a short purpose note.

| File | Purpose |
|---|---|
| `agent-frames.test.ts` | Tests for agent frames |
| `agent-frames.ts` | Ordered agent activity frame model |
| `agent-segments.ts` | Typed thinking, narration, tool, and completion segments |
| `agent-stream-fast-path.ts` | Fast-path stream handling optimizations |
| `agent-stream-reducer.ts` | Reduce stream events into agent UI state |
| `api/artifacts.ts` | API client helpers |
| `api/auth.ts` | API client helpers |
| `api/billing.ts` | API client helpers |
| `api/chats.ts` | API client helpers |
| `api/client.ts` | API client helpers |
| `api/customize.ts` | API client helpers |
| `api/files.ts` | API client helpers |
| `api/gifts.ts` | API client helpers |
| `api/onboarding.ts` | API client helpers |
| `api/profile.ts` | API client helpers |
| `api/projects.ts` | API client helpers |
| `api/research.ts` | API client helpers |
| `api/sandbox.ts` | API client helpers |
| `api/settings-extended.ts` | API client helpers |
| `api/settings.ts` | API client helpers |
| `api/share.ts` | API client helpers |
| `api/workspaces.ts` | API client helpers |
| `app-buttons.ts` | Shared button class helpers |
| `app-routes.ts` | Canonical routes + overlay hash helpers |
| `app-shell-layout.ts` | Shell layout measurements/helpers |
| `apple-pay.ts` | Apple Pay helpers |
| `auth-redirect.ts` | Post-auth redirect resolution |
| `branch-conversation.ts` | Branch conversation helpers |
| `capture-display-screenshot.ts` | Screenshot capture utility |
| `card-input-format.ts` | Card number formatting for checkout |
| `chat-artifacts.ts` | Chat-linked artifacts helpers |
| `chat-branch.ts` | Branch edit/send orchestration helpers |
| `chat-grouping.ts` | Group messages for rendering |
| `chat-history-page-size.test.ts` | Tests for page size |
| `chat-history-page-size.ts` | History page size constants |
| `chat-presence-broadcast.ts` | Realtime Broadcast presence/typing |
| `chat-route-seed.test.ts` | Seed tests |
| `chat-route-seed.ts` | Client seed registration helpers |
| `chat-send-event.ts` | Analytics/send event helpers |
| `chat-sources.ts` | Citation/source parsing |
| `chat-storage.ts` | Local storage helpers for chat |
| `chat-store-bridge.ts` | Bridge between stores and chat state |
| `chat-stream.test.ts` | Stream tests |
| `chat-stream.ts` | SSE parse/consume utilities |
| `checkout-currency-preference.ts` | Persist checkout currency pref |
| `checkout-ui.ts` | Checkout UI helpers |
| `clauxen-code/format-duration.ts` | Clauxen Code feature helpers |
| `cloudflare-challenge-post.test.ts` | CF challenge tests |
| `cloudflare-challenge-post.ts` | Detect CF challenge document POSTs |
| `composer-attachments.test.ts` | Attachment tests |
| `composer-attachments.ts` | Attachment validation + upload orchestration |
| `create-file-tags.ts` | File tag helpers for model context |
| `dedupe-chat-messages.test.ts` | Dedupe tests |
| `dedupe-chat-messages.ts` | Merge optimistic/server/realtime/IDB messages |
| `device-chat-cache.test.ts` | Device cache tests |
| `device-chat-cache.ts` | IndexedDB device cache (list + bodies) |
| `download-file.ts` | Download helper |
| `enrich-agent-tool.ts` | Enrich tool results for UI |
| `follow-up-tags.test.ts` | Follow-up tests |
| `follow-up-tags.ts` | Extract <prompt> tags to buttons |
| `format-relative-time.ts` | Relative time formatting |
| `hydrate-chat-messages.test.ts` | Hydrate tests |
| `hydrate-chat-messages.ts` | Hydration merge pipeline |
| `id.ts` | Id generation helpers |
| `keyboard-shortcuts-defaults.ts` | Default shortcut map |
| `languages.ts` | Language lists |
| `message-ui-key.ts` | Stable React keys for messages |
| `oauth-providers.ts` | OAuth provider metadata for login UI |
| `phone-countries.selfcheck.ts` | Phone countries selfcheck |
| `phone-countries.ts` | Phone country codes |
| `project-storage.ts` | Project local storage helpers |
| `razorpay-checkout.ts` | Razorpay.js checkout bootstrap |
| `segmented-control.ts` | Segmented control helpers |
| `settings-defaults.ts` | Default settings blob |
| `settings-normalize.selfcheck.ts` | Settings normalize selfcheck |
| `settings-normalize.ts` | Frontend utility — see source |
| `started-recent-chats.ts` | Frontend utility — see source |
| `starter-skills-data.ts` | Frontend utility — see source |
| `stream-event-batcher.ts` | Frontend utility — see source |
| `streaming-orb-policy.test.ts` | Frontend utility — see source |
| `streaming-orb-policy.ts` | Frontend utility — see source |
| `syntax-highlight/index.ts` | Syntax highlighting |
| `syntax-highlight/languages.ts` | Syntax highlighting |
| `syntax-highlight/theme.ts` | Syntax highlighting |
| `syntax-highlight/tokenize.ts` | Syntax highlighting |
| `table-export.ts` | Frontend utility — see source |
| `table-title-tags.ts` | Frontend utility — see source |
| `types.ts` | Frontend utility — see source |
| `ui-message-stream.ts` | Frontend utility — see source |
| `utils.ts` | Frontend utility — see source |

## Related

- [`../systems/frontend-architecture.md`](../systems/frontend-architecture.md)
- [`../systems/chat-system.md`](../systems/chat-system.md)
