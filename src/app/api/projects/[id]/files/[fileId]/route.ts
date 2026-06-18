import { NextRequest } from "next/server";
import * as projectFilesRepo from "@/backend/repositories/project-files.repository";
import { deleteObject } from "@/backend/storage/object-store";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id, fileId } = await context.params;

    const deleted = await projectFilesRepo.deleteProjectFile(
      fileId,
      id,
      user.id,
    );
    if (!deleted) return jsonError("File not found.", 404);

    try {
      await deleteObject(
        "documents",
        deleted.storage_path,
        deleted.storage_bucket,
      );
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
