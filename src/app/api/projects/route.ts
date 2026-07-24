import { NextRequest } from "next/server";
import { z } from "zod";
import * as projectsRepo from "@/server/repositories/projects.repository";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireProjectsUser(request);
    const projects = await projectsRepo.listProjects(user.id);
    return jsonData({ projects });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireProjectsUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Validation failed.", 400);
    }

    const project = await projectsRepo.createProject({
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
    });
    if (!project) return jsonError("Failed to create project.", 500);
    return jsonData({ project }, 201);
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}
