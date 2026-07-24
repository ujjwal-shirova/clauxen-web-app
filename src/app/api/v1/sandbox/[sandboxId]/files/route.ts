import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  assertSandboxOwnedBy,
  listSandboxFiles,
  readSandboxFile,
  writeSandboxFile,
  writeSandboxFiles,
} from "@/server/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const path = new URL(request.url).searchParams.get("path") ?? "/";
    const list = await listSandboxFiles(params.sandboxId, path);
    return jsonData({ path, entries: list });
  },
  { requireAuth: true },
);

export const POST = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const body = (await request.json()) as
      | { path: string; content: string }
      | { files: Array<{ path: string; content: string }> };

    if ("files" in body && Array.isArray(body.files)) {
      const result = await writeSandboxFiles(params.sandboxId, body.files);
      return jsonData({ written: body.files.length, result });
    }

    const single = body as { path: string; content: string };
    const result = await writeSandboxFile(
      params.sandboxId,
      single.path,
      single.content,
    );
    return jsonData({ path: single.path, result });
  },
  { requireAuth: true },
);

export const PUT = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const body = (await request.json()) as { path: string };
    const content = await readSandboxFile(params.sandboxId, body.path);
    return jsonData({ path: body.path, content });
  },
  { requireAuth: true },
);
