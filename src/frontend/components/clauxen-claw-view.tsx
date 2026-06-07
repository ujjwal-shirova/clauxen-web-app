"use client";

import React from "react";
import {
  Bot,
  Boxes,
  Brain,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileImage,
  Globe,
  Loader2,
  Monitor,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { useSettings } from "@/frontend/hooks/use-settings";
import { useAuth } from "@/frontend/hooks/use-auth";
import {
  createSandboxRecipe,
  listAgentModels,
  runAgentChat,
  type AgentContentPart,
  type NovitaModel,
  type SandboxRecipe,
} from "@/frontend/lib/api/agent";

const DEFAULT_VISION_MODEL = "qwen/qwen2.5-vl-72b-instruct";
const DEFAULT_REASONING_MODEL = "minimax/minimax-m2";
const MAX_LOCAL_IMAGE_BYTES = 1_000_000;

const capabilityItems = [
  {
    icon: FileImage,
    label: "Vision input",
    detail: "Image URL and base64 image parts with detail control.",
  },
  {
    icon: Brain,
    label: "Interleaved thinking",
    detail:
      "Reasoning flags and full assistant messages are preserved server-side.",
  },
  {
    icon: Boxes,
    label: "Tool execution",
    detail:
      "Safe allowlisted tools for time, media metadata, and sandbox recipes.",
  },
  {
    icon: Monitor,
    label: "Sandbox use",
    detail:
      "Python-only BrowserUse and E2B Desktop recipes for Novita sandboxes.",
  },
];

function normalizeHttpEndpoint(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

function modelFeatures(model: NovitaModel) {
  return model.features?.join(", ") || "chat";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-[#171716] text-[#f7f5ef]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[12px] text-white/65">
        <span>python</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-white/10"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="max-h-[360px] overflow-auto px-3 py-3 text-[12px] leading-5">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ClauxenClawView() {
  const auth = useAuth();
  const { settings, loading, saving, createClawDeployment } = useSettings(
    auth.isAuthenticated,
  );
  const deployments = settings?.claw.deployments ?? [];

  const [model, setModel] = React.useState(DEFAULT_REASONING_MODEL);
  const [task, setTask] = React.useState(
    "Analyze the attached visual context and produce an actionable agent plan.",
  );
  const [imageDataUrl, setImageDataUrl] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [structured, setStructured] = React.useState(false);
  const [thinking, setThinking] = React.useState(true);
  const [tools, setTools] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [agentAnswer, setAgentAnswer] = React.useState("");
  const [agentReasoning, setAgentReasoning] = React.useState("");
  const [agentError, setAgentError] = React.useState("");
  const [models, setModels] = React.useState<NovitaModel[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [recipe, setRecipe] = React.useState<SandboxRecipe | null>(null);
  const [recipeKind, setRecipeKind] = React.useState<"browser" | "desktop">(
    "browser",
  );
  const [creatingDeployment, setCreatingDeployment] = React.useState(false);
  const [linkEndpoint, setLinkEndpoint] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    listAgentModels()
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setModels(rows);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestedModels = React.useMemo(() => {
    const relevant = models.filter((item) =>
      item.features?.some((feature) =>
        [
          "vision",
          "reasoning",
          "function-calling",
          "structured-outputs",
        ].includes(feature),
      ),
    );
    return relevant.slice(0, 14);
  }, [models]);

  const handleImageFile = async (file?: File | null) => {
    setAgentError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAgentError("Choose an image file for base64 vision input.");
      return;
    }
    if (file.size > MAX_LOCAL_IMAGE_BYTES) {
      setAgentError(
        "Base64 image input should stay under 1 MB for this request.",
      );
      return;
    }
    setImageDataUrl(await readFileAsDataUrl(file));
  };

  const buildContent = (): AgentContentPart[] => {
    const content: AgentContentPart[] = [{ type: "text", text: task }];
    const normalizedImageUrl = normalizeHttpEndpoint(imageUrl);
    const normalizedVideoUrl = normalizeHttpEndpoint(videoUrl);
    if (imageDataUrl) {
      content.push({
        type: "image_url",
        image_url: { url: imageDataUrl, detail: "auto" },
      });
    }
    if (normalizedImageUrl) {
      content.push({
        type: "image_url",
        image_url: { url: normalizedImageUrl, detail: "high" },
      });
    }
    if (normalizedVideoUrl) {
      content.push({
        type: "video_url",
        video_url: { url: normalizedVideoUrl },
      });
    }
    return content;
  };

  const handleRunAgent = async () => {
    setRunning(true);
    setAgentError("");
    setAgentAnswer("");
    setAgentReasoning("");
    try {
      const response = await runAgentChat({
        model,
        mode: structured ? "structured" : "chat",
        enableThinking: thinking,
        enableTools: tools,
        reasoningSplit: thinking,
        messages: [{ role: "user", content: buildContent() }],
      });
      const content = response.message.content;
      setAgentAnswer(
        typeof content === "string"
          ? content
          : JSON.stringify(content, null, 2),
      );
      setAgentReasoning(response.message.reasoning_content ?? "");
    } catch (error) {
      setAgentError(
        error instanceof Error ? error.message : "The agent request failed.",
      );
    } finally {
      setRunning(false);
    }
  };

  const handleCreateRecipe = async (kind: "browser" | "desktop") => {
    setRecipeKind(kind);
    setRecipe(null);
    try {
      const nextRecipe = await createSandboxRecipe({
        kind,
        task,
        model,
        viewOnly: kind === "desktop",
      });
      setRecipe(nextRecipe);
    } catch (error) {
      setAgentError(
        error instanceof Error
          ? error.message
          : "Could not create sandbox recipe.",
      );
    }
  };

  const handleCreateDeployment = async (kind: "persistent" | "on-demand") => {
    setCreatingDeployment(true);
    try {
      await createClawDeployment(
        kind === "persistent"
          ? "NovitaClaw persistent agent"
          : "NovitaClaw on-demand agent",
        {
          kind,
          status: "ready",
          model,
          idleTimeoutSeconds: kind === "on-demand" ? 600 : undefined,
        },
      );
    } finally {
      setCreatingDeployment(false);
    }
  };

  const handleLinkDeployment = async () => {
    const endpoint = normalizeHttpEndpoint(linkEndpoint);
    if (!endpoint) {
      setAgentError("Enter a valid http or https endpoint.");
      return;
    }
    setCreatingDeployment(true);
    try {
      await createClawDeployment("Linked NovitaClaw endpoint", {
        kind: "linked",
        endpoint,
        status: "linked",
        model,
      });
      setLinkEndpoint("");
    } finally {
      setCreatingDeployment(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 overflow-y-auto bg-white font-sans text-zinc-800">
      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[760px]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Novita sandboxed agent plane</span>
            </div>
            <h1 className="text-[30px] font-semibold leading-tight tracking-normal sm:text-[40px] text-zinc-900">
              Clauxen Claw
            </h1>
            <p className="mt-2 max-w-[680px] text-[15px] leading-6 text-zinc-500">
              Deploy, test, and operate a Novita-backed multimodal agent with
              image input, video URL input, structured output, safe function
              calls, and Python-only sandbox recipes.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => void handleCreateDeployment("persistent")}
              disabled={creatingDeployment || saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800 no-hover-overlay disabled:opacity-50"
            >
              {creatingDeployment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Persistent</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCreateDeployment("on-demand")}
              disabled={creatingDeployment || saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-[14px] font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>On-demand</span>
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {capabilityItems.map((item) => (
            <article
              key={item.label}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <item.icon className="mb-3 h-5 w-5 text-zinc-700" />
              <h2 className="text-[14px] font-semibold text-zinc-900">{item.label}</h2>
              <p className="mt-1 text-[12px] leading-5 text-zinc-500">
                {item.detail}
              </p>
            </article>
          ))}
        </section>

        <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-900">Agent request</h2>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    Sends OpenAI-compatible chat completions through Novita.
                  </p>
                </div>
                <Bot className="h-5 w-5 text-zinc-500" />
              </div>

              <label className="mb-2 block text-[12px] font-medium text-zinc-600">
                Model
              </label>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mb-4 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-300"
              >
                <option value={DEFAULT_REASONING_MODEL}>
                  {DEFAULT_REASONING_MODEL}
                </option>
                <option value={DEFAULT_VISION_MODEL}>
                  {DEFAULT_VISION_MODEL}
                </option>
                {suggestedModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} — {modelFeatures(item)}
                  </option>
                ))}
              </select>
              {modelsLoading ? (
                <p className="-mt-2 mb-4 flex items-center gap-2 text-[12px] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading Novita model library
                </p>
              ) : null}

              <label className="mb-2 block text-[12px] font-medium text-zinc-600">
                Task
              </label>
              <textarea
                value={task}
                onChange={(event) => setTask(event.target.value)}
                className="min-h-[112px] w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[14px] leading-6 outline-none focus:border-zinc-300"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-3 text-[13px]">
                  <span className="inline-flex items-center gap-2 font-medium text-zinc-700">
                    <FileImage className="h-4 w-4" />
                    Base64 image
                  </span>
                  <span className="text-[12px] leading-5 text-zinc-500">
                    PNG, JPEG, or WebP under 1 MB.
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) =>
                      void handleImageFile(event.target.files?.[0])
                    }
                  />
                  {imageDataUrl ? (
                    <span className="text-[12px] font-medium text-emerald-600">
                      Image ready
                    </span>
                  ) : null}
                </label>
                <div className="space-y-3">
                  <label className="block text-[12px] font-medium text-zinc-600">
                    Image URL
                  </label>
                  <input
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="https://example.com/image.png"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-300"
                  />
                  <label className="block text-[12px] font-medium text-zinc-600">
                    Video URL
                  </label>
                  <input
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-300"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["Thinking", thinking, setThinking, Brain],
                  ["Tools", tools, setTools, Boxes],
                  ["Structured", structured, setStructured, Code2],
                ].map(([label, active, setter, Icon]) => {
                  const ToggleIcon = Icon as typeof Brain;
                  return (
                    <button
                      key={label as string}
                      type="button"
                      onClick={() =>
                        (
                          setter as React.Dispatch<
                            React.SetStateAction<boolean>
                          >
                        )(!(active as boolean))
                      }
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors",
                        active
                          ? "border-zinc-300 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      <ToggleIcon className="h-4 w-4" />
                      <span>{label as string}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void handleRunAgent()}
                disabled={running || !task.trim()}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800 no-hover-overlay disabled:opacity-50"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>Run agent</span>
              </button>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-900">Sandbox recipes</h2>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    Generates Python-only code for isolated Novita Agent Sandbox
                    sessions.
                  </p>
                </div>
                <Terminal className="h-5 w-5 text-zinc-500" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateRecipe("browser")}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] transition-colors hover:bg-zinc-50"
                >
                  <Globe className="h-4 w-4" />
                  <span>BrowserUse</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateRecipe("desktop")}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] transition-colors hover:bg-zinc-50"
                >
                  <Monitor className="h-4 w-4" />
                  <span>E2B Desktop</span>
                </button>
              </div>
              {recipe ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[12px] leading-5 text-zinc-600">
                    <p className="font-medium text-zinc-900">
                      {recipeKind === "browser" ? "BrowserUse" : "E2B Desktop"}{" "}
                      setup
                    </p>
                    <p className="mt-1">{recipe.install}</p>
                    <p className="mt-1">
                      Required env: {Object.keys(recipe.environment).join(", ")}
                    </p>
                  </div>
                  <CodeBlock code={recipe.code} />
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-[15px] font-semibold text-zinc-900">Agent output</h2>
              {agentError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                  {agentError}
                </p>
              ) : null}
              {agentReasoning ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 text-[12px] font-semibold text-zinc-600">
                    Reasoning stream
                  </p>
                  <p className="whitespace-pre-wrap text-[12px] leading-5 text-zinc-500">
                    {agentReasoning}
                  </p>
                </div>
              ) : null}
              <div className="mt-3 min-h-[180px] rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                {running ? (
                  <p className="flex items-center gap-2 text-[13px] text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Novita agent request
                  </p>
                ) : agentAnswer ? (
                  <pre className="whitespace-pre-wrap text-[13px] leading-6 text-zinc-800">
                    {agentAnswer}
                  </pre>
                ) : (
                  <p className="text-[13px] leading-6 text-zinc-500">
                    Run the agent to test multimodal input, tools, structured
                    output, and reasoning.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-zinc-900">Deployments</h2>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                ) : null}
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  value={linkEndpoint}
                  onChange={(event) => setLinkEndpoint(event.target.value)}
                  placeholder="Link existing NovitaClaw URL"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-300"
                />
                <button
                  type="button"
                  onClick={() => void handleLinkDeployment()}
                  disabled={creatingDeployment || !linkEndpoint.trim()}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50"
                >
                  Link
                </button>
              </div>
              {deployments.length > 0 ? (
                <ul className="space-y-2">
                  {deployments.map((deployment) => (
                    <li
                      key={deployment.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-zinc-900">
                            {deployment.name}
                          </p>
                          <p className="mt-1 text-[12px] text-zinc-500">
                            {deployment.kind ?? "persistent"} ·{" "}
                            {deployment.status}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600">
                          {new Date(deployment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {deployment.endpoint ? (
                        <a
                          href={deployment.endpoint}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[12px] text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {deployment.endpoint}
                          </span>
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-[13px] text-zinc-500">
                  No Claw deployments yet.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                <Video className="h-4 w-4" />
                Video note
              </h2>
              <p className="text-[12px] leading-5 text-zinc-500">
                Novita’s VLM page documents image URL and base64 image parts.
                This app accepts video URL parts through the agent API for
                models or future endpoints that support them; local video files
                are not converted in-browser.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
