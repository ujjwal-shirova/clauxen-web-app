import { query, queryOne } from "@/server/db/pool";

export type UserSkillRow = {
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

const LIST_LIMIT = 100;

export async function listUserSkills(userId: string) {
  return query<UserSkillRow>(
    `select id, user_id, name, description, storage_bucket, storage_prefix,
            source_format, primary_object_key, status, created_at, updated_at
     from public.user_skills
     where user_id = $1 and status = 'active'
     order by updated_at desc
     limit $2`,
    [userId, LIST_LIMIT],
  );
}

export async function getUserSkill(userId: string, skillId: string) {
  return queryOne<UserSkillRow>(
    `select id, user_id, name, description, storage_bucket, storage_prefix,
            source_format, primary_object_key, status, created_at, updated_at
     from public.user_skills
     where id = $1 and user_id = $2 and status = 'active'`,
    [skillId, userId],
  );
}

export async function createUserSkill(input: {
  userId: string;
  name: string;
  description: string;
  storageBucket: string;
  storagePrefix: string;
  sourceFormat: string;
  primaryObjectKey: string;
}) {
  return queryOne<UserSkillRow>(
    `insert into public.user_skills (
       user_id, name, description, storage_bucket, storage_prefix,
       source_format, primary_object_key, status
     ) values ($1, $2, $3, $4, $5, $6, $7, 'active')
     returning id, user_id, name, description, storage_bucket, storage_prefix,
               source_format, primary_object_key, status, created_at, updated_at`,
    [
      input.userId,
      input.name.slice(0, 200),
      input.description.slice(0, 10_000),
      input.storageBucket,
      input.storagePrefix,
      input.sourceFormat,
      input.primaryObjectKey,
    ],
  );
}

export async function softDeleteUserSkill(userId: string, skillId: string) {
  return queryOne<{
    id: string;
    storage_bucket: string;
    storage_prefix: string;
    primary_object_key: string | null;
  }>(
    `update public.user_skills
     set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id, storage_bucket, storage_prefix, primary_object_key`,
    [skillId, userId],
  );
}
