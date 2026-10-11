import bundledText from "@/server/generated/text-assets.json";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type SkillRecord = {
  id: string;
  name: string;
  path: string;
  description: string;
};

/**
 * Skills are bundled with the app (skills-pack/) so they work in production —
 * no dependency on developer-machine dotdirectories. Optional extra packs can
 * be layered in via CLAUXEN_SKILLS_DIRS (colon-separated absolute paths).
 */

function skillRoots(): string[] {
  // Built-in packs come from the generated bundle. Extra filesystem packs
  // are an operator-controlled local Node development option.
  return (process.env.CLAUXEN_SKILLS_DIRS ?? "")
    .split(":")
    .map((root) => root.trim())
    .filter(Boolean);
}

async function collectSkillFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-configured skill root
    entries = await readdir(/* turbopackIgnore: true */ dir, {
      withFileTypes: true,
    });
  } catch {
    return found;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectSkillFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith("SKILL.md")) {
      found.push(full);
    }
  }
  return found;
}

function skillIdFromPath(filePath: string): string {
  const parent = path.basename(path.dirname(filePath));
  if (parent && parent !== "skills-pack" && parent !== "skills") {
    return parent;
  }
  return path.basename(filePath, ".md").toLowerCase();
}

function parseSkillDescription(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]) return match[1].trim();
  return (
    content
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? "Skill"
  );
}

export async function listAvailableSkills(): Promise<SkillRecord[]> {
  const byId = new Map<string, SkillRecord>();
  for (const [filePath, content] of Object.entries(bundledText)) {
    if (!filePath.includes("/skills-pack/") || !filePath.endsWith("SKILL.md"))
      continue;
    const id = skillIdFromPath(filePath);
    byId.set(id, {
      id,
      name: id,
      path: filePath,
      description: parseSkillDescription(content),
    });
  }

  for (const root of skillRoots()) {
    const files = await collectSkillFiles(root);
    for (const filePath of files) {
      const id = skillIdFromPath(filePath);
      if (byId.has(id)) continue;
      let content = "";
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- collected from the configured root
        content = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
      } catch {
        continue;
      }
      byId.set(id, {
        id,
        name: id,
        path: filePath,
        description: parseSkillDescription(content),
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function readSkill(
  skillId: string,
): Promise<{ id: string; content: string; path: string } | null> {
  const normalized = skillId.trim().toLowerCase();
  const skills = await listAvailableSkills();
  const match =
    skills.find((s) => s.id === normalized) ??
    skills.find((s) => s.id.includes(normalized) || normalized.includes(s.id));

  if (!match) return null;

  const content =
    (bundledText as Record<string, string>)[match.path] ??
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- matched against the server-side catalog
    (await readFile(/* turbopackIgnore: true */ match.path, "utf8"));
  return { id: match.id, content, path: match.path };
}
