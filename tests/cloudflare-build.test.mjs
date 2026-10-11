/* eslint-disable security/detect-non-literal-fs-filename -- Files are created only under a disposable test directory. */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const verifier = fileURLToPath(
  new URL("../scripts/verify-cloudflare-build.mjs", import.meta.url),
);

function checkBuild(files) {
  const cwd = mkdtempSync(join(tmpdir(), "clauxen-build-"));
  try {
    for (const file of files) {
      const path = join(cwd, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "test fixture");
    }
    return spawnSync(process.execPath, [verifier], { cwd, encoding: "utf8" });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("fresh checkout fails with the Cloudflare build command", () => {
  const result = checkBuild([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run npm run cf:build/);
});

test("Next.js output alone cannot be deployed as a Worker", () => {
  const result = checkBuild([".next/BUILD_ID"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm run build only builds Next.js/);
});

test("complete OpenNext output passes deployment validation", () => {
  const result = checkBuild([
    ".open-next/.build/open-next.config.edge.mjs",
    ".open-next/worker.js",
    ".open-next/server-functions/default/handler.mjs",
    ".open-next/assets/BUILD_ID",
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /assets verified/);
});
