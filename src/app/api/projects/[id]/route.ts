import { NextRequest } from "next/server";
import { z } from "zod";
import * as projectsRepo from "@/server/repositories/projects.repository";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import { deleteObject } from "@/server/storage/object-store";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);
    return jsonData({ project });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Validation failed.",
        400,
      );
    }

    const project = await projectsRepo.updateProject(id, user.id, {
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
    });
    if (!project) return jsonError("Project not found.", 404);
    return jsonData({ project });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    const deleted = await projectsRepo.deleteProject(id, user.id);
    if (!deleted) return jsonError("Project not found.", 404);

    const files = await userFilesRepo.listProjectFiles(id, user.id);
    for (const file of files) {
      try {
        await deleteObject("documents", file.storage_path, file.storage_bucket);
      } catch {
        /* best effort */
      }
      await userFilesRepo.deleteUserFile(file.id, user.id);
    }

    return jsonData({ ok: true });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
