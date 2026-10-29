## 概述

Clauxen 的配置系统围绕三个层次组织：

1. **静态/部署层** — `wrangler.jsonc`（Cloudflare Workers）、`vercel.json`（Vercel）、`open-next.config.ts`、`apphosting.yaml` 等声明式配置。
2. **服务端运行时配置** — `src/server/config/env.ts` 集中从 `process.env` 解析应用级常量，并通过 `require*` 校验函数强制缺失密钥失败。
3. **边缘特性开关** — `src/server/config/edge-flags.ts` 通过 Cloudflare KV (`APP_CONFIG_KV.feature-flags`) 动态下发 feature flag，默认回退到本地默认值。

该仓库没有使用 `.env` 模板或第三方配置库；所有变量名以硬编码字符串 + fallback 链的方式维护在源码中，由脚本同步到 Vercel / Cloudflare dashboard。

## 关键文件

- `src/server/config/env.ts` — 单一入口，导出 `env` 对象和 `requireDatabaseUrl` / `requireProviderApiKey` / `requireOpenAIApiKey` / `requireExaApiKey` / `requireAssemblyAiApiKey` / `requireR2InProduction` / `getR2S3Endpoint` 等强类型 accessor。
- `src/shared/lib/vercel-env.ts` — 定义 `CANONICAL_VERCEL_ENV_KEYS`（33 个键）和 `USER_FILL_ENV_KEYS`，提供 `bootstrapVercelEnvAliases()` 将 Supabase / Provider_* 别名回填到标准键，并优先选择 Supabase 事务池器 URL（端口 6543）。
- `src/server/config/edge-flags.ts` — 从 Cloudflare KV 读取 `feature-flags` JSON，返回 `ClauxenEdgeFlags`（`maintenanceMode`、`modelOverride`、`disableTools`、`providerFailover`），读取失败时 `console.warn` 并回退到 `DEFAULT_FLAGS`。
- `src/server/config/cloudflare-perf-profile.ts` — 纯常量，描述 Cloudflare zone 性能检查清单，不是运行时代码，仅供 ops 参考。
- `wrangler.jsonc` — 声明 Worker services 绑定（`CHAT_COORD`、`CHAT_HISTORY`、`BILLING`、`AUTH_EMAIL`、`SHARE_GATE`…）、Hyperdrive、R2 buckets、KV namespace (`APP_CONFIG_KV`)、queues、placement (`aws:us-west-1`)、vars（`HOSTING_PLATFORM=cloudflare`、`STORAGE_REQUIRE_R2=true` 等）。
- `scripts/sync-vercel-env.mjs`、`scripts/bootstrap-db-env.mjs`、`scripts/cleanup-vercel-env.mjs`、`scripts/reconcile-vercel-env-api.mjs`、`scripts/audit-public-env.mjs` — 用于向 Vercel 注入/审计环境变量。

## 架构与设计约定

### 环境变量解析策略

`env.ts` 中的每个字段都采用 `optional(name, fallback)` 或 `firstOptional(...names)` 模式，按优先级合并多个来源。例如 provider API key 的优先级是：

```
PROVIDER.apiKey → NOVITA_AI_KEY → NOVITA_API_KEY → OPENAI_API_KEY
```

模型 slug 统一经过 `normalizeUpstreamModelSlug` 处理，并以 `MODEL_CONFIG.models.<model>.defaultSlug` 作为最终兜底。

数据库 URL 优先选择 Supabase 事务池器 URL（`isSupabasePoolerUrl(value, "6543")`），避免 Vercel 隔离耗尽连接数。

### 安全与“fail-closed”原则

- 所有敏感凭据（`databaseUrl`、`supabaseServiceRoleKey`、`jwtSecret`、`r2ApiToken`、各 Worker internal token）仅在服务器端访问。
- `require*` 函数在浏览器环境直接抛错（`"... credentials are server-only."`），并在缺少值时抛出明确错误信息。
- `authRequiredForChat` 默认 `true`；`billingRequireWorker` 默认 `false`，但注释说明生产上应 fail closed。
- `storageRequireR2` 在 `VERCEL=1` 或 `HOSTING_PLATFORM=cloudflare` 时强制为 `true`，未配置 R2 时 `requireR2InProduction()` 抛错。
- `AUTH_DEV_BYPASS` 仅当非生产且显式设为 `true` 时才生效，注释强调 “Never allow unsigned cookie bypass on Vercel / production.”

### 运行时特性开关

Feature flags 不通过 `process.env` 下发，而是通过 Cloudflare KV 的 `APP_CONFIG_KV.feature-flags` 键以 JSON 形式存储，支持在不停机情况下切换 maintenance mode、模型覆盖、工具禁用等。`readEdgeFlags()` 对 KV 读异常做防御性降级。

### 服务间通信配置

各 Cloudflare Worker 的 URL 和内部 secret 成对出现：`xxxWorkerUrl` + `xxxInternalToken`（chat-history、chat-coord、auth-email、billing、share-gate、generations）。URL 同时暴露公共 `NEXT_PUBLIC_*` 版本（如 `NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL`）供前端使用，internal token 则严格保留在服务端。

### 平台检测

`isVercel = process.env.VERCEL === "1"`，`isProduction = NODE_ENV === "production" || isVercel`。`HOSTING_PLATFORM` 由 `wrangler.jsonc` vars 设置为 `cloudflare`，被 `env.ts` 用作存储后端决策依据。

## 约定与约束

- **单一事实源**：`src/shared/lib/vercel-env.ts` 中的 `CANONICAL_VERCEL_ENV_KEYS` 是所有可部署环境变量的权威清单；新增环境变量需在此处注册，否则 sync 脚本不会管理它。
- **向后兼容别名**：旧 `NOVITA_*`、`OPENAI_*`、`SHIROVA_*` 环境变量仍被接受，但新代码应使用 `Provider_*` 命名空间，并通过 `bootstrapVercelEnvAliases()` 自动回填。
- **必须显式 require**：需要数据库连接或 LLM 凭据的代码应调用对应的 `require*` 函数，而不是直接读取 `process.env`，以确保缺省时快速失败并给出清晰错误消息。
- **生产环境禁止本地回退**：`storageRequireR2` 在 Vercel / Cloudflare 上强制启用，禁止使用 `STORAGE_LOCAL_PATH` 本地磁盘回退。
- **Worker 间认证**：Worker 间内部路由一律通过 shared secret token（`chatHistoryInternalToken`、`chatCoordInternalToken`、`billingInternalToken`、`shareWorkerInternalToken`、`scheduledTasksInternalToken`、`generationsInternalToken`）鉴权，而非公开 URL。
- **KV feature flags 容错**：KV 读取失败不会中断启动，仅 `console.warn` 并回退 `DEFAULT_FLAGS`，保证本地开发不受 KV 状态影响。
- **URL 规范化**：所有外部 URL 字段统一经 `normalizeBaseUrl` 去除尾部斜杠，避免下游拼接错误。
- **Next.js 公共变量**：只有以 `NEXT_PUBLIC_` 前缀开头的变量才会被 Next.js 编译进客户端 bundle；`env.ts` 中通过 `optional("NEXT_PUBLIC_X", ...)` 显式声明哪些值需要暴露给前端。