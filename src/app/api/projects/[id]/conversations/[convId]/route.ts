import { NextRequest } from "next/server";
import { z } from "zod";
import * as projectChatsRepo from "@/server/repositories/project-chats.repository";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; convId: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  starred: z.boolean().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id, convId } = await context.params;
    const conversation = await projectChatsRepo.getProjectChat(convId, id, user.id);
    if (!conversation) return jsonError("Conversation not found.", 404);
    return jsonData({ conversation });
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
    const { id, convId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Validation failed.", 400);
    }

    const conversation = await projectChatsRepo.updateProjectChat(
      convId,
      id,
      user.id,
      parsed.data,
    );
    if (!conversation) return jsonError("Conversation not found.", 404);
    return jsonData({ conversation });
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
    const { id, convId } = await context.params;
    const deleted = await projectChatsRepo.deleteProjectChat(convId, id, user.id);
    if (!deleted) return jsonError("Conversation not found.", 404);
    return jsonData({ ok: true });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
