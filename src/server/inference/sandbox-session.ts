export {
  createSandbox,
  connectSandbox,
  getOrCreateSandbox,
  listSandboxes,
  getSandboxInfo,
  getSandboxMetrics,
  setSandboxTimeout,
  pauseSandbox,
  killSandbox,
  runSandboxCommand,
  runSandboxCode,
  readSandboxFile,
  readSandboxFileBytes,
  makeSandboxDir,
  writeSandboxFile,
  writeSandboxFiles,
  listSandboxFiles,
  getSandboxPublicHost,
  isSandboxRunning,
  clearSandboxSession,
} from "@/server/sandbox/sandbox-manager";

export type { SandboxSessionContext } from "@/server/sandbox/types";

/** @deprecated Use getOrCreateSandbox from sandbox-manager */
export async function ensureSandboxReady(opts?: {
  userId?: string;
  conversationId?: string;
}) {
  const { sandbox } = await (
    await import("@/server/sandbox/sandbox-manager")
  ).getOrCreateSandbox(opts);
  return { sandbox, ready: true as const };
}
