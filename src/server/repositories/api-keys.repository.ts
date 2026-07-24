import { createHash, randomBytes } from "crypto";
import { query, queryOne } from "@/server/db/pool";

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function resolveUserIdFromApiKey(
  rawKey: string,
): Promise<string | null> {
  if (!rawKey.startsWith("clx_")) return null;
  const keyHash = hashKey(rawKey);
  const row = await queryOne<{ user_id: string }>(
    `update public.api_keys
     set last_used_at = now()
     where key_hash = $1 and revoked_at is null
     returning user_id`,
    [keyHash],
  );
  return row?.user_id ?? null;
}

export async function listApiKeys(userId: string) {
  return query<{
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
  }>(
    `select id, name, key_prefix, created_at, last_used_at
     from public.api_keys
     where user_id = $1 and revoked_at is null
     order by created_at desc`,
    [userId],
  );
}

export async function createApiKey(userId: string, name: string) {
  const raw = `clx_${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 12);
  const keyHash = hashKey(raw);

  const row = await queryOne<{ id: string }>(
    `insert into public.api_keys (user_id, name, key_prefix, key_hash)
     values ($1, $2, $3, $4)
     returning id`,
    [userId, name, prefix, keyHash],
  );

  return { id: row?.id, key: raw, prefix };
}

export async function revokeApiKey(userId: string, keyId: string) {
  return queryOne<{ id: string }>(
    `update public.api_keys set revoked_at = now()
     where id = $1 and user_id = $2 and revoked_at is null
     returning id`,
    [keyId, userId],
  );
}
