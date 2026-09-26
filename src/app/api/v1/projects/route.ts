import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const rows = await projectsRepo.listProjects(user.id);
    return jsonData({
      projects: rows.map((row) => projectsRepo.mapProject(row)),
    });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      iconId?: string;
      color?: string;
      memory?: "default" | "project";
    };
    const name = body.name?.trim() ?? "";
    if (!name) throw new AppError("Project name is required.", 400);
    const row = await projectsRepo.createProject({
      userId: user.id,
      name: name.slice(0, 120),
      iconId: (body.iconId || "folder").slice(0, 40),
      color: /^#[0-9a-fA-F]{6}$/.test(body.color || "") ? body.color! : "#14151a",
      memory: body.memory === "project" ? "project" : "default",
    });
    if (!row) throw new AppError("Failed to create project.", 500);
    return jsonData({ project: projectsRepo.mapProject(row) }, 201);
  },
  { requireAuth: true },
);
