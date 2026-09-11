export type ExtractedVideoFrame = {
  mimeType: string;
  data: string;
  name?: string;
};

const DEFAULT_FRAME_COUNT = 4;
const MAX_FRAME_EDGE = 768;

function canvasToJpegDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * Sample a few stills from a local video file so OpenAI-compatible vision
 * models (Together / Novita Chat Completions `image_url` parts) can read it.
 * Chat Completions vision does not accept raw video bytes.
 */
export async function extractVideoFrames(
  file: File,
  count = DEFAULT_FRAME_COUNT,
): Promise<ExtractedVideoFrame[]> {
  if (typeof document === "undefined") return [];
  if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
    return [];
  }

  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      const onError = () => reject(new Error("Could not read video."));
      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0 && video.videoWidth <= 0) return [];

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || MAX_FRAME_EDGE;
    const height = video.videoHeight || MAX_FRAME_EDGE;
    const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(width, height, 1));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const stamps =
      duration > 0
        ? Array.from({ length: count }, (_, index) =>
            duration * ((index + 0.5) / count),
          )
        : [0];

    const frames: ExtractedVideoFrame[] = [];
    for (let index = 0; index < stamps.length; index += 1) {
      const time = stamps[index] ?? 0;
      await new Promise<void>((resolve) => {
        const onSeeked = () => resolve();
        video.addEventListener("seeked", onSeeked, { once: true });
        try {
          video.currentTime = time;
        } catch {
          resolve();
        }
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvasToJpegDataUrl(canvas);
      if (!dataUrl.startsWith("data:image/jpeg")) continue;
      frames.push({
        mimeType: "image/jpeg",
        data: dataUrl,
        name: `${file.name} frame ${index + 1}`,
      });
    }
    return frames;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}
