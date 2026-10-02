import { NextRequest, NextResponse } from "next/server";
import { completePluginAuthorizationFlow } from "@/server/plugins/oauth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderHtmlResponse(options: {
  success: boolean;
  title: string;
  message: string;
  pluginId?: string;
  pluginName?: string;
  returnUrl?: string;
}): Response {
  const { success, title, message, pluginId, pluginName, returnUrl = "/plugins" } = options;
  const escapedTitle = escapeHtml(title);
  const escapedMessage = escapeHtml(message);
  const escapedPluginId = pluginId ? escapeHtml(pluginId) : "";
  const escapedPluginName = pluginName ? escapeHtml(pluginName) : "Plugin";

  const script = success && pluginId
    ? `
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage({
              type: "clauxen:plugin-connected",
              pluginId: "${escapedPluginId}",
              pluginName: "${escapedPluginName}"
            }, "*");
            setTimeout(() => {
              window.close();
            }, 800);
          }
        } catch (e) {
          console.error("postMessage error:", e);
        }
      </script>
    `
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle} — Clauxen</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fafafa;
      color: #111;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 16px;
      padding: 36px 28px;
      text-align: center;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    }
    .icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      margin: 0 auto 18px;
      display: grid;
      place-items: center;
      font-size: 24px;
      background: ${success ? "#ecfdf5" : "#fef2f2"};
      color: ${success ? "#059669" : "#dc2626"};
      border: 1px solid ${success ? "#a7f3d0" : "#fecaca"};
    }
    h1 {
      font-size: 19px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 8px;
    }
    p {
      font-size: 13.5px;
      line-height: 20px;
      color: #666;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 38px;
      padding: 0 18px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid #d4d4d8;
      background: #ffffff;
      color: #18181b;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #f4f4f5;
    }
  </style>
  ${script}
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✓" : "!"}</div>
    <h1>${escapedTitle}</h1>
    <p>${escapedMessage}</p>
    <a href="${escapeHtml(returnUrl)}" class="btn">Return to Clauxen</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: success ? 200 : 400,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state") || "";
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return renderHtmlResponse({
      success: false,
      title: "Authorization cancelled",
      message: errorDescription || error || "Platform authorization was cancelled or denied.",
    });
  }

  if (!state) {
    return renderHtmlResponse({
      success: false,
      title: "Missing authorization session",
      message: "The authorization state was missing or expired. Please try connecting the plugin again.",
    });
  }

  try {
    const result = await completePluginAuthorizationFlow({
      state,
      code,
    });

    return renderHtmlResponse({
      success: true,
      title: "Connected!",
      pluginId: result.pluginId,
      pluginName: result.pluginName,
      returnUrl: result.returnUrl,
      message: `Successfully connected ${result.pluginName} to Clauxen. You can now close this tab.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not complete authorization.";
    return renderHtmlResponse({
      success: false,
      title: "Connection failed",
      message: msg,
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const state = typeof body.state === "string" ? body.state : "";
  const code = typeof body.code === "string" ? body.code : null;

  if (!state) {
    return NextResponse.json(
      { error: { message: "state parameter is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await completePluginAuthorizationFlow({ state, code });
    return NextResponse.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not complete authorization.";
    return NextResponse.json({ error: { message: msg } }, { status: 400 });
  }
}
