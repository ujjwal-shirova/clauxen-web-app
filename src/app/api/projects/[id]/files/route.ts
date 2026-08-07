import { after, NextRequest } from "next/server";
import * as projectsRepo from "@/server/repositories/projects.repository";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import {
  putObject,
  buildProjectFileKey,
  bucketForPurpose,
} from "@/server/storage/object-store";
import { enqueueFileIngestion } from "@/server/services/project-ingestion.service";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);

    const files = await userFilesRepo.listProjectFiles(id, user.id);
    return jsonData({ files });
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

    const bucket = bucketForPurpose("documents");
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonError(
        "Use the direct R2 upload flow for binary project files.",
        415,
      );
    }

    const body = (await request.json()) as { title?: string; content?: string };
    const title = body.title?.trim() || "Untitled";
    const content = body.content?.trim() ?? "";
    if (!content) return jsonError("Content is required.", 400);
    const filename = /\.(?:txt|md)$/i.test(title) ? title : `${title}.md`;
    const buffer = Buffer.from(content, "utf-8");
    const key = buildProjectFileKey(user.id, id, filename);
    const stored = await putObject({
      purpose: "documents",
      key,
      body: buffer,
      contentType: "text/markdown; charset=utf-8",
      metadata: { projectId: id, userId: user.id },
    });

    const file = await userFilesRepo.createUserFile({
      projectId: id,
      userId: user.id,
      originalName: filename,
      mimeType: "text/markdown",
      sizeBytes: buffer.length,
      storageBucket: bucket,
      storagePath: key,
      contentHash: stored.contentHash,
      status: "processing",
      metadata: { purpose: "documents", projectKnowledge: true },
    });
    if (!file) return jsonError("Failed to save file.", 500);

    after(() => enqueueFileIngestion(file.id).catch(console.error));
    return jsonData({ file }, 202);
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("[projects/files/POST]", error);
    return jsonError("Internal server error.", 500);
  }
}
