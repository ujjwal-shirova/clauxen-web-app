import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveSandboxReadableCandidates,
  resolveSandboxWorkspacePath,
  sandboxWorkspaceDir,
  toWorkspaceRelativePath,
} from "@/server/inference/autonomous-tools/workspace";

describe("sandbox workspace paths", () => {
  const chatId = "chat_abc123";
  const root = sandboxWorkspaceDir(chatId);

  it("keeps paths already under the workspace root", () => {
    assert.equal(
      resolveSandboxWorkspacePath(chatId, `${root}/outputs/report.pdf`),
      `${root}/outputs/report.pdf`,
    );
  });

  it("resolves relative deliverables under the workspace", () => {
    assert.equal(
      resolveSandboxWorkspacePath(chatId, "outputs/report.pdf"),
      `${root}/outputs/report.pdf`,
    );
  });

  it("remaps absolute paths outside the workspace into outputs/", () => {
    assert.equal(
      resolveSandboxWorkspacePath(chatId, "/tmp/report.pdf"),
      `${root}/outputs/report.pdf`,
    );
  });

  it("reads absolute outside-workspace paths first, then remapped", () => {
    assert.deepEqual(
      resolveSandboxReadableCandidates(chatId, "/tmp/report.pdf"),
      ["/tmp/report.pdf", `${root}/outputs/report.pdf`],
    );
  });

  it("normalizes display paths relative to the workspace", () => {
    assert.equal(
      toWorkspaceRelativePath(chatId, `${root}/outputs/a.md`),
      "outputs/a.md",
    );
    assert.equal(
      toWorkspaceRelativePath(chatId, "/tmp/a.md"),
      "outputs/a.md",
    );
  });
});
