#!/usr/bin/env node
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const files = {};
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(md|txt)$/.test(entry.name))
      files[file.replaceAll("\\", "/")] = readFileSync(file, "utf8");
  }
}
collect("src/prompts");
collect("src/server/inference/autonomous-tools/skills-pack");
files["src/server/email-verifier/disposable.txt"] = readFileSync(
  "src/server/email-verifier/disposable.txt",
  "utf8",
);
mkdirSync("src/server/generated", { recursive: true });
writeFileSync(
  "src/server/generated/text-assets.json",
  JSON.stringify(files) + "\n",
);
console.log(`Bundled ${Object.keys(files).length} server text assets`);
