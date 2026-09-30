import { NextResponse } from "next/server";
import {
  introspectMcpServer,
  type McpIntrospectResult,
} from "@/lib/mcp-introspect";

/**
 * Server-side proxy for live MCP tool discovery. The plugin info page calls
 * this per HTTP-transport MCP server; the server performs the MCP handshake
 * (initialize → tools/list) that browsers can't do directly (CORS/OAuth).
 *
 * Results are cached in memory for 10 minutes (40 minutes for negative
 * results) so reopening a plugin page doesn't re-probe every server.
 */

const SUCCESS_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 40 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  result: McpIntrospectResult;
};

const globalCache = globalThis as typeof globalThis & {
  __clauxenMcpToolsCache?: Map<string, CacheEntry>;
};

const cache = (globalCache.__clauxenMcpToolsCache ??= new Map<string, CacheEntry>());

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url).searchParams.get("url")?.trim();
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "invalid-url", message: "Missing ?url= query." },
      { status: 400 },
    );
  }

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.result);
  }

  const result = await introspectMcpServer(url);
  cache.set(url, {
    result,
    expiresAt:
      Date.now() + (result.ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
  });

  return NextResponse.json(result);
}
