import { randomUUID } from "crypto";
import { query, queryOne, withTransaction } from "@/backend/db/pool";
import { AppError } from "@/backend/db/errors"; // invalid identity / missing email errors
import { assertEmailNotDisposable } from "@/backend/email-verifier/disposable-email";

export async function ensureUserRecord(input: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  // email normalize — lowercase + trim; duplicate account matching consistent
  const email = input.email.toLowerCase().trim();
  assertEmailNotDisposable(email);
  // Only treat an explicit name as authoritative — never clobber onboarding
  // /settings display_name with the email local-part on every session hit.
  const explicitName = input.displayName?.trim() || null;
  const insertName = explicitName || email.split("@")[0] || "User";

  // Auth identities are owned by GoTrue / the Supabase Admin API. This
  // bootstrap must never write auth.users on every session or settings read:
  // it creates avoidable connection pressure and can conflict with Auth.
  return withTransaction(async (client) => {
    await client.query(
      `insert into public.profiles (id, email, display_name, locale, timezone, metadata)
       values ($1, $2, $3, 'en', 'UTC', '{}'::jsonb)
       on conflict (id) do update set
         email = excluded.email,
         display_name = case
           when $4::boolean then excluded.display_name
           else public.profiles.display_name
         end,
         updated_at = now()`,
      [input.userId, email, insertName, explicitName != null],
    );

    await client.query(
      `insert into public.user_settings (user_id, email, settings)
       values ($1, $2, '{}'::jsonb)
       on conflict (user_id) do nothing`,
      [input.userId, email],
    );

    await client.query(
      `insert into public.user_balances (user_id)
       values ($1)
       on conflict (user_id) do nothing`,
      [input.userId],
    );

    // Notification preferences are optional product state, but the default
    // row needs to exist before a settings PATCH can update it.
    await client.query(
      `insert into public.notification_preferences (user_id)
       values ($1)
       on conflict (user_id) do nothing`,
      [input.userId],
    );

    const existingWorkspace = await client.query<{ id: string }>(
      `select id
       from public.workspaces
       where owner_id = $1
       order by created_at asc
       limit 1`,
      [input.userId],
    );
    let workspaceId = existingWorkspace.rows[0]?.id ?? null;

    if (!workspaceId) {
      const createdWorkspace = await client.query<{ id: string }>(
        `insert into public.workspaces (id, name, slug, owner_id)
         values ($1, $2, $3, $4)
         returning id`,
        [randomUUID(), `${insertName}'s workspace`, null, input.userId],
      );
      workspaceId = createdWorkspace.rows[0]?.id ?? null;
    }

    if (workspaceId) {
      await client.query(
        `insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
         values ($1, $2, 'owner', 'active', now())
         on conflict (workspace_id, user_id) do nothing`,
        [workspaceId, input.userId],
      );

      await client.query(
        `update public.profiles
         set default_workspace_id = coalesce(default_workspace_id, $2), updated_at = now()
         where id = $1`,
        [input.userId, workspaceId],
      );
    }

    return { userId: input.userId, workspaceId };
  });
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
