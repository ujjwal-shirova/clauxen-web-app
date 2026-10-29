## 1. 使用的系统与方法

- **CSS 框架**：Tailwind CSS v4（`@tailwindcss/postcss`），通过 `postcss.config.mjs` 启用，`tailwind.config.ts` 中声明了 Tailwind 的 content glob、扩展主题与插件。
- **组件库**：shadcn/ui（`components.json` 中 `$schema` 指向其 schema，`style: "default"`，`baseColor: "neutral"`，`cssVariables: true`，`rsc: true`）。图标库为 `lucide`。
- **排版**：`@tailwindcss/typography` 插件；字体通过 CSS 变量注入到 Tailwind 的 `fontFamily` 扩展中。
- **动画**：`tw-animate-css` 作为 PostCSS 源引入；自定义 keyframes（`accordion-down` / `accordion-up` / `message-in`）在 `tailwind.config.ts` 中注册。
- **设计令牌**：全部以 CSS 自定义属性（`--*`）定义于 `src/app/globals.css`，并通过 `hsl(var(--*))` 映射到 Tailwind 语义色。

## 2. 关键文件

- `tailwind.config.ts` — Tailwind 配置、主题扩展、颜色/字体/圆角/动画扩展。
- `postcss.config.mjs` — 仅启用 `@tailwindcss/postcss`。
- `components.json` — shadcn/ui 脚手架配置（别名、RSC、Tailwind 集成、图标库）。
- `src/app/globals.css` — 单一核心样式表（约 11763 行），集中承载所有设计令牌、产品 chrome、按钮/状态徽章/菜单等共享组件类。

## 3. 架构与约定

### 设计令牌分层
`globals.css` 顶部注释明确声明“SINGLE CORE STYLESHEET”，要求在此文件中编辑颜色、字体、半径、间距、页面、弹出层、按钮、字段、聊天 token 与共享工具类。令牌按领域分组：
- 基础调色板：`--background` / `--foreground` / `--card` / `--popover` / `--primary` / `--secondary` / `--muted` / `--accent` / `--destructive` / `--border` / `--input` / `--ring`。
- 品牌色：`--brand`（默认深蓝）、`--brand-strong`、`--brand-soft`、`--brand-ring`、`--link` / `--link-hover` / `--link-decoration`；可通过 `html[data-accent]` 覆盖（见第 458 行注释说明）。
- 语义状态：`--success` / `--warning` / `--info` 及其 `*-soft` 变体。
- 图表色：`--chart-1` … `--chart-5`。
- 圆角：`--radius` / `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-composer`。
- UI 密度令牌：`--icon-size` / `--icon-stroke` / `--icon-btn-size` / `--nav-row-height` / `--ui-font-size` / `--ui-control-height-*` 等，体现“compact product density”的产品密度策略。
- App shell 表面：`--app-sidebar-bg` / `--app-panel-bg` / `--chat-canvas-bg` / `--chat-user-card-bg`。
- Settings / Pricing / Chat 专属令牌：如 `--settings-*`、`--pricing-*`、`--chat-header-*` 等。

### Tailwind 映射
`tailwind.config.ts` 的 `theme.extend.colors` 把 Tailwind 语义名（`background`、`primary`、`muted`、`accent`、`destructive`、`brand`、`success`、`warning`、`info`、`border`、`input`、`ring`、`chart.*`）全部映射为 `hsl(var(--*))`，从而让 CSS 变量成为唯一事实来源。

### Dark mode
- 通过 `darkMode: "class"` 启用 class-based dark mode。
- `globals.css` 中使用 `.dark .app-btn-primary`、`.dark .app-btn-secondary` 等选择器分别给出暗色态样式。
- 另有大量针对第三方 Tailwind 颜色类（如 `bg-red-50`、`border-black/`）的补偿规则，确保未显式声明 `dark:` 的第三方类在暗色模式下仍可读。

### 组件类命名
- 应用级组件类使用 `.app-*` 前缀（如 `.app-btn`、`.app-btn-primary`、`.app-btn-secondary`、`.app-btn-ghost`、`.app-status-pill--success|warning|info|danger|neutral`、`.app-status-pill--neutral`）。
- 通用 UI 控件类使用 `.ui-*` 前缀（如 `.ui-icon-button`）。
- 这些类集中在 `globals.css` 的 `@layer components` 块中。

### shadcn/ui 集成
`components.json` 将 shadcn/ui 的组件别名指向 `@/components/ui`，utils 指向 `@/lib/utils`，并启用 RSC。项目采用 shadcn/ui 提供的原子组件作为构建基元，同时用 `.app-*` / `.ui-*` 类覆盖产品特定外观。

### 字体与排版
- 正文字体：`Inter`（通过 `--font-inter` 变量），Tailwind `fontFamily.body`。
- 标题字体：`Playfair Display`（通过 `--font-playfair` 变量），Tailwind `fontFamily.headline`。
- 代码字体：monospace。

## 4. 约定与约束

- **单一入口**：`globals.css` 顶部注释明确要求“Do not split theme into separate CSS files”，所有设计令牌与共享 chrome 必须写在该文件中（由作者直接声明的约定）。
- **颜色只通过 CSS 变量**：Tailwind 语义色全部经由 `hsl(var(--*))` 引用，禁止在组件中硬编码具体色值；这是通过 `tailwind.config.ts` 的映射强制实现的。
- **品牌色定位**：注释声明“One restrained brand accent (deep blue) is reserved for focus rings, links, active nav, and selected states — never for primary buttons.”——主按钮使用中性深灰而非品牌色。
- **Dark mode 开关方式**：依赖 `<html>` 或根元素上的 `.dark` class（`darkMode: "class"`）。
- **Accent 切换**：通过 `html[data-accent]` 覆盖 `--brand` 系列变量实现品牌色换肤（见第 458 行注释）。
- **RSC 优先**：`components.json` 中 `rsc: true`，shadcn/ui 按 React Server Components 风格生成组件。
- **图标库固定为 lucide**：由 `components.json` 的 `iconLibrary: "lucide"` 锁定。
- **响应式**：未发现专门的断点扩展或移动优先媒体查询约定；响应式行为主要依赖 Tailwind 默认的 sm/md/lg/xl 断点与容器宽度变量（`--ui-page-max-width` / `--ui-page-max-width-wide`）控制内容区最大宽度。