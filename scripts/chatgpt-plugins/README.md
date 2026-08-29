# ChatGPT plugin-page capture

`plugins.json` is a sanitized index of public ChatGPT plugin-directory links and public plugin metadata. `plugin-pages/` contains a compact, standalone HTML capture for every indexed plugin, using only the relevant visible main-content structure.

Regenerate the pages after replacing `plugins.json` with:

```sh
node scripts/chatgpt-plugins/generate-plugin-pages.mjs
```

The generated captures intentionally exclude authentication state, cookies, account information, application JavaScript bundles, browser-extension code, and the ChatGPT sidebar/chrome. Eight index entries had no public detail response at capture time; they remain in the JSON and receive an index-only HTML page.
