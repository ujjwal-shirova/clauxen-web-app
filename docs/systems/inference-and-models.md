# Inference and Models

## 1. Principles

1. **Server-only secrets** — `Provider_API_Key`, `Provider_BASE_URL`, `Provider_Model_Clauxen_V1`, `Provider_SANDBOX_TIMEOUT_MS`. Never `NEXT_PUBLIC_`.
2. **Fail closed** — `requireProviderApiKey` / `requireProviderBaseUrl` / `requireExaApiKey` style guards.
3. **No hardcoded vendor URLs/keys** in source.
4. **Anthropic-compatible URL** derived from `Provider_BASE_URL` by rewriting `/openai` → `/anthropic` when needed.
5. Edge Config can kill/maintenance models without redeploy.

---

## 2. Key modules

| Path | Role |
|---|---|
| `src/backend/inference/novita.ts` | Core chat completions + sanitize + SSE helpers |
| `src/backend/inference/novita-stream.ts` / `novita-client.ts` / `novita-fetch.ts` | Streaming client |
| `src/backend/inference/openai-stream.ts` / `openai-client.ts` | OpenAI-compatible path + titles |
| `src/backend/inference/anthropic-messages-client.ts` | Anthropic Messages |
| `src/backend/inference/clauxen-sse-stream.ts` | SSE headers / framing |
| `src/backend/inference/clauxen-ui-stream.ts` | UI event writer |
| `src/backend/inference/agent-engine.ts` / `agent-stream.ts` | Agent orchestration |
| `src/backend/inference/thinking-agent-stream.ts` | Thinking / interleaved reasoning |
| `src/backend/inference/tool-executor.ts` / `platform-tools.ts` | Tool execution |
| `src/backend/inference/system-prompt.ts` / `model-prompts.ts` / `agent-system-prompt.ts` | Prompt assembly |
| `src/backend/services/user-personalization.service.ts` | Append personalization |
| `src/backend/services/personalization-style-instructions.ts` | Load modular `.md` styles |
| `src/lib/inference-routing.ts` | Route selection |
| `src/lib/model-catalog.ts` / `model-config.ts` / `chat-models.ts` | Catalog parsing |
| `src/lib/model-effort.ts` | Homer reasoning effort |
| `src/models-system-prompts/virgil.md` | Base persona card |
| `src/models-system-prompts/personalization/**` | Modular style instructions |
| `src/app/api/shirova/v1/messages/route.ts` | External Anthropic-compatible proxy |

---

## 3. Model personas / routing

Internal personas historically include Homer / Helios / Virgil, routed through provider OpenAI- and Anthropic-compatible endpoints.

Default chat model comes from **`Provider_Model_Clauxen_V1`** (example slug `moonshotai/kimi-k2.6`).

Thinking / autonomous tool loops may use a thinking-capable model (e.g. DeepSeek V4 Pro) when `thinkingType` enabled — see backend.md and agent recipes (`novita-agent-recipes.ts`).

`SHIROVA_THINKING_TYPE` env influences thinking behavior.

---

## 4. System prompt assembly

Order of composition (conceptual):

1. Base persona markdown (`virgil.md` or selected model card)
2. Modular personalization style instructions (base-style + warm/enthusiastic/headers/emoji More|Default|Less)
3. User custom instructions append (`buildUserPersonalizationAppend`)
4. Capability flags (web search, canvas, connector search — no voice)
5. Follow-up instruction **only if** Settings follow-ups ON
6. Project instructions + RAG snippets when in a project chat
7. Tool schemas / steering (autonomous path may omit prose system prompt and steer via tools)

Personality UI row was removed as duplicate of base style; `virgil.md` should not hardcode warm/emoji/list personality.

---

## 5. Tools

Platform tools (Exa web search/fetch, sandbox execute, file ops, skills, places, image, etc.) live under inference + autonomous-agent tool folders.

Environment:

| Key | Tool |
|---|---|
| `EXA_API_KEY` | Web search/fetch |
| `FAL_KEY` | Image generation |
| `PARALLEL_API_KEY` | Parallel web |
| `GOOGLE_PLACES_API_KEY` | Places |
| Sandbox provider keys | Code execution |

Bash safety: `bash-safety.ts`. Tool healer: `tool-healer.ts`.

---

## 6. Streaming to the UI

Generate path:

1. `chat.service` creates stream via `createChatStream` / agent stream
2. Tokens + reasoning + tool events framed as SSE
3. Client reducer updates assistant message fields
4. Agent frames track durations for Thought/Worked labels
5. Terminal error must surface as visible text

Conversation context for follow-ups includes prior tool actions.

---

## 7. Prompt cache & telemetry

- `prompt-cache.ts` — provider prompt caching helpers where supported
- `logInferenceTelemetry` — usage logging
- `record_model_usage` RPC / `model_usage_events`

---

## 8. Titles

`generateOpenAiTitle` / derive helpers in `chat-title.ts` — often run in `after()` so TTFT stays clean.

---

## 9. Autonomous agent bridge

When web search or thinking enabled, main chat may bridge into `src/autonomous-agent` loop (no system prompt; tool-steered). See [`autonomous-agent.md`](./autonomous-agent.md).

---

## 10. External Messages API

`POST /api/shirova/v1/messages` — Anthropic Messages API-compatible proxy for programmatic clients.

API keys (`clx_…`) authenticate v1 surface broadly.

---

## 11. Edge flags

`readEdgeFlags()` from Edge Config:

- `maintenanceMode` → generate returns 503
- Model kill-switches / feature gates as configured

---

## 12. Related

- [`chat-system.md`](./chat-system.md)
- [`autonomous-agent.md`](./autonomous-agent.md)
- [`settings-and-personalization.md`](./settings-and-personalization.md)
