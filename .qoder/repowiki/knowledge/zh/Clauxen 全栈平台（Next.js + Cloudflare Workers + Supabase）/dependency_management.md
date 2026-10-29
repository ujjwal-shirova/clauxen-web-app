## 1. 工具与整体方案

- **包管理器**：npm（根 `package.json` 通过 `"packageManager": "npm@11.12.1"` 锁定版本，配合根级 `package-lock.json`）。
- **运行时约束**：根 `engines.node >= 20.0.0`、`engines.npm >= 10.0.0`。
- **部署平台**：Next.js 应用（Vercel / OpenNext）+ Cloudflare Workers 集群。Workers 通过 `wrangler`（`^4.149.0`）构建和部署。
- **私有包策略**：所有子包均声明 `"private": true`，未发布到 npm registry；包之间不通过 npm 互相引用，而是通过共享源码目录 `src/shared`、`src/server` 等路径被 Next.js 代码引用。
- **无 monorepo workspace**：仓库没有 `workspaces` 字段，也没有 pnpm/yarn/bun 配置文件，每个 `workers/*` 是独立 npm 包，拥有自己的 `package.json`、`tsconfig.json` 以及可选的 `package-lock.json`。

## 2. 关键文件

- `package.json`：根依赖清单、脚本入口、`overrides` 集中修复冲突依赖。
- `package-lock.json`：根级锁文件，npm 安装时生成。
- `workers/*/package.json`：各 Worker 子包的依赖声明（auth-email、billing、chat-coord、chat-history、cdn、generations-watchdog、github-agent、native-auth、oauth-broker、plugin-oauth、r2-gateway、scheduled-tasks、share-gate、supabase-proxy）。
- `.github/workflows/deploy-cloudflare-workers.yml`：CI 中通过 `setup-node@v4` + `CLOUDFLARE_API_TOKEN` 调用 `scripts/deploy-cloudflare-workers.sh` 部署 Workers。
- `scripts/deploy-cloudflare-workers.sh`、`scripts/cloudflare-run.mjs`：封装 wrangler 命令的部署/预览脚本。
- `wrangler.jsonc`：Cloudflare 账户与默认环境配置。

## 3. 架构与约定

### 3.1 依赖范围分层

| 层级 | 内容 | 位置 |
|---|---|---|
| 应用运行时依赖 | Next.js、React、Supabase SDK、OpenAI、Razorpay、Zod 等业务库 | 根 `dependencies` |
| 开发工具链 | TypeScript、ESLint、Prettier、Tailwind v4、shadcn、wrangler、supabase CLI | 根 `devDependencies` |
| Worker 依赖 | 仅该 Worker 运行所需的库（如 billing 只依赖 `pdf-lib`） | 各 `workers/*/package.json` |
| 共享逻辑 | `src/shared`、`src/server` 等纯 JS/TS 模块，不打包为 npm 包，由 Next.js 直接 import | 源码目录 |

### 3.2 依赖冲突收敛：`overrides`

根 `package.json` 使用 npm `overrides` 强制提升以下依赖的版本，解决嵌套子树中的不一致：
- `axios ^1.8.4`
- `postcss ^8.5.12`
- `ws ^8.18.1`
- `prismjs ^1.30.0`

同时，部分 Worker 也单独声明 `overrides`，例如 `workers/auth-email/package.json` 和 `workers/billing/package.json` 中将 `@cloudflare/workers-types` 锁定在 `^4.20250525.0`，避免与根依赖冲突。

### 3.3 版本语义

- 所有第三方依赖统一使用 `^` 语义化版本（semver），允许小版本升级。
- 框架类依赖（next、react、react-dom、typescript、tailwindcss、wrangler）保持主版本对齐，反映工程对稳定 API 的依赖。

### 3.4 Workers 子包隔离

每个 `workers/<name>/package.json` 结构一致：
- `name` 以 `clauxen-<service>` 命名（除 github-agent、oauth-broker、supabase-proxy 等历史命名）。
- `scripts.dev` = `wrangler dev`，`scripts.deploy` = `wrangler deploy`。
- 依赖最小化：Worker 只声明其运行时需要的 npm 包，其余逻辑从 `src/` 共享源码引入。
- 部分 Worker（auth-email、billing、chat-history、scheduled-tasks、plugin-oauth）维护独立的 `package-lock.json`，便于单独 `npm install`。

### 3.5 私有注册表与 vendoring

- 未发现 `.npmrc`、`registry`、`//npm.pkg.github.com/:_authToken=`、`GOPRIVATE` 或 `vendor/` 目录。所有依赖均来自公共 npm registry。
- 内部包不通过 npm 发布，也不存在私有 registry 配置。

## 4. 观察到的约定与规则

- **约定**：新增 Worker 时在 `workers/` 下新建目录，并复制既有 Worker 的 `package.json`/`wrangler.toml` 模板，其中 `name` 使用 `clauxen-<service>` 前缀，`scripts` 提供 `dev`、`deploy`、`types` 三个标准脚本。
- **约定**：跨 Worker 共享的代码放在 `src/shared` 或 `src/server`，由 Next.js 应用直接 import，而不是拆成 npm 包——这避免了子包间的循环依赖和发布流程。
- **约定**：当某个 Worker 需要固定某个底层依赖版本时，在其 `package.json` 中追加 `overrides`，而非修改根 `overrides`。
- **约定**：所有子包声明 `"private": true`，禁止意外发布。
- **约定**：CI 仅触发 `deploy-cloudflare-workers.yml` 手动工作流，通过 `CLOUDFLARE_API_TOKEN` 或兼容的 `Cloudflare_Token` secret 进行部署；若两个 secret 均未设置则跳过部署。
- **约束**：根 `package.json` 通过 `engines` 强制 Node ≥ 20、npm ≥ 10；开发者环境需满足该要求才能正常执行 `npm install` 与后续脚本。
- **约束**：根 `package.json` 通过 `"packageManager": "npm@11.12.1"` 锁定 npm 版本，确保依赖解析一致性。
- **约束**：根依赖冲突统一通过 `overrides` 收敛，避免在多个子包中重复处理同一依赖。
- **约束**：Workers 子包不使用 `workspaces` 管理，因此 `npm install` 不会自动链接子包之间的依赖；跨包共享必须走源码引用。

## 5. 风险点

- 根 `dependencies` 包含大量 UI 组件库（Radix、Tailwind 生态、Framer Motion 等），而 Workers 子包本身几乎不含这些依赖——这是合理的运行时隔离，但需注意某些 Worker 可能误引入了浏览器-only 依赖。
- 根 `overrides` 会改写整个依赖树，升级时应审查是否影响已测试的 Worker 行为。
- 子包间缺乏统一的依赖版本同步机制（无 workspaces lockfile），长期演进可能出现同一库在根与各 Worker 中出现多个版本的情况。