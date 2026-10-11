import assert from "node:assert/strict";
import { after, test as nodeTest } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const directory = await mkdtemp(
  new URL("../node_modules/.cache-startup-", import.meta.url),
);
const cases = [];
const test = (name, run) => cases.push([name, run]);
let number = 0;
async function load(entry, mocks) {
  const outfile = `${directory}/${++number}.mjs`;
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "service-doubles",
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
  return import(pathToFileURL(outfile).href);
}
const state = {
  loads: 0,
  started: 0,
  projectStarted: false,
  pluginsStarted: false,
};
globalThis.__startupTest = state;
const stream = await load("src/app/api/chat/stream.ts", {
  "@/server/agent-core": `export async function runAutonomousAgent(sse, options) {
    globalThis.__startupTest.started++; globalThis.__startupTest.agentOptions=options;
    options.onProviderDispatch?.(); sse.writeDone(); sse.finalize();
  }`,
  "@/server/services/user-personalization.service": `export async function loadUserPersonalization() {globalThis.__startupTest.loads++; return {extendedThinking:true};}
  export async function buildUserPersonalizationAppend(id, preloaded) {await preloaded; return 'personalization';}`,
  "@/server/services/follow-up-settings.service": `export async function loadFollowUpSuggestionsEnabled() {return false;}`,
  "@/lib/model-catalog": `export const modelCatalogEnvFromProcess = () => ({}); export const parseChatModelId=()=> 'fixture'; export const resolveModelRuntime=()=>({modelSlug:'fixture'});`,
  "@/server/inference/system-prompt": `export const buildModelSystemPrompt=({append})=>append; export const buildTemporalContextAppend=()=>'';`,
  "@/server/services/project-context": `export function loadProjectPromptAppend() {globalThis.__startupTest.projectStarted=true; return globalThis.__startupTest.projectPromise;}`,
  "@/server/plugins/plugin-runtime": `export function buildAgentMcpTools() {globalThis.__startupTest.pluginsStarted=true; return globalThis.__startupTest.pluginPromise;}`,
});
test("personalization reads its profile/settings once and preserves thinking preferences", async () => {
  const bundle = await stream.loadChatStreamPersonalization("fixture-user");
  assert.equal(state.loads, 1);
  assert.equal(bundle.personalizationAppend, "personalization");
  assert.equal(bundle.extendedThinkingDefault, true);
  assert.equal(bundle.followUpsEnabled, false);
});
test("project context and plugin catalog overlap prompt preparation but remain required before inference", async () => {
  let releaseProject, releasePlugins, releaseContext;
  state.projectPromise = new Promise((resolve) => {
    releaseProject = resolve;
  });
  state.pluginPromise = new Promise((resolve) => {
    releasePlugins = resolve;
  });
  const context = new Promise((resolve) => {
    releaseContext = resolve;
  });
  let dispatched = 0;
  const body = await stream.createChatStream(
    [{ role: "user", content: "hello" }],
    {
      userId: "fixture-user",
      conversationId: "fixture-chat",
      resolveContext: () => context,
      onProviderDispatch: () => {
        dispatched++;
      },
    },
  );
  assert.equal(state.projectStarted, true);
  assert.equal(state.pluginsStarted, true);
  assert.equal(state.started, 0);
  const drain = new Response(body).text();
  releaseContext({
    modelMessages: [{ role: "user", content: "hello" }],
    personalization: {
      personalizationAppend:
        "<memory_and_tools>outside memory</memory_and_tools>",
      followUpsEnabled: false,
      extendedThinkingDefault: false,
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.started, 0, "project and tool context cannot be skipped");
  releaseProject({ text: "project instructions", projectOnly: true });
  releasePlugins([
    { name: "mcp__fixture__search", type: "function", parameters: {} },
  ]);
  await drain;
  assert.equal(dispatched, 1);
  assert.equal(state.agentOptions.mcpAgentTools.length, 1);
  assert.match(state.agentOptions.systemPrompt, /project instructions/);
  assert.doesNotMatch(state.agentOptions.systemPrompt, /outside memory/);
});
test("enrichment deadline elapses while mandatory persistence is still running", async () => {
  let settled = false;
  const bounded = stream
    .withBudget(new Promise(() => {}), "fallback", 5)
    .then((value) => {
      settled = true;
      return value;
    });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(settled, true);
  assert.equal(await bounded, "fallback");
  assert.equal(
    await stream.withBudget(
      Promise.resolve("loaded preferences"),
      "fallback",
      0,
    ),
    "loaded preferences",
  );
  assert.equal(
    await stream.withBudget(
      Promise.reject(new Error("unavailable")),
      "safe",
      100,
    ),
    "safe",
  );
});
const plugins = await load("src/server/plugins/plugin-runtime.ts", {
  "@/server/config/env": `export const env={};`,
  "@/server/plugins/token-crypto": `export function unsealSecret() {throw new Error('Unexpected token decryption during catalog preparation');}`,
  "@/server/plugins/mcp-client": `export function listMcpTools() {throw new Error('Unexpected remote MCP handshake');} export function callMcpTool() {} export function mcpResultToText() {}`,
  "@/server/repositories/plugin-connections.repository": `export async function listActiveConnectionsForUser(userId) {return [{id:userId,plugin_id:'fixture',plugin_name:'Fixture',status:'active'}];}
    export async function listConnectionTools() {return [{tool_name:'search',description:'Search',input_schema:{type:'object'}}];}
    export function readSealedTokens() {throw new Error('Unexpected OAuth lookup during catalog preparation');}`,
});
test("saved connected-plugin definitions require no OAuth refresh or remote discovery on send", async () => {
  const tools = await plugins.buildAgentMcpTools("fixture-user");
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "mcp__fixture__search");
});

const fenceState = { row: { id: "assistant-fixture" }, calls: [] };
globalThis.__startupFenceTest = fenceState;
const jobs = await load(
  "src/server/repositories/generation-jobs.repository.ts",
  {
    "@/server/db/pool": `export async function queryOne(sql, values) {globalThis.__startupFenceTest.calls.push(values); return globalThis.__startupFenceTest.row;} export async function query() {return [];}`,
  },
);
test("starting a reserved reply checks its job lease and updates it in one round-trip", async () => {
  const input = {
    jobId: "job",
    lockedBy: "worker",
    chatId: "chat",
    assistantMessageId: "assistant-fixture",
  };
  await jobs.startGenerationMessage(input);
  assert.equal(fenceState.calls.length, 1);
  assert.deepEqual(fenceState.calls[0], [
    "job",
    "worker",
    "chat",
    "assistant-fixture",
  ]);
  fenceState.row = null;
  await assert.rejects(
    jobs.startGenerationMessage(input),
    (error) => error.code === "generation_lease_lost",
  );
});
for (const [name, run] of cases) nodeTest(name, run);
after(async () => {
  delete globalThis.__startupTest;
  delete globalThis.__startupFenceTest;
  await rm(directory, { recursive: true, force: true });
});
