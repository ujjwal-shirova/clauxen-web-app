export type SandboxCreateOptions = {
  userId?: string;
  conversationId?: string;
  timeoutMs?: number;
  autoPause?: boolean;
  autoResume?: boolean;
  idleTimeoutSeconds?: number;
  metadata?: Record<string, string>;
  envs?: Record<string, string>;
};

export type SandboxSessionContext = {
  userId?: string;
  conversationId?: string;
};

export type SandboxPublicInfo = {
  sandboxId: string;
  templateId?: string;
  name?: string;
  metadata: Record<string, string>;
  startedAt?: string;
  endAt?: string;
  state?: string;
  cpuCount?: number;
  memoryMB?: number;
};

export type SandboxCommandRequest = {
  command: string;
  background?: boolean;
  cwd?: string;
  envs?: Record<string, string>;
  timeoutMs?: number;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
};

export type SandboxFileWriteRequest = {
  path: string;
  content: string;
};

export type SandboxFileWriteManyRequest = {
  files: Array<{ path: string; content: string }>;
};
