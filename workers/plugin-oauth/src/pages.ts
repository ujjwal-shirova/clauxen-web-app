/** HTML surfaces rendered by the plugin-oauth worker. */

export function htmlPage(
  title: string,
  message: string,
  extraScript = "",
): Response {
  const markup = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
        background: #fafafa; color: #14151a;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #101114; color: #eceef2; }
        .card { background: rgba(28,29,34,0.94); }
      }
      .card {
        max-width: 26rem; padding: 2rem; border-radius: 18px;
        background: rgba(255,255,255,0.92);
        box-shadow: 0 12px 40px rgba(20,21,26,0.12);
        text-align: center;
      }
      .mark {
        width: 44px; height: 44px; margin: 0 auto 14px; border-radius: 12px;
        display: grid; place-items: center; background: #14151a; color: #fff;
        font-size: 20px;
      }
      h1 { margin: 0 0 6px; font-size: 17px; letter-spacing: -0.01em; }
      p { margin: 0; font-size: 13.5px; opacity: 0.72; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="mark">&#10003;</div>
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
    ${extraScript}
  </body>
</html>`;

  return new Response(markup, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function errorPage(message: string): Response {
  return htmlPage("Could not connect", message);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Script that notifies the opener tab and closes this one. */
export function connectedScript(pluginId: string): string {
  return `<script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "clauxen:plugin-connected", pluginId: ${JSON.stringify(pluginId)} },
        "*"
      );
    }
  } catch (e) {}
  setTimeout(function () { window.close(); }, 2200);
</script>`;
}
