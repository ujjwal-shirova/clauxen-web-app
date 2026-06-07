import { requireNovitaApiKey } from "@/backend/config/env";

type SandboxLike = {
  isRunning?: () => Promise<boolean>;
  files: {
    write: (path: string, content: string) => Promise<void>;
    read: (path: string) => Promise<string>;
  };
  commands: {
    run: (
      command: string,
      opts?: {
        onStdout?: (data: string) => void;
        onStderr?: (data: string) => void;
      },
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };
  runCode?: (code: string) => Promise<{
    stdout?: string;
    stderr?: string;
    logs?: { stdout?: string[]; stderr?: string[] };
    results?: unknown[];
  }>;
  getHost?: (port: number) => string;
  kill?: () => void;
};

const sessions = new Map<
  string,
  { sandbox: SandboxLike; sandboxId?: string; createdAt: number }
>();

const SANDBOX_TTL_MS = 5 * 60 * 1000;

function sessionKey(userId?: string, conversationId?: string) {
  return `${userId ?? "anon"}:${conversationId ?? "default"}`;
}

async function createSandbox(): Promise<SandboxLike> {
  process.env.NOVITA_API_KEY =
    process.env.NOVITA_API_KEY || requireNovitaApiKey();

  const mod = await import("novita-sandbox/code-interpreter");
  const Sandbox = mod.Sandbox as {
    create: (opts: {
      timeoutMs?: number;
      metadata?: Record<string, string>;
    }) => Promise<SandboxLike>;
  };

  return Sandbox.create({
    timeoutMs: SANDBOX_TTL_MS,
    metadata: { auto_resume: "true", app: "clauxen" },
  });
}

export async function getOrCreateSandbox(opts?: {
  userId?: string;
  conversationId?: string;
}): Promise<SandboxLike> {
  const key = sessionKey(opts?.userId, opts?.conversationId);
  const existing = sessions.get(key);
  if (existing) {
    const running = existing.sandbox.isRunning
      ? await existing.sandbox.isRunning().catch(() => false)
      : true;
    if (running) return existing.sandbox;
    sessions.delete(key);
  }

  const sandbox = await createSandbox();
  sessions.set(key, { sandbox, createdAt: Date.now() });
  return sandbox;
}

export async function ensureSandboxReady(opts?: {
  userId?: string;
  conversationId?: string;
}) {
  const sandbox = await getOrCreateSandbox(opts);
  return { sandbox, ready: true as const };
}

export function clearSandboxSession(opts?: {
  userId?: string;
  conversationId?: string;
}) {
  const key = sessionKey(opts?.userId, opts?.conversationId);
  const entry = sessions.get(key);
  entry?.sandbox.kill?.();
  sessions.delete(key);
}
