/**
 * Minimal pages shown in the connect popup. They notify the opener with an
 * origin-scoped postMessage and close themselves.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON that is safe to embed inside a <script> element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function connectResultPage(options: {
  appOrigin: string;
  ok: boolean;
  title: string;
  message: string;
  pluginId?: string;
  pluginName?: string;
}): Response {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const event = options.ok
    ? { type: "clauxen:plugin-connected", pluginId: options.pluginId, pluginName: options.pluginName }
    : { type: "clauxen:plugin-connect-failed", pluginId: options.pluginId, message: options.message };
  const returnUrl = `${options.appOrigin}/plugins${options.pluginId ? `?p=${encodeURIComponent(options.pluginId)}` : ""}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(options.title)} · Clauxen</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    background: #fbfaf9; color: #18181b; }
  .card { width: 100%; max-width: 380px; text-align: center; padding: 32px 28px;
    background: #fff; border: 1px solid rgba(20,21,26,.08); border-radius: 18px; }
  .mark { width: 44px; height: 44px; margin: 0 auto 16px; border-radius: 999px; display: grid;
    place-items: center; font-size: 20px; font-weight: 600;
    background: ${options.ok ? "#ecfdf3" : "#fef2f2"}; color: ${options.ok ? "#047857" : "#b91c1c"}; }
  h1 { margin: 0 0 6px; font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
  p { margin: 0 0 20px; color: #6f6f75; }
  a { display: inline-flex; height: 36px; align-items: center; padding: 0 16px; border-radius: 10px;
    background: #18181b; color: #fff; text-decoration: none; font-weight: 500; }
  @media (prefers-color-scheme: dark) {
    body { background: #111113; color: #fafafa; }
    .card { background: #18181b; border-color: rgba(255,255,255,.08); }
    p { color: #a1a1aa; }
    a { background: #fafafa; color: #18181b; }
  }
</style>
</head>
<body>
  <main class="card">
    <div class="mark" aria-hidden="true">${options.ok ? "✓" : "!"}</div>
    <h1>${escapeHtml(options.title)}</h1>
    <p>${escapeHtml(options.message)}</p>
    <a href="${escapeHtml(returnUrl)}">Back to Clauxen</a>
  </main>
  <script nonce="${nonce}">
    (function () {
      var event = ${scriptJson(event)};
      var origin = ${scriptJson(options.appOrigin)};
      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(event, origin); } catch (e) {}
        ${options.ok ? "setTimeout(function () { window.close(); }, 700);" : ""}
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: options.ok ? 200 : 400,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}
