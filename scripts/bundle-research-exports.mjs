/* eslint-disable security/detect-non-literal-fs-filename -- Output paths are fixed or derived from a SHA-256 content hash. */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const result = await build({
  entryPoints: ["src/client/workers/research-export.worker.ts"],
  outfile: "research-export.worker.js",
  write: false,
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "none",
  logLevel: "error",
});
const bytes = result.outputFiles[0].contents;
const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
const name = `research-export-${hash}.worker.js`;
writeFileSync(`public/${name}`, bytes);
mkdirSync("src/client/generated", { recursive: true });
writeFileSync(
  "src/client/generated/research-export-manifest.ts",
  `export const RESEARCH_EXPORT_WORKER_URL = "/${name}";\n`,
);
console.log("Bundled local research export worker");
