import type { SandboxBetaCreateOpts } from "novita-sandbox/code-interpreter";
import { requireNovitaApiKey } from "@/backend/config/env";
import type {
  SandboxCommandRequest,
  SandboxCreateOptions,
  SandboxPublicInfo,
  SandboxSessionContext,
} from "@/backend/sandbox/types";

type CodeInterpreterSandbox =
  Awaited<ReturnType<typeof loadSandboxClass>> extends {
    create: (...args: never[]) => infer R;
  }
    ? Awaited<R>
    : never;

type SandboxModule = typeof import("novita-sandbox/code-interpreter");

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const sessionIndex = new Map<string, string>();

function ensureProviderKey() {
  const key = requireNovitaApiKey();
  // novita-sandbox SDK reads NOVITA_API_KEY — mirror server-side only, never expose to client.
  process.env.NOVITA_API_KEY = process.env.NOVITA_API_KEY || key;
  process.env.Provider_API_Key = process.env.Provider_API_Key || key;
  return key;
}

async function loadSandboxClass() {
  ensureProviderKey();
  const mod =
    (await import("novita-sandbox/code-interpreter")) as SandboxModule;
  return mod.Sandbox;
}

function sessionKey(ctx?: SandboxSessionContext) {
  return `${ctx?.userId ?? "anon"}:${ctx?.conversationId ?? "default"}`;
}

function buildMetadata(opts: SandboxCreateOptions) {
  const metadata: Record<string, string> = {
    app: "clauxen",
    ...(opts.metadata ?? {}),
  };
  if (opts.userId) metadata.userId = opts.userId;
  if (opts.conversationId) metadata.conversationId = opts.conversationId;
  if (opts.autoResume !== false) metadata.auto_resume = "true";
  if (opts.idleTimeoutSeconds && opts.idleTimeoutSeconds >= 60) {
    metadata.idle_timeout = String(opts.idleTimeoutSeconds);
  }
  return metadata;
}

function serializeInfo(info: {
  sandboxId: string;
  templateId?: string;
  name?: string;
  metadata?: Record<string, string>;
  startedAt?: Date;
  endAt?: Date;
  state?: string;
  cpuCount?: number;
  memoryMB?: number;
}): SandboxPublicInfo {
  return {
    sandboxId: info.sandboxId,
    templateId: info.templateId,
    name: info.name,
    metadata: info.metadata ?? {},
    startedAt: info.startedAt?.toISOString(),
    endAt: info.endAt?.toISOString(),
    state: info.state,
    cpuCount: info.cpuCount,
    memoryMB: info.memoryMB,
  };
}

async function findExistingSandboxId(
  ctx: SandboxSessionContext,
): Promise<string | null> {
  const Sandbox = await loadSandboxClass();
  const metadata: Record<string, string> = { app: "clauxen" };
  if (ctx.userId) metadata.userId = ctx.userId;
  if (ctx.conversationId) metadata.conversationId = ctx.conversationId;

  const paginator = Sandbox.list({
    query: { metadata, state: ["running", "paused"] },
    limit: 5,
  });

  const items = await paginator.nextItems();
  return items[0]?.sandboxId ?? null;
}

export async function createSandbox(opts: SandboxCreateOptions = {}) {
  const Sandbox = await loadSandboxClass();
  const metadata = buildMetadata(opts);

  const createOpts = {
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    metadata,
    envs: opts.envs,
    ...(opts.autoPause ? { autoPause: true } : {}),
  };

  const sandbox = await Sandbox.create(createOpts as SandboxBetaCreateOpts);

  const key = sessionKey(opts);
  sessionIndex.set(key, sandbox.sandboxId);

  const info = await sandbox.getInfo();
  return { sandbox, info: serializeInfo(info) };
}

export async function connectSandbox(sandboxId: string, timeoutMs?: number) {
  const Sandbox = await loadSandboxClass();
  const sandbox = await Sandbox.connect(sandboxId, {
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  const info = await sandbox.getInfo();
  return { sandbox, info: serializeInfo(info) };
}

export async function getOrCreateSandbox(ctx?: SandboxSessionContext) {
  const key = sessionKey(ctx);
  const cachedId = sessionIndex.get(key);

  if (cachedId) {
    try {
      return await connectSandbox(cachedId);
    } catch {
      sessionIndex.delete(key);
    }
  }

  const existingId = ctx ? await findExistingSandboxId(ctx) : null;
  if (existingId) {
    const connected = await connectSandbox(existingId);
    sessionIndex.set(key, existingId);
    return connected;
  }

  const created = await createSandbox({
    userId: ctx?.userId,
    conversationId: ctx?.conversationId,
    autoResume: true,
  });
  sessionIndex.set(key, created.info.sandboxId);
  return created;
}

export async function listSandboxes(query?: {
  userId?: string;
  state?: Array<"running" | "paused">;
  limit?: number;
}) {
  const Sandbox = await loadSandboxClass();
  const metadata: Record<string, string> = { app: "clauxen" };
  if (query?.userId) metadata.userId = query.userId;

  const paginator = Sandbox.list({
    query: {
      metadata: query?.userId ? metadata : undefined,
      state: query?.state ?? ["running", "paused"],
    },
    limit: query?.limit ?? 50,
  });

  const sandboxes: SandboxPublicInfo[] = [];
  const page = await paginator.nextItems();
  sandboxes.push(...page.map((item) => serializeInfo(item)));
  while (paginator.hasNext && sandboxes.length < (query?.limit ?? 50)) {
    const next = await paginator.nextItems();
    if (!next.length) break;
    sandboxes.push(...next.map((item) => serializeInfo(item)));
  }
  return sandboxes.slice(0, query?.limit ?? 50);
}

export async function getSandboxInfo(sandboxId: string) {
  const Sandbox = await loadSandboxClass();
  const info = await Sandbox.getInfo(sandboxId);
  return serializeInfo(info);
}

export async function getSandboxMetrics(sandboxId: string) {
  const Sandbox = await loadSandboxClass();
  return Sandbox.getMetrics(sandboxId);
}

export async function setSandboxTimeout(sandboxId: string, timeoutMs: number) {
  const Sandbox = await loadSandboxClass();
  await Sandbox.setTimeout(sandboxId, timeoutMs);
  return { sandboxId, timeoutMs };
}

/** Extra time granted each keep-alive tick while a command is actively producing output. */
const KEEP_ALIVE_EXTENSION_MS = 5 * 60 * 1000;
/** Don't call setTimeout on every stdout chunk — once per window is enough. */
const KEEP_ALIVE_MIN_INTERVAL_MS = 20_000;

/**
 * Keep-alive for long-running commands (package installs, builds, etc.):
 * bumps the sandbox's own idle timeout while it's actively streaming output,
 * so a slow-but-alive command never gets killed by a fixed session timeout.
 * ponytail: naive fixed extension window rather than estimating true command
 * duration up front — the sandbox SDK doesn't expose a way to size that
 * ahead of time, and refreshing on activity is strictly more robust than a
 * one-shot guess. Ceiling: still bounded by MAX_SANDBOX_TIMEOUT_MS below.
 */
const MAX_SANDBOX_TIMEOUT_MS = 30 * 60 * 1000;

export function createSandboxKeepAlive(sandboxId: string) {
  let lastExtendAt = 0;
  let extending = false;

  const ping = () => {
    const now = Date.now();
    if (extending || now - lastExtendAt < KEEP_ALIVE_MIN_INTERVAL_MS) return;
    lastExtendAt = now;
    extending = true;
    setSandboxTimeout(
      sandboxId,
      Math.min(KEEP_ALIVE_EXTENSION_MS, MAX_SANDBOX_TIMEOUT_MS),
    )
      .catch(() => {
        // Best-effort — a failed keep-alive just means the sandbox may time
        // out at its previous deadline; the command result is unaffected.
      })
      .finally(() => {
        extending = false;
      });
  };

  return { ping };
}

export async function pauseSandbox(sandboxId: string) {
  const Sandbox = await loadSandboxClass();
  const paused = await Sandbox.betaPause(sandboxId);
  return { sandboxId, paused };
}

export async function killSandbox(sandboxId: string) {
  const Sandbox = await loadSandboxClass();
  await Sandbox.kill(sandboxId);
  for (const [key, id] of sessionIndex.entries()) {
    if (id === sandboxId) sessionIndex.delete(key);
  }
  return { sandboxId, killed: true };
}

export async function runSandboxCommand(
  sandboxId: string,
  request: SandboxCommandRequest,
) {
  const { sandbox } = await connectSandbox(sandboxId);
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const onStdout = (data: string) => {
    stdoutChunks.push(data);
    request.onStdout?.(data);
  };
  const onStderr = (data: string) => {
    stderrChunks.push(data);
    request.onStderr?.(data);
  };

  if (request.background) {
    const handle = await sandbox.commands.run(request.command, {
      background: true,
      cwd: request.cwd,
      envs: request.envs,
      timeoutMs: request.timeoutMs,
      onStdout,
      onStderr,
    });
    return {
      pid: handle.pid,
      background: true,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  }

  const result = await sandbox.commands.run(request.command, {
    cwd: request.cwd,
    envs: request.envs,
    timeoutMs: request.timeoutMs,
    onStdout,
    onStderr,
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
  };
}

export async function runSandboxCode(sandboxId: string, code: string) {
  const { sandbox } = await connectSandbox(sandboxId);
  const execution = await sandbox.runCode(code);
  return {
    text: execution.text,
    logs: execution.logs,
    results: execution.results,
    error: execution.error,
  };
}

export async function readSandboxFile(sandboxId: string, path: string) {
  const { sandbox } = await connectSandbox(sandboxId);
  return sandbox.files.read(path);
}

export async function writeSandboxFile(
  sandboxId: string,
  path: string,
  content: string,
) {
  const { sandbox } = await connectSandbox(sandboxId);
  return sandbox.files.write(path, content);
}

export async function writeSandboxFiles(
  sandboxId: string,
  files: Array<{ path: string; content: string }>,
) {
  const { sandbox } = await connectSandbox(sandboxId);
  return sandbox.files.write(
    files.map((file) => ({ path: file.path, data: file.content })),
  );
}

export async function listSandboxFiles(sandboxId: string, path: string) {
  const { sandbox } = await connectSandbox(sandboxId);
  return sandbox.files.list(path);
}

export async function getSandboxPublicHost(sandboxId: string, port: number) {
  const { sandbox } = await connectSandbox(sandboxId);
  const host = sandbox.getHost(port);
  return { host, url: `https://${host}`, port };
}

export async function isSandboxRunning(sandboxId: string) {
  const { sandbox } = await connectSandbox(sandboxId);
  return sandbox.isRunning();
}

export function clearSandboxSession(ctx?: SandboxSessionContext) {
  const key = sessionKey(ctx);
  sessionIndex.delete(key);
}

export type { CodeInterpreterSandbox };
