---
name: clauxen-inference
description: >-
  Clauxen inference: Provider_* env, system prompts, personalization modules, tools (Exa/sandbox), SSE framing, autonomous agent bridge, Shirova Messages API. Use when changing models, prompts, tools, streaming, thinking agent, or Provider_BASE_URL / Provider_Model_Clauxen_V1.
---

# Clauxen inference

## Read first

- `docs/systems/inference-and-models.md`
- `docs/systems/autonomous-agent.md`
- `src/models-system-prompts/`

## Secrets (server-only)

`Provider_API_Key`, `Provider_BASE_URL`, `Provider_Model_Clauxen_V1`, `Provider_SANDBOX_TIMEOUT_MS`  
**Never** `NEXT_PUBLIC_`. Fail closed via require* helpers.

Anthropic URL: derive from `Provider_BASE_URL` (`/openai` → `/anthropic`).

## Prompt layering

1. Persona (`virgil.md` / model card)
2. Modular personalization `.md` (base-style + warm/enthusiastic/headers/emoji)
3. User custom instructions append
4. Capabilities (web/canvas/connectors — no voice)
5. Follow-up instruction **only if** setting ON
6. Project instructions + RAG
7. Tools / autonomous steering (may omit prose system prompt)

Do **not** hardcode warm/emoji/list personality into `virgil.md`.

## Key modules

`src/backend/inference/*` — novita/openai/anthropic streams, agent-engine, tools, system-prompt  
`src/backend/services/user-personalization.service.ts`  
`src/backend/services/personalization-style-instructions.ts`  
`src/app/api/shirova/v1/messages/route.ts`

## Tools env

`EXA_API_KEY`, `FAL_KEY`, `PARALLEL_API_KEY`, `GOOGLE_PLACES_API_KEY`

## Edge flags

`readEdgeFlags()` — `maintenanceMode` → generate 503.

## Additional resources

- [reference.md](reference.md)
