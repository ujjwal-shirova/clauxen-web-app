# ChatGPT plugin catalog

`plugins.json` is the gallery source for `/plugins`. It contains only the **1,977** plugins with a live-verified MCP URL. The Next.js catalog (`src/modules/connectors/server/plugins/catalog.ts`) reads this file and ignores any entry without `mcpUrl`.

`plugin-pages/` contains a compact HTML capture for indexed plugins. Regenerate after replacing `plugins.json` with:

```sh
node scripts/connectors/mcp-catalog/generate-plugin-pages.mjs
```

The generated captures intentionally exclude authentication state, cookies, account information, application JavaScript bundles, browser-extension code, and the ChatGPT sidebar/chrome.

## Live directory scrape

`scrape_chatgpt_catalog.mjs` captures the current public ChatGPT plugin directory the same way names and icons were originally collected: listing plus per-plugin detail from ChatGPT’s anonymous plugin APIs, including MCP server URLs where ChatGPT publishes them.

```sh
CHATGPT_STORAGE_STATE=/tmp/chatgpt-plugins-state.json \
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
node scripts/connectors/mcp-catalog/scrape_chatgpt_catalog.mjs
```

Requires Playwright driving Google Chrome (`channel: "chrome"`) so Cloudflare allows `chatgpt.com`.

**Finalized working set (2 Sep 2026):** **1,977** MCP URLs, all live-probed twice after filtering. Zero nulls.

- `mcp-url-list.json` — finalized `{ id, displayName, mcpUrl }` list
- `chatgpt-plugin-list.json` — same plugins with name, icon, website, MCP URL
- `chatgpt-catalog.json` — full metadata for those working plugins

Re-scrape and re-verify:

```sh
python3 scripts/connectors/mcp-catalog/verify_mcp_urls.py
```

That keeps only endpoints that answer as MCP (JSON-RPC, SSE, session header, or OAuth-protected MCP). Dead URLs from the last pass are in `mcp-url-dropped.json`.
