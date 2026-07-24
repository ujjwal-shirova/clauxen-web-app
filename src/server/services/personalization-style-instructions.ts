/**
 * Loads modular personalization instruction .md files that append alongside
 * the main model system prompt. Memoized for the process lifetime.
 */

import fs from "fs";
import path from "path";
import { MODEL_SYSTEM_PROMPTS_DIR } from "@/server/inference/system-prompt";

const PERSONALIZATION_DIR = path.join(
  MODEL_SYSTEM_PROMPTS_DIR,
  "personalization",
);

const cache = new Map<string, string>();

function slugifyLevel(value: string | null | undefined): string {
  const raw = (value || "Default").trim().toLowerCase();
  if (raw === "more") return "more";
  if (raw === "less") return "less";
  return "default";
}

function slugifyBaseStyle(value: string | null | undefined): string {
  const raw = (value || "Default").trim().toLowerCase();
  const allowed = new Set([
    "default",
    "professional",
    "friendly",
    "candid",
    "quirky",
    "efficient",
    "cynical",
  ]);
  return allowed.has(raw) ? raw : "default";
}

function readInstruction(relativePath: string): string {
  if (cache.has(relativePath)) return cache.get(relativePath)!;
  const fullPath = path.join(PERSONALIZATION_DIR, relativePath);
  try {
    const content = fs.readFileSync(fullPath, "utf8").trim();
    cache.set(relativePath, content);
    return content;
  } catch (error) {
    console.error(
      `[personalization] missing instruction file: ${relativePath}`,
      error,
    );
    cache.set(relativePath, "");
    return "";
  }
}

export type PersonalizationStyleSelection = {
  baseStyleTone: string | null;
  characteristicWarm: string | null;
  characteristicEnthusiastic: string | null;
  characteristicHeadersLists: string | null;
  characteristicEmoji: string | null;
};

/**
 * Load the modular style/characteristic instruction bodies for the user's
 * current settings. Always includes Default variants so virgil.md can stay
 * free of personality/tone defaults.
 */
export function loadPersonalizationStyleInstructions(
  selection: PersonalizationStyleSelection,
): {
  baseStyle: string;
  warm: string;
  enthusiastic: string;
  headersLists: string;
  emoji: string;
} {
  const base = slugifyBaseStyle(selection.baseStyleTone);
  const warm = slugifyLevel(selection.characteristicWarm);
  const enthusiastic = slugifyLevel(selection.characteristicEnthusiastic);
  const headersLists = slugifyLevel(selection.characteristicHeadersLists);
  const emoji = slugifyLevel(selection.characteristicEmoji);

  return {
    baseStyle: readInstruction(path.join("base-style", `${base}.md`)),
    warm: readInstruction(path.join("warm", `${warm}.md`)),
    enthusiastic: readInstruction(
      path.join("enthusiastic", `${enthusiastic}.md`),
    ),
    headersLists: readInstruction(
      path.join("headers-lists", `${headersLists}.md`),
    ),
    emoji: readInstruction(path.join("emoji", `${emoji}.md`)),
  };
}

/** Format modular instructions into a system-prompt block. */
export function formatPersonalizationStyleBlock(
  selection: PersonalizationStyleSelection,
): string {
  const parts = loadPersonalizationStyleInstructions(selection);
  const sections: string[] = [];

  if (parts.baseStyle) {
    sections.push(
      ["<base_style_and_tone>", parts.baseStyle, "</base_style_and_tone>"].join(
        "\n",
      ),
    );
  }
  if (parts.warm) {
    sections.push(
      ["<characteristic_warm>", parts.warm, "</characteristic_warm>"].join(
        "\n",
      ),
    );
  }
  if (parts.enthusiastic) {
    sections.push(
      [
        "<characteristic_enthusiastic>",
        parts.enthusiastic,
        "</characteristic_enthusiastic>",
      ].join("\n"),
    );
  }
  if (parts.headersLists) {
    sections.push(
      [
        "<characteristic_headers_lists>",
        parts.headersLists,
        "</characteristic_headers_lists>",
      ].join("\n"),
    );
  }
  if (parts.emoji) {
    sections.push(
      ["<characteristic_emoji>", parts.emoji, "</characteristic_emoji>"].join(
        "\n",
      ),
    );
  }

  if (sections.length === 0) return "";

  return [
    "<response_style>",
    "Apply these modular style and characteristic instructions when they do not conflict with Shirova safety or platform guidelines.",
    "They refine how Clauxen communicates; they do not change capabilities or override safety.",
    "",
    ...sections,
    "</response_style>",
  ].join("\n");
}
