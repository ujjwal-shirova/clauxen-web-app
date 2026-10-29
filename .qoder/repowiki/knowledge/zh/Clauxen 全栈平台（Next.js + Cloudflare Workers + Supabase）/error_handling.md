## 1. 总体方案

该项目没有引入第三方错误库，而是自行定义了两层错误类型：

- **服务端领域错误** `AppError`（`src/server/db/errors.ts`）——用于 Next.js API handler 内部抛出的业务/基础设施错误。
- **客户端网络错误** `ApiError`（`src/shared/lib/api/client.ts`）——用于浏览器端 `apiFetch` 在 HTTP 响应异常时抛出的错误。

两端共享统一的 JSON 错误体格式 `{ error: { message, code } }`，由服务器端的 `jsonError`（`src/server/http/api-response.ts`）序列化输出，并由客户端解析后转换为 `ApiError`。数据库层通过 `mapPgError` 把 PostgreSQL 驱动异常映射为 `AppError`，避免原始 SQL 错误码泄漏到客户端。

## 2. 关键文件与职责

| 文件 | 职责 |
|---|---|
| `src/server/db/errors.ts` | 定义 `AppError`、构造器辅助函数 `notFound/unauthorized/forbidden/conflict`、PostgreSQL 错误映射 `mapPgError` |
| `src/server/http/api-handler.ts` | `withApiHandler` 包装器：统一鉴权、`AppError` 捕获、请求 ID 注入、Server-Timing 统计 |
| `src/server/http/api-response.ts` | `jsonData` / `jsonError`：统一响应体结构，生产环境屏蔽敏感消息 |
| `src/shared/lib/api/client.ts` | 浏览器端 `ApiError`、`apiFetch`、`sessionFetch`、401 单飞刷新会话 |
| `src/app/global-error.tsx` | Next.js 根级全局错误边界，防止默认 "This page couldn't load" 页面渲染 |

## 3. 架构与约定

### 3.1 服务端错误模型 `AppError`

```ts
class AppError extends Error {
  readonly status: number;
  readonly code: string; // 如 "bad_request", "not_found", "database_error"
}
```

所有领域错误通过工厂函数抛出，而非直接 `new AppError(...)`：

- `notFound(message)` → 404 / `not_found`
- `unauthorized(message)` → 401 / `unauthorized`
- `forbidden(message)` → 403 / `forbidden`
- `conflict(message)` → 409 / `conflict`

数据库错误统一走 `mapPgError(error, scope)`，按 PostgreSQL 错误码映射：

- `P0001` + "chat not found" → 404 `not_found`
- `23505` → 409 `conflict`
- `23503` → 400 `invalid_reference`
- `53300` / `XX000`（连接池满、too many connections）→ 503 `database_busy`
- `ETIMEDOUT` / `ECONNREFUSED` / 连接超时 → 503 `database_unavailable`
- 非生产环境的 `42703` / `42P01`（缺失列/表）→ 返回原始 SQL 消息以便调试
- 其他 → 500 `database_error`

### 3.2 API 网关 `withApiHandler`

每个 Next.js API Route 通过 `withApiHandler(handler, options?)` 包裹，提供：

- 可选的 `requireAuth` / `requireChatAuth` 鉴权拦截
- 对 `AppError` 调用 `jsonError` 转为结构化响应
- 对所有未捕获异常包装为 `AppError(String(error), 500)` 再经 `jsonError` 输出
- 自动附加 `X-Request-Id` 和 `Server-Timing` 头
- 用 `withDatabaseRequest` 包装整个请求生命周期，确保数据库连接正确释放

### 3.3 响应格式化 `jsonError`

```ts
NextResponse.json({ error: { message, code } }, { status })
```

- 对 `AppError`：直接使用其 `status` / `code`；当 `code === "database_error"` 且处于生产环境时，将 message 替换为通用文案，防止 SQL 细节泄露。
- 对普通 `Error`：message 在生产环境被 `publicErrorMessage` 降级为 "Internal server error."，code 固定为 `internal_error`。

### 3.4 客户端错误模型 `ApiError`

浏览器端 `apiFetch` 解析后端返回的 `{ error: { message, code } }`，失败时抛出 `ApiError(status, code)`，让上层 UI 可按 `error.code` 分支处理（如 `security_challenge`、`invalid_json`、`empty_response`）。同时内置 60s 超时、401 单飞刷新 Supabase session、以及安全挑战重试逻辑。

### 3.5 前端全局错误边界

`src/app/global-error.tsx` 是 Next.js App Router 的根错误边界，显式阻止默认错误页渲染，改为记录日志并通过内联脚本尝试最多两次自动 reload，最终 fallback 到首页。

## 4. 观察到的约定与约束

- **业务侧只抛 `AppError`**：API handler 内的领域逻辑使用 `notFound/unauthorized/forbidden/conflict` 等工厂函数，而不是裸 `throw new Error(...)`。`mapPgError` 是数据库层的唯一出口。
- **所有 API 响应遵循同一 JSON 结构**：成功 `{ data }`，失败 `{ error: { message, code } }`。这是 `jsonData` 与 `jsonError` 共同约定的契约。
- **生产环境不泄露内部细节**：`jsonError` 对 `database_error` 与未知 `Error` 使用通用 message；`mapPgError` 在非生产环境才暴露原始 SQL 消息。
- **错误必须带语义化 `code`**：`AppError` 与 `ApiError` 都要求 `code` 字段，便于调用方区分可恢复错误（`database_busy`、`security_challenge`）与不可恢复错误。
- **API 路由必须经 `withApiHandler`**：该包装器集中处理鉴权、错误捕获、请求追踪，使各 API 无需重复 try/catch。
- **浏览器端 `ApiError` 作为网络层异常边界**：`apiFetch` 内部吞掉 JSON 解析失败并转成 `ApiError("Invalid JSON response.")`，避免上层收到未定义的 payload。
- **全局错误边界禁止默认错误页**：`global-error.tsx` 注释明确要求 "Must never paint Next's builtin DefaultGlobalError"。

## 5. 适用范围

该模式主要覆盖 Next.js API Routes 与服务端业务层；Cloudflare Workers 子服务（`workers/*`）各自独立部署，未见统一的跨 Worker 错误类型定义，但本仓库的 `src/server` 层即为面向外部（浏览器、CLI、其他 Worker）的统一错误入口。