import { randomUUID } from "crypto";
import { query, queryOne } from "@/backend/db/pool"; // parameterized SQL — CockroachDB pool
import { AppError } from "@/backend/db/errors"; // invalid identity / missing email errors
import {
  displayNameFromTraits,
  type KratosIdentity,
} from "@/backend/ory/kratos-client"; // Kratos traits → display name helper
import type { HydraUserInfo } from "@/backend/ory/hydra-client"; // OIDC userinfo claims type

export async function ensureUserRecord(input: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  // email normalize — lowercase + trim; duplicate account matching consistent
  const email = input.email.toLowerCase().trim();
  // display name fallback — explicit name, else local-part of email, else "User"
  const displayName =
    input.displayName?.trim() || email.split("@")[0] || "User";

  await query(
    `insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
     values ($1, $2, $3::jsonb, now(), now())
     on conflict (id) do update set
       email = excluded.email,
       updated_at = now()`,
    [input.userId, email, JSON.stringify({ display_name: displayName })],
  );

  // public.profiles — app-facing profile row; locale/timezone defaults
  await query(
    `insert into public.profiles (id, email, display_name, locale, timezone, metadata)
     values ($1, $2, $3, 'en', 'UTC', '{}'::jsonb)
     on conflict (id) do update set
       email = excluded.email,
       display_name = coalesce(excluded.display_name, public.profiles.display_name),
       updated_at = now()`,
    [input.userId, email, displayName],
  );

  await query(
    `insert into public.user_settings (user_id, email, settings)
     values ($1, $2, '{}'::jsonb)
     on conflict (user_id) do nothing`,
    [input.userId, email],
  );

  await query(
    `insert into public.user_balances (user_id)
     values ($1)
     on conflict (user_id) do nothing`,
    [input.userId],
  );

  // notification_preferences — email/push toggles; default empty row
  await query(
    `insert into public.notification_preferences (user_id)
     values ($1)
     on conflict (user_id) do nothing`,
    [input.userId],
  );

  let workspace = await queryOne<{ id: string }>(
    `select id from public.workspaces where owner_id = $1 order by created_at asc limit 1`,
    [input.userId],
  );

  if (!workspace) {
    workspace = await queryOne<{ id: string }>(
      `insert into public.workspaces (id, name, slug, owner_id)
       values ($1, $2, $3, $4)
       returning id`,
      [randomUUID(), `${displayName}'s workspace`, null, input.userId],
    );
  }

  // workspace membership — owner role active; duplicate join safe (on conflict do nothing)
  if (workspace?.id) {
    await query(
      `insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
       values ($1, $2, 'owner', 'active', now())
       on conflict (workspace_id, user_id) do nothing`,
      [workspace.id, input.userId],
    );

    await query(
      `update public.profiles
       set default_workspace_id = coalesce(default_workspace_id, $2), updated_at = now()
       where id = $1`,
      [input.userId, workspace.id],
    );
  }

  return { userId: input.userId, workspaceId: workspace?.id ?? null };
}

export async function findUserByEmail(email: string) {
  return queryOne<{
    id: string;
    email: string | null;
    display_name: string | null;
  }>(
    `select id, email, display_name from public.profiles where lower(email) = lower($1)`,
    [email],
  );
}

export async function registerDevUser(input: {
  email: string;
  displayName?: string;
  password?: string;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await findUserByEmail(email);
  const userId = existing?.id ?? randomUUID();

  await ensureUserRecord({
    userId,
    email,
    displayName: input.displayName ?? existing?.display_name,
  });

  if (input.password) {
    await query(
      `update public.user_settings
       set settings = settings || $2::jsonb, updated_at = now()
       where user_id = $1`,
      [userId, JSON.stringify({ dev_password: input.password })],
    );
  }

  return { userId, email };
}

export async function syncFromKratosIdentity(identity: KratosIdentity) {
  const email = identity.traits?.email?.toLowerCase().trim();
  if (!email) {
    throw new AppError(
      "Kratos identity is missing email.",
      400,
      "invalid_identity",
    );
  }

  return ensureUserRecord({
    userId: identity.id,
    email,
    displayName: displayNameFromTraits(identity.traits),
  });
}

export async function syncFromHydraUserInfo(userInfo: HydraUserInfo) {
  const userId = userInfo.sub;
  // OIDC sub — primary user id; missing subject invalid
  if (!userId) {
    throw new AppError("OIDC subject is missing.", 400, "invalid_subject");
  }

  const email = userInfo.email?.toLowerCase().trim();
  if (!email) {
    throw new AppError(
      "OIDC userinfo is missing email.",
      400,
      "invalid_userinfo",
    );
  }

  // display name priority — full name, given+family, else email local-part
  const displayName =
    userInfo.name?.trim() ||
    [userInfo.given_name, userInfo.family_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    email.split("@")[0];

  return ensureUserRecord({ userId, email, displayName });
}

export async function logSecurityEvent(
  userId: string,
  eventType: string,
  meta?: {
    ip?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await query(
    `insert into public.user_security_events (user_id, event_type, ip_address, user_agent, metadata)
     values ($1, $2, $3::inet, $4, $5::jsonb)`,
    [
      userId,
      eventType,
      meta?.ip ?? null,
      meta?.userAgent ?? null,
      JSON.stringify(meta?.metadata ?? {}),
    ],
  );
}

export async function verifyDevPassword(userId: string, password: string) {
  const row = await queryOne<{ settings: { dev_password?: string } }>(
    `select settings from public.user_settings where user_id = $1`,
    [userId],
  );
  const stored = row?.settings?.dev_password;
  // no dev_password configured — dev gate disabled for this user
  if (!stored) return true;
  return stored === password;
}
