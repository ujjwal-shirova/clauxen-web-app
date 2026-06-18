import { NextRequest } from "next/server";
import { z } from "zod";
import * as projectsRepo from "@/backend/repositories/projects.repository";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const instructionsSchema = z.object({
  system_prompt: z.string().max(5000),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;

    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = instructionsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Validation failed.", 400);
    }

    const updated = await projectsRepo.updateProject(id, user.id, {
      system_prompt: parsed.data.system_prompt,
    });
    if (!updated) return jsonError("Project not found.", 404);

    return jsonData({ project: updated });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
