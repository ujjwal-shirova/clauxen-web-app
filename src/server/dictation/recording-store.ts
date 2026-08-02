import "server-only";

import { randomUUID } from "node:crypto";
import { AppError } from "@/server/db/errors";
import {
  deleteObject,
  getObject,
  putObject,
} from "@/server/storage/object-store";
import {
  DICTATION_MANIFEST_VERSION,
  type DictationFinishReason,
  type DictationManifest,
} from "@/server/dictation/types";

const PURPOSE = "audio-recordings" as const;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
export const MAX_DICTATION_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_FINAL_RECORDING_BYTES = 50 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 100_000;

function sessionPrefix(userId: string, sessionId: string) {
  return `users/${userId}/dictation/${sessionId}`;
}

function manifestKey(userId: string, sessionId: string) {
  return `${sessionPrefix(userId, sessionId)}/manifest.json`;
}

function chunkKey(userId: string, sessionId: string, sequence: number) {
  return `${sessionPrefix(userId, sessionId)}/chunks/${String(sequence).padStart(6, "0")}.part`;
}

function assertSessionId(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new AppError("Invalid dictation session.", 400, "invalid_session");
  }
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

async function writeManifest(manifest: DictationManifest) {
  await putObject({
    purpose: PURPOSE,
    key: manifestKey(manifest.userId, manifest.sessionId),
    body: JSON.stringify(manifest),
    contentType: "application/json",
  });
}

async function readManifest(userId: string, sessionId: string) {
  assertSessionId(sessionId);
  try {
    const bytes = await getObject(PURPOSE, manifestKey(userId, sessionId));
    const manifest = JSON.parse(bytes.toString("utf8")) as DictationManifest;
    if (
      manifest.version !== DICTATION_MANIFEST_VERSION ||
      manifest.userId !== userId ||
      manifest.sessionId !== sessionId
    ) {
      throw new Error("manifest mismatch");
    }
    return manifest;
  } catch {
    throw new AppError(
      "Dictation session not found.",
      404,
      "dictation_not_found",
    );
  }
}

export async function createDictationRecording(
  userId: string,
  mimeType: string,
) {
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const normalizedMimeType = mimeType.slice(0, 120) || "audio/webm";
  const manifest: DictationManifest = {
    version: DICTATION_MANIFEST_VERSION,
    sessionId,
    userId,
    status: "recording",
    mimeType: normalizedMimeType,
    extension: extensionForMimeType(normalizedMimeType),
    createdAt: now,
    updatedAt: now,
    chunks: [],
  };
  await writeManifest(manifest);
  return manifest;
}

export async function storeDictationChunk(input: {
  userId: string;
  sessionId: string;
  sequence: number;
  body: Uint8Array;
  contentType: string;
}) {
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new AppError("Invalid chunk sequence.", 400, "invalid_sequence");
  }
  if (
    !input.body.byteLength ||
    input.body.byteLength > MAX_DICTATION_CHUNK_BYTES
  ) {
    throw new AppError(
      "Dictation chunk is empty or too large.",
      413,
      "dictation_chunk_too_large",
    );
  }

  const initialManifest = await readManifest(input.userId, input.sessionId);
  if (initialManifest.status !== "recording") {
    throw new AppError(
      "Dictation session is already complete.",
      409,
      "dictation_already_complete",
    );
  }

  const key = chunkKey(input.userId, input.sessionId, input.sequence);
  await putObject({
    purpose: PURPOSE,
    key,
    body: input.body,
    contentType: input.contentType.slice(0, 120) || initialManifest.mimeType,
  });

  // Re-read after the object write so an overlapping background finalizer wins.
  const manifest = await readManifest(input.userId, input.sessionId);
  if (manifest.status !== "recording") {
    await deleteObject(PURPOSE, key).catch(() => undefined);
    throw new AppError(
      "Dictation session is already complete.",
      409,
      "dictation_already_complete",
    );
  }

  const storedAt = new Date().toISOString();
  const chunk = {
    sequence: input.sequence,
    key,
    sizeBytes: input.body.byteLength,
    storedAt,
  };
  manifest.chunks = [
    ...manifest.chunks.filter((item) => item.sequence !== input.sequence),
    chunk,
  ].sort((a, b) => a.sequence - b.sequence);
  manifest.updatedAt = storedAt;
  await writeManifest(manifest);
  return chunk;
}

export async function completeDictationRecording(input: {
  userId: string;
  sessionId: string;
  reason: DictationFinishReason;
  transcript?: string;
}) {
  const manifest = await readManifest(input.userId, input.sessionId);
  if (manifest.status === "completed") return manifest;

  const totalBytes = manifest.chunks.reduce(
    (total, chunk) => total + chunk.sizeBytes,
    0,
  );
  if (totalBytes > MAX_FINAL_RECORDING_BYTES) {
    throw new AppError(
      "Dictation recording is too large to finalize.",
      413,
      "dictation_too_large",
    );
  }

  manifest.status = "finalizing";
  manifest.updatedAt = new Date().toISOString();
  await writeManifest(manifest);

  try {
    let audioKey: string | undefined;
    if (manifest.chunks.length > 0) {
      const buffers: Buffer[] = [];
      for (const chunk of manifest.chunks) {
        buffers.push(await getObject(PURPOSE, chunk.key));
      }
      const audio = Buffer.concat(buffers);
      audioKey = `${sessionPrefix(input.userId, input.sessionId)}/recording.${manifest.extension}`;
      await putObject({
        purpose: PURPOSE,
        key: audioKey,
        body: audio,
        contentType: manifest.mimeType,
        metadata: {
          userId: input.userId,
          sessionId: input.sessionId,
          finishReason: input.reason,
        },
      });
    }

    manifest.status = "completed";
    manifest.finishReason = input.reason;
    manifest.transcript = input.transcript
      ?.trim()
      .slice(0, MAX_TRANSCRIPT_CHARS);
    manifest.audioKey = audioKey;
    manifest.sizeBytes = totalBytes;
    manifest.updatedAt = new Date().toISOString();
    await writeManifest(manifest);

    await Promise.allSettled(
      manifest.chunks.map((chunk) => deleteObject(PURPOSE, chunk.key)),
    );
    return manifest;
  } catch (error) {
    manifest.status = "recording";
    manifest.updatedAt = new Date().toISOString();
    await writeManifest(manifest).catch(() => undefined);
    throw error;
  }
}
