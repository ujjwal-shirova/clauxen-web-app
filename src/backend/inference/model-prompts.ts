import fs from "fs";
import path from "path";
import type { ConfiguredModelId } from "@/lib/model-config";

const PROMPTS_DIR = path.join(process.cwd(), "src", "models-system-prompts");

const loadedPrompts = new Map<string, string>();

function filenameForModel(model: ConfiguredModelId | string): string {
  const key = (model || "").toLowerCase();
  if (key === "homer" || key === "homor") return "homor.md";
  if (key === "helios") return "helios.md";
  if (key === "virgil") return "virgil.md";
  // Heuristic fallback based on slug hints
  if (key.includes("homer") || key.includes("kimi")) return "homor.md";
  if (key.includes("helios") || key.includes("nex")) return "helios.md";
  if (key.includes("virgil") || key.includes("deepseek")) return "virgil.md";
  return "helios.md"; // safe default for focus
}

function stripSystemPrefix(raw: string): string {
  // MDs often start with "System:\n\n" or similar labels; keep the instructional content.
  return raw.replace(/^\s*System:\s*\n+/i, "").trimStart();
}

/**
 * Load the full model-specific system prompt from the .md file.
 * Results are memoized for the process lifetime (static content).
 * The returned string is suitable as a stable prefix for Novita prompt caching.
 */
export function getModelSystemPrompt(
  model: ConfiguredModelId | string,
): string {
  const filename = filenameForModel(model);
  if (loadedPrompts.has(filename)) {
    return loadedPrompts.get(filename)!;
  }
  const fullPath = path.join(PROMPTS_DIR, filename);
  const raw = fs.readFileSync(fullPath, "utf8");
  const content = stripSystemPrefix(raw);
  loadedPrompts.set(filename, content);
  return content;
}

/**
 * Build a cache-friendly system prefix for the given model.
 * Places the entire static MD prompt first (for prefix caching).
 * Optional suffix can be used for small dynamic additions (title gen, etc),
 * but keep them minimal and append after the main content so the head remains stable.
 */
export function buildModelSystemPrompt(opts: {
  model?: ConfiguredModelId | string;
  append?: string;
}): string {
  const base = getModelSystemPrompt(opts.model ?? "helios");
  if (opts.append && opts.append.trim()) {
    // Append after a clear boundary; the prefix up to the MD remains identical.
    return `${base}\n\n${opts.append.trim()}`;
  }
  return base;
}

/**
 * For prefix-cache ordering: return [staticModelSystem, ...rest].
 * Use at the point you assemble the messages list for the API call.
 */
export function withModelSystemPrefix<T extends { role: string; content?: any }>(
  modelSystem: string,
  rest: T[],
): T[] {
  const sys: T = { role: "system", content: modelSystem } as T;
  // If the first item is already a system, we replace the head with the full model one
  // to guarantee stable large prefix. Otherwise prepend.
  if (rest.length > 0 && rest[0]?.role === "system") {
    const [, ...tail] = rest;
    return [sys, ...tail];
  }
  return [sys, ...rest];
}
