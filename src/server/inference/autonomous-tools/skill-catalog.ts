import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function bundledSkillsDir(): string {
  const fromModule = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "skills-pack",
  );
  const fromCwd = path.join(
    process.cwd(),
    "src",
    "server",
    "inference",
    "autonomous-tools",
    "skills-pack",
  );
  for (const candidate of [fromModule, fromCwd]) {
    if (existsSync(candidate)) return candidate;
  }
  return fromCwd;
}

function skillRoots(): string[] {
  const roots = [bundledSkillsDir()];
  const extra = process.env.CLAUXEN_SKILLS_DIRS?.trim();
  if (extra) {
    roots.push(...extra.split(":").map((p) => p.trim()).filter(Boolean));
  }
  return roots;
}

async function collectSkillFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
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
  return content.split("\n").find((l) => l.trim())?.trim() ?? "Skill";
}

export async function listAvailableSkills(): Promise<SkillRecord[]> {
  const byId = new Map<string, SkillRecord>();

  for (const root of skillRoots()) {
    const files = await collectSkillFiles(root);
    for (const filePath of files) {
      const id = skillIdFromPath(filePath);
      if (byId.has(id)) continue;
      let content = "";
      try {
        content = await readFile(filePath, "utf8");
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

  const content = await readFile(match.path, "utf8");
  return { id: match.id, content, path: match.path };
}
