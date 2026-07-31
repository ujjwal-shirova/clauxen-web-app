import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as libraryService from "@/server/services/library.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntryRef = { id: string; kind: "file" | "folder" };

function entryRefs(value: unknown): EntryRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is EntryRef =>
      Boolean(item) &&
      typeof item.id === "string" &&
      (item.kind === "file" || item.kind === "folder"),
  );
}

export const GET = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const folderId = new URL(request.url).searchParams.get("folderId");
    return jsonData(await libraryService.listLibrary(user.id, folderId));
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      name?: string;
      parentId?: string | null;
    };
    const folder = await libraryService.createFolder(user.id, {
      name: body.name ?? "",
      parentId: body.parentId,
    });
    return jsonData({ folder }, 201);
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      action?: "rename" | "move";
      id?: string;
      kind?: "file" | "folder";
      name?: string;
      items?: unknown;
      folderId?: string | null;
    };
    if (body.action === "rename" && body.id && body.kind) {
      const item = await libraryService.renameItem(user.id, {
        id: body.id,
        kind: body.kind,
        name: body.name ?? "",
      });
      return jsonData({ item });
    }
    const result = await libraryService.moveItems(user.id, {
      items: entryRefs(body.items),
      folderId: body.folderId ?? null,
    });
    return jsonData(result);
  },
  { requireAuth: true },
);

export const DELETE = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as { items?: unknown };
    return jsonData(
      await libraryService.deleteItems(user.id, entryRefs(body.items)),
    );
  },
  { requireAuth: true },
);
