import type Anthropic from "@anthropic-ai/sdk";

export type VisionDetail = "high" | "low" | "auto";

export type VisionImageInput = {
  url?: string;
  base64?: string;
  mimeType?: string;
  detail?: VisionDetail;
};

const MAX_IMAGES_PER_MESSAGE = 2;
const MAX_BASE64_CHARS = 1_600_000;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

type VisionContentBlock = Anthropic.Messages.ContentBlockParam;

export function buildVisionContentParts(
  images: VisionImageInput[],
  text: string,
): VisionContentBlock[] {
  const limited = images.slice(0, MAX_IMAGES_PER_MESSAGE);
  const parts: VisionContentBlock[] = limited.map((image) => {
    const url = image.base64
      ? `data:${image.mimeType ?? "image/jpeg"};base64,${image.base64}`
      : (image.url ?? "");
    if (
      !url ||
      (image.base64 && url.length > MAX_BASE64_CHARS) ||
      (!image.base64 && !isHttpUrl(url))
    ) {
      throw new Error("Invalid vision image input.");
    }

    if (image.base64) {
      const match = url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
      if (!match) throw new Error("Invalid vision image input.");
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: match[1] as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: match[2],
        },
      };
    }

    return {
      type: "image" as const,
      source: { type: "url" as const, url },
    };
  });

  parts.push({ type: "text", text });
  return parts;
}

export function buildMultiImageComparisonMessage(
  images: VisionImageInput[],
  prompt: string,
) {
  if (images.length === 0) {
    throw new Error("At least one image is required.");
  }
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    throw new Error(
      `Novita recommends at most ${MAX_IMAGES_PER_MESSAGE} images per request.`,
    );
  }
  return buildVisionContentParts(images, prompt);
}
