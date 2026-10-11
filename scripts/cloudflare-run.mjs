#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Paths come from fixed local configuration lists. */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

const runtimeEnv = {};
for (const file of [
  ".env.vercel",
  ".env.local",
  ".env.production",
  ".dev.vars",
]) {
  if (existsSync(file))
    Object.assign(
      runtimeEnv,
      Object.fromEntries(
        Object.entries(parse(readFileSync(file))).filter(([, value]) => value),
      ),
    );
}
// CI-provided values take precedence over local defaults.
Object.assign(runtimeEnv, process.env);
runtimeEnv.CLOUDFLARE_API_TOKEN = runtimeEnv.CLOUDFLARE_API_TOKEN?.trim();
runtimeEnv.CLOUDFLARE_ACCOUNT_ID = "8fc7a67e9057989309921f362784ecf4";
runtimeEnv.HOSTING_PLATFORM = "cloudflare";
runtimeEnv.NEXT_PUBLIC_APP_URL = "https://www.clauxen.com";
runtimeEnv.AUTH_DEV_BYPASS = "false";
runtimeEnv.STORAGE_REQUIRE_R2 = "true";
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Pass a local CLI command and its arguments");
const child = spawn(`node_modules/.bin/${command}`, args, {
  env: runtimeEnv,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
