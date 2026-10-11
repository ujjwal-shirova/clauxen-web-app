#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

const runtimeEnv = { ...process.env };
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
