export type StudioMode = "image" | "video";
export type StudioSection = "create" | "assets" | "projects";

export type StudioAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type StudioVideoDuration = "5s" | "8s" | "10s";
export type StudioVideoResolution = "720p" | "1080p";

export type StudioGenerationStatus = "pending" | "ready" | "failed";

export type StudioGeneration = {
  id: string;
  mode: StudioMode;
  prompt: string;
  model: string;
  aspectRatio: StudioAspectRatio;
  status: StudioGenerationStatus;
  createdAt: number;
  duration?: StudioVideoDuration;
  resolution?: StudioVideoResolution;
  /** CSS gradient used as placeholder thumb until real media exists. */
  thumbGradient: string;
};

export const IMAGE_MODELS = [
  "Nano Banana Pro",
  "GPT Image 2",
  "Soul 2.0",
] as const;

export const VIDEO_MODELS = ["Seedance 2.0", "Kling 3.0"] as const;

export const ASPECT_RATIOS: StudioAspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
];

export const VIDEO_DURATIONS: StudioVideoDuration[] = ["5s", "8s", "10s"];
export const VIDEO_RESOLUTIONS: StudioVideoResolution[] = ["720p", "1080p"];

export const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(145deg, #2a241c 0%, #5c4a32 42%, #1a1814 100%)",
  "linear-gradient(160deg, #1c2228 0%, #3d4f5c 45%, #12151a 100%)",
  "linear-gradient(135deg, #241c1c 0%, #6b3d3d 48%, #141010 100%)",
  "linear-gradient(150deg, #1a1f1a 0%, #3d5c45 44%, #0f1210 100%)",
  "linear-gradient(140deg, #1f1c28 0%, #4a3d6b 46%, #121018 100%)",
] as const;
