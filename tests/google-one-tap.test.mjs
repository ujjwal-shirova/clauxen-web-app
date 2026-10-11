import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createHash } from "node:crypto";

const directory = await mkdtemp(
  new URL("../node_modules/.cache-one-tap-", import.meta.url),
);
after(() => rm(directory, { recursive: true, force: true }));
const outfile = `${directory}/one-tap.mjs`;
const mocks = {
  react: `export const useRef = value => globalThis.harness.ref(value);
    export const useEffect = (effect, deps) => globalThis.harness.effect(effect, deps);`,
  "@/hooks/use-auth": `export const useAuth = () => globalThis.harness.auth;`,
  "@/contexts/auth-gate-context": `export const useOptionalAuthGate = () => globalThis.harness.gate;`,
  "@/utils/supabase/client": `export const createClient = () => globalThis.harness.supabase;`,
};
await build({
  entryPoints: ["src/client/components/auth/google-one-tap.tsx"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
  plugins: [
    {
      name: "doubles",
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, (args) =>
          args.path in mocks
            ? { path: args.path, namespace: "double" }
            : undefined,
        );
        builder.onLoad({ filter: /.*/, namespace: "double" }, (args) => ({
          contents: mocks[args.path],
          loader: "js",
        }));
      },
    },
  ],
});
const { GoogleOneTap } = await import(pathToFileURL(outfile).href);
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

function setup({
  loading = false,
  user = null,
  gateOpen = false,
  scriptReady = true,
} = {}) {
  const refs = [];
  let refIndex = 0;
  let dependencies;
  let cleanup;
  const calls = { prompt: 0, cancel: 0, refresh: 0, tokens: [], configs: [] };
  const id = {
    initialize: (config) => calls.configs.push(config),
    prompt: () => calls.prompt++,
    cancel: () => calls.cancel++,
  };
  const scripts = [];
  const harness = {
    auth: {
      loading,
      user,
      refresh: async () => {
        calls.refresh++;
      },
    },
    gate: { isOpen: gateOpen },
    supabase: {
      auth: {
        signInWithIdToken: async (value) => {
          calls.tokens.push(value);
          return { error: null };
        },
      },
    },
    ref(value) {
      const index = refIndex++;
      return (refs[index] ??= { current: value });
    },
    effect(effect, deps) {
      if (!dependencies || deps.some((value, i) => value !== dependencies[i])) {
        cleanup?.();
        dependencies = deps;
        cleanup = effect();
      }
    },
    render() {
      refIndex = 0;
      GoogleOneTap();
    },
    unmount() {
      cleanup?.();
    },
    strictReplay() {
      cleanup?.();
      dependencies = undefined;
      this.render();
    },
  };
  globalThis.harness = harness;
  globalThis.window = scriptReady ? { google: { accounts: { id } } } : {};
  globalThis.document = {
    querySelector: () => scripts[0],
    head: { appendChild: (script) => scripts.push(script) },
    createElement: () => {
      const listeners = new Map();
      return {
        setAttribute() {},
        addEventListener(event, listener) {
          listeners.set(event, [...(listeners.get(event) ?? []), listener]);
        },
        removeEventListener(event, listener) {
          listeners.set(
            event,
            (listeners.get(event) ?? []).filter((item) => item !== listener),
          );
        },
        dispatch(event) {
          for (const listener of listeners.get(event) ?? []) listener();
        },
        remove() {
          scripts.splice(scripts.indexOf(this), 1);
        },
      };
    },
  };
  return { harness, calls, id, scripts };
}

test("guest is prompted on load without interaction and receives a nonce-bound session", async () => {
  const { harness, calls } = setup();
  harness.render();
  await flush();
  assert.equal(calls.prompt, 1);
  const config = calls.configs[0];
  assert.equal(config.auto_select, false);
  config.callback({ credential: "fixture-google-token" });
  config.callback({ credential: "fixture-google-token" });
  await flush();
  assert.equal(calls.tokens.length, 1);
  assert.equal(calls.tokens[0].provider, "google");
  assert.equal(calls.tokens[0].token, "fixture-google-token");
  assert.equal(
    config.nonce,
    createHash("sha256").update(calls.tokens[0].nonce).digest("hex"),
  );
  assert.equal(calls.refresh, 1);
  harness.unmount();
});

test("waits for auth and never prompts signed-in users or over an open sign-in gate", async () => {
  for (const state of [
    { loading: true },
    { user: { id: "signed-in" } },
    { gateOpen: true },
  ]) {
    const { harness, calls } = setup(state);
    harness.render();
    await flush();
    assert.equal(calls.prompt, 0);
    harness.unmount();
  }
  const { harness, calls } = setup({ loading: true });
  harness.render();
  harness.auth.loading = false;
  harness.render();
  await flush();
  assert.equal(calls.prompt, 1);
  harness.unmount();
});

test("gate context updates do not restart the prompt and opening the gate cancels it", async () => {
  const { harness, calls } = setup();
  harness.render();
  await flush();
  harness.gate = { isOpen: false };
  harness.render();
  assert.equal(calls.cancel, 0);
  harness.gate = { isOpen: true };
  harness.render();
  assert.equal(calls.cancel, 1);
  harness.gate = { isOpen: false };
  harness.render();
  await flush();
  assert.equal(calls.prompt, 1);
  harness.unmount();
});

test("Strict Mode effect replay prompts once and ignores stale credential callbacks", async () => {
  const { harness, calls } = setup();
  harness.render();
  harness.strictReplay();
  await flush();
  assert.equal(calls.prompt, 1);
  harness.unmount();
  calls.configs[0].callback({ credential: "stale-token" });
  await flush();
  assert.equal(calls.tokens.length, 0);
});

test("shared script loading survives effect replay without duplicate scripts", async () => {
  const { harness, calls, id, scripts } = setup({ scriptReady: false });
  harness.render();
  harness.strictReplay();
  assert.equal(scripts.length, 1);
  globalThis.window.google = { accounts: { id } };
  scripts[0].dispatch("load");
  await flush();
  assert.equal(calls.prompt, 1);
  harness.unmount();
});

test("failed token verification never refreshes authenticated identity", async () => {
  const { harness, calls } = setup();
  harness.supabase.auth.signInWithIdToken = async () => ({
    error: { message: "Invalid ID token" },
  });
  harness.render();
  await flush();
  const warn = console.warn;
  try {
    console.warn = () => {};
    calls.configs[0].callback({ credential: "invalid-token" });
    await flush();
    assert.equal(calls.refresh, 0);
    assert.equal(calls.prompt, 1);
  } finally {
    console.warn = warn;
    harness.unmount();
  }
});

test("security headers allow the Google library, frames, styles and FedCM requests", async () => {
  const configFile = `${directory}/next-config.mjs`;
  await build({
    entryPoints: ["next.config.ts"],
    outfile: configFile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const { default: config } = await import(pathToFileURL(configFile).href);
  const entries = await config.headers();
  const headers = entries.find((entry) => entry.source === "/:path*").headers;
  const csp = headers.find(
    (header) => header.key === "Content-Security-Policy",
  ).value;
  const directives = Object.fromEntries(
    csp.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  assert.ok(
    directives["script-src"].includes("https://accounts.google.com/gsi/client"),
  );
  assert.ok(
    directives["style-src"].includes("https://accounts.google.com/gsi/style"),
  );
  for (const name of ["connect-src", "frame-src"]) {
    assert.ok(directives[name].includes("https://accounts.google.com/gsi/"));
  }
  assert.ok(
    headers
      .find((header) => header.key === "Permissions-Policy")
      .value.includes("identity-credentials-get=(self)"),
  );
});
