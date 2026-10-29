## 概述

Clauxen 平台采用**极简的结构化日志方案**：服务端统一通过 `src/server/observability/log.ts` 提供的封装函数输出 JSON Lines，直接调用 Node.js/Vercel 原生的 `console.error` / `console.warn`；Cloudflare Workers 子服务（`workers/*`）则普遍直接使用裸 `console.log` / `console.error` / `console.warn`。没有引入 pino、winston、bunyan 等第三方日志框架。

## 核心文件与职责

- `src/server/observability/log.ts`：唯一的服务端结构化日志入口，导出三个 API：
  - `logError(scope, error, fields?)`：以 `{ level: "error", scope, error, ...fields }` 形式写入 stderr。
  - `logWarn(scope, message, fields?)`：以 `{ level: "warn", scope, message, ...fields }` 形式写入 stdout。
  - `logged(scope, fields?, fallback?)`：返回错误处理器，用于 `.catch(logged("scope"))` 模式，把后台任务的失败转为可观测但不抛出的错误。
- `workers/*` 各 Worker（如 `generations-watchdog/src/index.ts`、`scheduled-tasks/src/index.ts`、`chat-history/src/index.ts`、`oauth-broker/src/broker.ts`、`billing/src/razorpay-invoice-upload.ts`、`auth-email/src/index.ts`）：直接使用 `console.*` 输出原始字符串或简单对象，无统一封装。

## 架构约定

1. **JSON Lines + Vercel 日志收集**：`log.ts` 的注释明确说明设计动机——Vercel 按 invocation 捕获 stdout/stderr，JSON Lines 可在 Vercel 日志查看器中按 `scope` 字段过滤搜索。
2. **结构化字段约定**：所有结构化日志至少包含 `level` 和 `scope` 两个字段；业务上下文通过可选的 `fields` 参数追加（例如 `userId`、`chatId`、`provider`、`purpose` 等）。
3. **错误处理模式**：后台任务推荐用 `.catch(logged("scope"))` 捕获非致命异常，确保失败可见且不会静默吞掉。
4. **Workers 未复用该模块**：Cloudflare Workers 运行环境独立于 Next.js 服务端，因此各 Worker 各自使用裸 `console.*`，没有共享 `src/server/observability/log.ts`。
5. **前端代码**：未发现前端组件有统一的 logger；调试信息多直接通过 `console.log` 输出。

## 观察到的约定与约束

- 服务端结构化日志统一使用 `logError` / `logWarn` / `logged`，而非直接 `console.error`（在 `src/server/**` 范围内可观察到该模式）。
- 所有结构化日志输出为单行 JSON（JSON Lines），便于 Vercel 日志检索。
- `logged()` 作为 `.catch` 回调使用时，默认返回 `undefined`（即不抛出），用于“尽力而为”的后台任务。
- Workers 子服务没有统一的日志抽象层，每个 Worker 自行决定 `console.log` / `console.error` / `console.warn` 的使用方式，部分还混入带前缀的字符串消息（如 `[billing]`、`[chat-history]`、`[auth-email]`）。
- 未发现仓库中存在日志级别开关、采样率、脱敏规则或集中式 sink 配置；日志格式由 `log.ts` 硬编码，不可运行时调整。