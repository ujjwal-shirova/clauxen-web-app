# Claude Code agent core (stripped)

Originally `@anthropic-ai/claude-code@2.1.88` source extracted from `cli.js.map`.

## Stripped (macOS Trash) — terminal / CLI only

Removed so this tree is not a runnable Ink CLI:

- `cli.js`, `cli.js.map`, root `vendor/` (ripgrep, audio-capture)
- `source/vendor/` NAPI stubs
- `source/src/ink/`, `screens/`, `components/`, `cli/`, `commands/`
- `buddy/`, `vim/`, `voice/`, `keybindings/`, `native-ts/`, `moreright/`
- `main.tsx`, `replLauncher.tsx`, `interactiveHelpers.tsx`, `dialogLaunchers.tsx`, `entrypoints/cli.tsx`
- All `tools/**/UI.tsx` Ink renderers

## Kept for later web wiring (not imported by Next yet)

| Path | Role |
|------|------|
| `source/src/query.ts`, `query/`, `QueryEngine.ts` | Agent loop |
| `Tool.ts`, `tools.ts`, `tools/*` | Tool implementations (no UI) |
| `services/` | API client, tool orchestration, MCP, compact, … |
| `utils/` | messages, permissions logic, helpers |
| `skills/`, `tasks/`, `memdir/`, `remote/`, `bridge/` | Agent features |
| `entrypoints/sdk/`, `sdk-tools.d.ts` | SDK schemas |
| `types/`, `constants/`, `state/`, … | Shared types / config |

**Do not import this tree into Next.js routes directly.** It still uses `bun:bundle`, missing modules (`types/message.ts`), and Node/local FS assumptions. Wire by porting into `src/server/inference` + `src/components/agent` (DOM).

Excluded from TypeScript program via root `tsconfig.json` `exclude: ["src/agent"]`.
