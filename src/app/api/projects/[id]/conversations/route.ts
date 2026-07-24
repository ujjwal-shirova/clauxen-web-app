import { NextRequest } from "next/server";
import { z } from "zod";
import * as projectsRepo from "@/server/repositories/projects.repository";
import * as projectChatsRepo from "@/server/repositories/project-chats.repository";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);

    const conversations = await projectChatsRepo.listProjectChats(id, user.id);
    return jsonData({ conversations });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      /* empty body ok */
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Validation failed.", 400);
    }

    const conversation = await projectChatsRepo.createProjectChat({
      projectId: id,
      userId: user.id,
      title: parsed.data.title,
    });
    if (!conversation) return jsonError("Failed to create conversation.", 500);

    await projectChatsRepo.touchProject(id);
    return jsonData({ conversation }, 201);
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
