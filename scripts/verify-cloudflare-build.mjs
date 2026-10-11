#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Paths come from fixed local configuration lists. */
import { existsSync } from "node:fs";

const required = [
  ".open-next/.build/open-next.config.edge.mjs",
  ".open-next/worker.js",
  ".open-next/server-functions/default/handler.mjs",
  ".open-next/assets",
];
const missing = required.filter((path) => !existsSync(path));
if (missing.length) {
  console.error(
    `Cloudflare build is incomplete: ${missing.join(", ")}. Run npm run cf:build before deploying. npm run build only builds Next.js.`,
  );
  process.exitCode = 1;
} else {
  console.log("Cloudflare Worker bundle, compiled config, and assets verified");
}
