import type { DictationFinishReason } from "@/features/dictation/types";

const MAX_UPLOAD_ATTEMPTS = 3;

async function uploadWithRetry(url: string, chunk: Blob) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        keepalive: true,
        body: chunk,
        headers: { "Content-Type": chunk.type || "application/octet-stream" },
      });
      if (!response.ok)
        throw new Error(`Chunk upload failed (${response.status})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, attempt * 250),
        );
      }
    }
  }
  throw lastError;
}

export class DictationRecordingUploader {
  private sequence = 0;
  private uploadQueue: Promise<void> = Promise.resolve();
  private uploadError: Error | null = null;

  constructor(private readonly sessionId: string) {}

  enqueue(chunk: Blob) {
    const sequence = this.sequence++;
    const url = `/api/v1/audio/dictation/${this.sessionId}/chunks/${sequence}`;
    this.uploadQueue = this.uploadQueue
      .then(() => uploadWithRetry(url, chunk))
      .catch((error: unknown) => {
        this.uploadError =
          error instanceof Error ? error : new Error("Audio upload failed.");
      });
  }

  async finalize(reason: DictationFinishReason, transcript: string) {
    await this.uploadQueue;
    if (this.uploadError) throw this.uploadError;
    const response = await fetch(
      `/api/v1/audio/dictation/${this.sessionId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, transcript }),
      },
    );
    if (!response.ok)
      throw new Error("The audio recording could not be finalized.");
  }

  finalizeInBackground(reason: DictationFinishReason, transcript: string) {
    void fetch(`/api/v1/audio/dictation/${this.sessionId}/complete`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, transcript, background: true }),
    }).catch(() => undefined);
  }
}
