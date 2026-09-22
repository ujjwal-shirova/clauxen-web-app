import { ApiError, apiFetch } from "@/lib/api/client";

const MAX_SKILL_TITLE_LENGTH = 200;
const MAX_SKILL_INSTRUCTIONS_LENGTH = 32_000;

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

export type ApiFileSkill = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  storage_bucket: string;
  storage_prefix: string;
  source_format: string;
  primary_object_key: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function listSkills() {
  return apiFetch<{ skills: ApiSkill[]; fileSkills: ApiFileSkill[] }>(
    "/api/v1/customize/skills",
  );
}

export async function uploadSkillFile(input: {
  file: File;
  name?: string;
  description?: string;
}) {
  const formData = new FormData();
  formData.set("file", input.file);
  if (input.name) formData.set("name", input.name);
  if (input.description) formData.set("description", input.description);
  return apiFetch<{ skill: ApiFileSkill }>("/api/v1/customize/skills/upload", {
    method: "POST",
    body: formData,
  });
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
