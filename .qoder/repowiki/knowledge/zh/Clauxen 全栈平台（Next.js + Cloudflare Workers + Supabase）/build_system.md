## 1. 整体架构

本项目采用 **双平台部署** 策略：
- **Cloudflare App (Workers)**：通过 `@opennextjs/cloudflare` 将 Next.js 应用编译为 Cloudflare Workers，由 `wrangler.jsonc` 定义主入口、服务绑定、R2/KV/Queue/Hyperdrive 等资源。
- **Vercel**：保留 Next.js 原生运行时作为备用/对比平台，由 `vercel.json` 配置构建命令、函数内存与时限、HTTP 安全头与缓存策略。

所有构建与部署均通过 npm scripts 统一编排，CI（GitHub Actions）在 `.github/workflows/` 中触发。无 Makefile / Dockerfile；Docker 仅用于本地开发（`docker-compose.yml`）。

## 2. 关键文件与职责

| 文件 | 职责 |
|---|---|
| `package.json` | 唯一脚本入口：`build` / `cf:build` / `cf:deploy` / `test:*` / `supabase:*` / `plugins:endpoints` 等 |
| `wrangler.jsonc` | Cloudflare App 主 Worker 配置：account_id=8fc7a679057989309921f362784ecf4、routes(custom domain)、services(跨 Worker 调用)、hyperdrive、r2_buckets、kv_namespaces、queues、placement(aws:us-west-1) |
| `cloudflare-worker.ts` | OpenNextJS 适配的 Cloudflare Workers 入口 |
| `open-next.config.ts` | 启用 R2 增量缓存 (`@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache`) |
| `vercel.json` | Vercel 框架配置、函数内存/超时、HTTP 安全头、CDN 缓存策略 |
| `.github/workflows/deploy-cloudflare-app.yml` | 主应用部署流水线（workflow_dispatch 触发） |
| `.github/workflows/deploy-cloudflare-workers.yml` | 子 Worker 集群部署流水线 |
| `scripts/deploy-cloudflare-workers.sh` | 批量部署 `workers/` 下各独立 Worker 的统一脚本 |
| `supabase/config.toml` + `supabase/migrations/*.sql` | 数据库迁移管理（Supabase CLI） |
| `apphosting.yaml` | Google App Engine 相关（非主流路径） |

## 3. 构建流程

### 3.1 前端 + API 构建（Next.js）
```bash
npm run build            # node scripts/bundle-server-text.mjs && bundle-research-exports.mjs && next build
npm run vercel-build     # 同上，供 Vercel 使用
```
构建前会执行两个 bundler 脚本以预处理服务端文本与研究导出，再交给 `next build`。

### 3.2 Cloudflare Workers 构建
```bash
npm run cf:build         # cloudflare-run.mjs opennextjs-cloudflare build && verify-cloudflare-build.mjs
npm run cf:preview       # opennextjs-cloudflare preview
npm run cf:release       # cf:build && cf:deploy
```
通过 `@opennextjs/cloudflare` 适配器将 Next.js 产物输出到 `.open-next/`，并由 `wrangler.jsonc` 中的 `assets.directory = ".open-next/assets"` 引用。

### 3.3 独立 Worker 构建
每个 `workers/<service>/` 目录是独立的 wrangler 项目（含各自的 `wrangler.toml` 或 `wrangler.jsonc`），通过 `scripts/deploy-cloudflare-workers.sh` 顺序部署：`chat-history` → `r2-gateway` → `auth-email` → `chat-coord` → `scheduled-tasks` → `billing` → `generations-watchdog`。

## 4. CI 流水线

### 4.1 主应用（Cloudflare App）
`.github/workflows/deploy-cloudflare-app.yml`：
- 触发方式：`workflow_dispatch`（手动触发）
- Node 版本：24（与 `engines.node >=20` 兼容）
- 预检：校验 `CLOUDFLARE_API_TOKEN`、`NEXT_PUBLIC_SUPABASE_*` 等 secret 存在
- 测试阶段：`test:cloudflare:build` + `test:cloudflare` + `test:background` + `test:scheduled`
- 构建+部署：`npm run cf:build` → `npm run cf:deploy`
- 冒烟：`node scripts/verify-cloudflare-http.mjs`
- 并发控制：`concurrency.group = "cloudflare-app-production"`，取消进行中任务

### 4.2 子 Worker 集群
`.github/workflows/deploy-cloudflare-workers.yml`：
- 支持两个 secret 别名：`CLOUDFLARE_API_TOKEN` 或 `Cloudflare_Token`（Cursor runtime 约定）
- 若 token 缺失则跳过部署
- 执行 `scripts/deploy-cloudflare-workers.sh`，并可选执行 `scripts/wire-auth-email-vercel.sh`（需要 `VERCEL_TOKEN`）

## 5. 环境变量与密钥管理

- **公共变量**：通过 GitHub `vars.*` 注入（如 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_RAZORPAY_KEY_ID`）。
- **Secrets**：通过 GitHub `secrets.*` 注入（如 `NEXT_PUBLIC_SUPABASE_ANON_KEY`、`CLOUDFLARE_API_TOKEN`）。
- **Worker Secrets**：由 `deploy-cloudflare-workers.sh` 通过 `npx wrangler secret put` 写入 Cloudflare dashboard（临时文件权限 `chmod 600`）。
- **内部令牌**：脚本自动生成 `CHAT_HISTORY_INTERNAL_TOKEN`、`AUTH_EMAIL_INTERNAL_TOKEN`、`CHAT_COORD_INTERNAL_TOKEN`、`BILLING_INTERNAL_TOKEN` 等，并在 Vercel 端同步（需 `VERCEL_TOKEN`）。
- **环境常量硬编码**：Cloudflare Account ID `8fc7a679057989309921f362784ecf4` 同时出现在 workflow 与 `wrangler.jsonc`。

## 6. 依赖与版本约束

- Node ≥ 20、npm ≥ 10（`engines` 字段）。
- 锁定包管理器：`"packageManager": "npm@11.12.1"`。
- 依赖升级策略：`overrides` 强制修复 `axios`、`postcss`、`ws`、`prismjs` 等安全漏洞。
- TypeScript 6 + ESLint 9 + Prettier 3 + Tailwind v4 + Next.js 16 + React 19。

## 7. 测试与类型检查

- `npm run test:*`：基于 `node --test` 与 `tsx --test` 的混合测试套件。
- `npm run typecheck`：先运行 `next typegen` 生成 Cloudflare 类型，再 `tsc --noEmit`。
- `npm run lint` / `lint:fix`：ESLint 严格模式（`--max-warnings=0`）。
- `npm run format` / `format:check`：Prettier。

## 8. 数据库与迁移

- 使用 Supabase CLI：`npm run supabase:db:push` 推送 SQL 迁移。
- 迁移文件位于 `supabase/migrations/`，命名规范 `<YYYYMMDDHHMMSS>_描述.sql`，按时间戳顺序执行。
- 包含业务表、RLS 策略、存储桶、索引、函数等全部 DDL。

## 9. 约定与规则

- **平台切换**：通过环境变量 `HOSTING_PLATFORM=cloudflare|vercel` 切换后端行为，`open-next.config.ts` 仅在 Cloudflare 路径生效。
- **Worker 间通信**：通过 `wrangler.jsonc` 的 `services` 字段声明式绑定（如 `CHAT_COORD` → `clauxen-chat-coord`），而非裸 URL。
- **静态资源缓存**：`vercel.json` 对 `_next/static` 设置 1 年 immutable 缓存，`/assets/*` 设置 1 天 + stale-while-revalidate。
- **API 不缓存**：`/api/*` 响应头强制 `no-store`。
- **安全头**：根路径默认添加 HSTS、X-Frame-Options、Referrer-Policy、Permissions-Policy 等 CSP 相关头。
- **长耗时 API 单独调优**：`vercel.json` 中针对 `v1/chats/**/generate`、`v1/agent/**`、`v1/sandbox/**`、`v1/novita/**`、`shirova/**` 等路由分别设置 `memory: 1024`、`maxDuration: 300`。
- **Cloudflare 区域固定**：`wrangler.jsonc` 中 `placement.region = "aws:us-west-1"`。
- **可观测性**：`wrangler.jsonc` 开启 `observability`，采样率 5%，隐藏查询字符串。
- **CI 不可自动触发**：两个 workflow 均为 `workflow_dispatch`，部署必须手动确认。