import { NextRequest } from "next/server";
import * as projectFilesRepo from "@/server/repositories/project-files.repository";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id, fileId } = await context.params;
    const file = await projectFilesRepo.getProjectFile(fileId, id, user.id);
    if (!file) return jsonError("File not found.", 404);
    return jsonData({ file });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
