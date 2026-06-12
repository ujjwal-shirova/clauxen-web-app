// tables: instruction_profiles, connector_installations, user_memories
// =============================================================================

import { query, queryOne } from "@/backend/db/pool";

const INSTRUCTION_PROFILE_LIST_LIMIT = 100;
const CONNECTOR_LIST_LIMIT = 100;
const SKILL_TITLE_MAX_LENGTH = 128;
const SKILL_FIELD_MAX_LENGTH = 50_000;

export async function listInstructionProfiles(userId: string) {
  return query<{
    id: string;
    title: string;
    instructions: string; // system prompt / skill text body
    is_default: boolean;
    created_at: string;
  }>(
    `select id, title, instructions, is_default, created_at
     from public.instruction_profiles
     where user_id = $1 and status = 'active'
     order by is_default desc, created_at desc
     limit $2`, // archived profiles exclude
    [userId, INSTRUCTION_PROFILE_LIST_LIMIT],
  );
}

export async function listConnectorInstallations(userId: string) {
  return query<{
    id: string;
    connector_id: string; // catalog connector slug/id
    status: string;
    created_at: string;
  }>(
    `select id, connector_id, status, created_at
     from public.connector_installations
     where user_id = $1 and status = 'active'
     order by created_at desc
     limit $2`,
    [userId, CONNECTOR_LIST_LIMIT],
  );
}

// long-term user memories — active only, max 100 rows recent-first
export async function listMemories(userId: string) {
  return query<{ id: string; summary: string; created_at: string }>(
    `select id, summary, created_at from public.user_memories
     where user_id = $1 and status = 'active' order by created_at desc limit 100`,
    [userId],
  );
}

export async function upsertInstructionProfile(input: {
  userId: string;
  id?: string;
  title: string;
  instructions: string;
}) {
  const title = input.title.slice(0, SKILL_TITLE_MAX_LENGTH);
  const instructions = input.instructions.slice(0, SKILL_FIELD_MAX_LENGTH);

  if (input.id) {
    // existing row patch — owner user_id match mandatory
    return queryOne<{ id: string }>(
      `update public.instruction_profiles
       set title = $3, instructions = $4, updated_at = now()
       where id = $1 and user_id = $2
       returning id`,
      [input.id, input.userId, title, instructions],
    );
  }

  return queryOne<{ id: string }>(
    `insert into public.instruction_profiles (user_id, title, instructions)
     values ($1, $2, $3) returning id`,
    [input.userId, title, instructions],
  );
}
