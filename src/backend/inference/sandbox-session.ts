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
  writeSandboxFile,
  writeSandboxFiles,
  listSandboxFiles,
  getSandboxPublicHost,
  isSandboxRunning,
  clearSandboxSession,
} from "@/backend/sandbox/sandbox-manager";

export type { SandboxSessionContext } from "@/backend/sandbox/types";

/** @deprecated Use getOrCreateSandbox from sandbox-manager */
export async function ensureSandboxReady(opts?: {
  userId?: string;
  conversationId?: string;
}) {
  const { sandbox } = await (
    await import("@/backend/sandbox/sandbox-manager")
  ).getOrCreateSandbox(opts);
  return { sandbox, ready: true as const };
}
