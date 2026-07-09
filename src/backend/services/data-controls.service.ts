import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/backend/db/errors";
import * as dataControlsRepo from "@/backend/repositories/data-controls.repository";

export async function requestDataExport(
  userId: string,
  input?: { workspaceId?: string | null; exportType?: string },
) {
  const job = await dataControlsRepo.createDataExportJob({
    userId,
    workspaceId: input?.workspaceId,
    exportType: input?.exportType,
  });
  if (!job) throw new AppError("Failed to queue export.", 500);
  return job;
}

export async function listDataExports(userId: string) {
  return dataControlsRepo.listDataExportJobs(userId);
}

export async function requestDataDeletion(
  userId: string,
  input?: { workspaceId?: string | null; requestedScope?: string },
) {
  const verificationToken = randomBytes(32).toString("hex");
  const verificationTokenHash = createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const request = await dataControlsRepo.createDataDeletionRequest({
    userId,
    workspaceId: input?.workspaceId,
    requestedScope: input?.requestedScope,
    verificationTokenHash,
    metadata: { source: "settings_ui" },
  });

  if (!request) throw new AppError("Failed to create deletion request.", 500);

  // ponytail: verification email/worker not wired — token returned once for dev flow.
  return { request, verificationToken };
}
