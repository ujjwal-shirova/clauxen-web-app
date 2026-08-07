import { NextRequest } from "next/server";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import { deleteObject } from "@/server/storage/object-store";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id, fileId } = await context.params;

    const file = await userFilesRepo.getProjectFile(fileId, id, user.id);
    if (!file) return jsonError("File not found.", 404);
    const deleted = await userFilesRepo.deleteUserFile(fileId, user.id);
    if (!deleted) return jsonError("File not found.", 404);

    try {
      await deleteObject("documents", file.storage_path, file.storage_bucket);
    } catch {
      /* best effort */
    }

    return jsonData({ ok: true });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
