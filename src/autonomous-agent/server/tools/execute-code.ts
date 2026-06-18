import {
  getOrCreateSandbox,
  runSandboxCode,
} from "@/backend/sandbox/sandbox-manager";

export async function runExecuteCode(
  code: string,
  conversationId: string,
): Promise<{
  stdout: string;
  stderr: string;
  error: string | null;
  result: unknown;
}> {
  const { info } = await getOrCreateSandbox({ conversationId });
  const execution = await runSandboxCode(info.sandboxId, code);

  const stdout =
    execution.logs?.stdout?.join("") ??
    (typeof execution.text === "string" ? execution.text : "");
  const stderr = execution.logs?.stderr?.join("") ?? "";
  const error =
    execution.error != null
      ? typeof execution.error === "string"
        ? execution.error
        : JSON.stringify(execution.error)
      : null;

  return {
    stdout,
    stderr,
    error,
    result: execution.results ?? null,
  };
}
