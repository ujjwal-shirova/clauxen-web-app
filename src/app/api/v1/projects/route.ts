import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";
import {
  parseProjectPatch,
  type ProjectBody,
} from "@/server/projects/project-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const lifecycle =
      new URL(request.url).searchParams.get("lifecycle") === "archived"
        ? "archived"
        : "active";
    const rows = await projectsRepo.listProjects(user.id, lifecycle);
    return jsonData({
      projects: rows.map((row) => projectsRepo.mapProjectWithCounts(row)),
    });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as ProjectBody;
    const patch = parseProjectPatch(body);
    if (!patch.name) throw new AppError("Project name is required.", 400);

    const row = await projectsRepo.createProject({
      userId: user.id,
      name: patch.name,
      description: patch.description ?? "",
      iconId: patch.iconId ?? "folder",
      color: patch.color ?? "#14151a",
      instructions: patch.instructions ?? "",
      memory: patch.memory ?? "default",
    });
    if (!row) throw new AppError("Failed to create project.", 500);
    return jsonData({ project: projectsRepo.mapProject(row) }, 201);
  },
  { requireAuth: true },
);
