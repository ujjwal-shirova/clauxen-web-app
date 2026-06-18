import { NextRequest } from "next/server";
import * as projectsRepo from "@/backend/repositories/projects.repository";
import * as projectFilesRepo from "@/backend/repositories/project-files.repository";
import {
  putObject,
  buildProjectFileKey,
  deleteObject,
  bucketForPurpose,
} from "@/backend/storage/object-store";
import { enqueueFileIngestion } from "@/backend/services/project-ingestion.service";
import { requireProjectsUser, ProjectsAuthError } from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "docx",
  "csv",
  "html",
  "md",
  "epub",
  "rtf",
]);

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireProjectsUser(request);
    const { id } = await context.params;
    const project = await projectsRepo.getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404);

    const files = await projectFilesRepo.listProjectFiles(id, user.id);
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

    const contentType = request.headers.get("content-type") ?? "";
    const bucket = bucketForPurpose("documents");

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { title?: string; content?: string };
      const title = body.title?.trim() || "Untitled.txt";
      const content = body.content ?? "";
      const filename = title.endsWith(".txt") ? title : `${title}.txt`;
      const buffer = Buffer.from(content, "utf-8");
      const key = buildProjectFileKey(user.id, id, filename);
      const stored = await putObject({
        purpose: "documents",
        key,
        body: buffer,
        contentType: "text/plain",
      });

      const file = await projectFilesRepo.createProjectFile({
        projectId: id,
        userId: user.id,
        filename,
        fileType: "txt",
        fileSize: buffer.length,
        storageBucket: bucket,
        storagePath: key,
        contentHash: stored.contentHash,
      });
      if (!file) return jsonError("Failed to save file.", 500);

      void enqueueFileIngestion(file.id).catch(console.error);
      return jsonData({ file }, 202);
    }

    const formData = await request.formData();
    const uploaded = formData.getAll("files");
    const created = [];

    for (const entry of uploaded) {
      if (!(entry instanceof File)) continue;
      const ext = getFileExtension(entry.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return jsonError(`File type .${ext} is not supported.`, 400);
      }
      const buffer = Buffer.from(await entry.arrayBuffer());
      const key = buildProjectFileKey(user.id, id, entry.name);
      const stored = await putObject({
        purpose: "documents",
        key,
        body: buffer,
        contentType: entry.type || undefined,
      });
      const file = await projectFilesRepo.createProjectFile({
        projectId: id,
        userId: user.id,
        filename: entry.name,
        fileType: ext,
        fileSize: buffer.length,
        storageBucket: bucket,
        storagePath: key,
        contentHash: stored.contentHash,
      });
      if (file) {
        void enqueueFileIngestion(file.id).catch(console.error);
        created.push(file);
      }
    }

    if (!created.length) return jsonError("No files provided.", 400);
    return jsonData({ files: created }, 202);
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("[projects/files/POST]", error);
    return jsonError("Internal server error.", 500);
  }
}
