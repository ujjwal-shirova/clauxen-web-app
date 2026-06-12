import { ApiError, apiFetch } from "@/frontend/lib/api/client";

const CONNECTOR_ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_SKILL_TITLE_LENGTH = 200;
const MAX_SKILL_INSTRUCTIONS_LENGTH = 32_000;

function parseConnectorId(connectorId: string): string {
  const id = connectorId.trim();
  if (!id || !CONNECTOR_ID_RE.test(id)) {
    throw new ApiError("Invalid connector id.", 400, "bad_request");
  }
  return id;
}

function parseSkillInput(input: {
  id?: string;
  title: string;
  instructions: string;
}) {
  const title = input.title.trim();
  if (!title) throw new ApiError("title is required.", 400, "bad_request");
  if (title.length > MAX_SKILL_TITLE_LENGTH) {
    throw new ApiError("title is too long.", 400, "bad_request");
  }
  if (input.instructions.length > MAX_SKILL_INSTRUCTIONS_LENGTH) {
    throw new ApiError("instructions are too long.", 400, "bad_request");
  }
  const id = input.id?.trim();
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new ApiError("Invalid skill id.", 400, "bad_request");
  }
  return { id, title, instructions: input.instructions };
}

export type ApiSkill = {
  id: string;
  title: string;
  instructions: string;
  is_default: boolean;
  created_at: string;
};

export type ApiConnector = {
  connectorId: string;
  status: string;
  connectedAt: string;
};

export async function listSkills() {
  return apiFetch<{ skills: ApiSkill[] }>("/api/v1/customize/skills");
}

export async function saveSkill(input: {
  id?: string;
  title: string;
  instructions: string;
}) {
  const payload = parseSkillInput(input);
  return apiFetch<{ skill: ApiSkill }>("/api/v1/customize/skills", {
    method: "POST",
    // JSON.stringify — request body serialize
    body: JSON.stringify(payload),
  });
}

export async function listConnectors() {
  return apiFetch<{ connectors: ApiConnector[] }>(
    "/api/v1/customize/connectors",
  );
}

export async function connectConnector(connectorId: string) {
  return apiFetch<{ connectors: ApiConnector[] }>(
    "/api/v1/customize/connectors",
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify({ connectorId }),
    },
  );
}

export async function disconnectConnector(connectorId: string) {
  const id = parseConnectorId(connectorId);
  return apiFetch<{ connectors: ApiConnector[] }>(
    "/api/v1/customize/connectors",
    {
      method: "POST",
      // JSON.stringify — request body serialize
      body: JSON.stringify({ connectorId: id, revoke: true }),
    },
  );
}
