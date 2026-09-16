#!/usr/bin/env node
/**
 * One-time GitHub App registration via the official manifest flow.
 * Opens the logged-in Chrome session, GitHub returns a code to localhost,
 * then this script exchanges it and prints client id only (secret to a file).
 *
 * Usage: node scripts/connectors/bootstrap-github-manifest.mjs
 */
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const PORT = 18765;
const CALLBACK = `http://127.0.0.1:${PORT}/github-manifest`;
const GATEWAY_CALLBACK =
  "https://clauxen-connector-gateway.ujjwal-8fc.workers.dev/v1/oauth/callback/github";

const manifest = {
  name: "Clauxen",
  url: "https://www.clauxen.com",
  hook_attributes: {
    url: "https://www.clauxen.com/api/github/webhooks",
    active: false,
  },
  redirect_url: CALLBACK,
  callback_urls: [GATEWAY_CALLBACK],
  setup_url: "https://www.clauxen.com/connectors/github",
  description:
    "Clauxen connects GitHub so you can use repos, issues, and pull requests in chat.",
  public: false,
  request_oauth_on_install: true,
  default_permissions: {
    contents: "read",
    issues: "write",
    metadata: "read",
    pull_requests: "read",
    email: "read",
  },
  default_events: [],
};

const outDir = join(process.cwd(), ".vercel");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "github-oauth-app.json");

let done;
const finished = new Promise((resolve) => {
  done = resolve;
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/" || url.pathname === "/start") {
    const encoded = JSON.stringify(manifest).replace(/'/g, "&#39;");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<meta charset="utf-8">
<title>Register Clauxen on GitHub</title>
<form id="f" method="post" action="https://github.com/organizations/shirova-ai/settings/apps/new">
  <input type="hidden" name="manifest" value='${encoded}'>
</form>
<p>Redirecting to GitHub to create the Clauxen app…</p>
<script>document.getElementById("f").submit()</script>`);
    return;
  }
  if (url.pathname === "/github-manifest") {
    const code = url.searchParams.get("code") || "";
    if (!code) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Missing code");
      return;
    }
    try {
      const conversion = await fetch(
        `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
        {
          method: "POST",
          headers: {
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
            "user-agent": "clauxen-bootstrap",
          },
        },
      );
      const payload = await conversion.json();
      if (!conversion.ok) {
        res.writeHead(conversion.status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
        done({ ok: false, payload });
        return;
      }
      const record = {
        id: payload.id,
        slug: payload.slug,
        name: payload.name,
        client_id: payload.client_id,
        client_secret: payload.client_secret,
        html_url: payload.html_url,
        created_at: new Date().toISOString(),
      };
      writeFileSync(outFile, JSON.stringify(record, null, 2), { mode: 0o600 });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        `<!doctype html><p>Clauxen GitHub app registered. You can close this tab.</p>`,
      );
      done({ ok: true, client_id: record.client_id, slug: record.slug });
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(error));
      done({ ok: false, error: String(error) });
    }
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`listening on ${CALLBACK.replace("/github-manifest", "")}`);
});

const result = await finished;
server.close();
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(`registered ${result.slug} client_id=${result.client_id}`);
console.log(`credentials: ${outFile}`);
