import { AppError } from "@/server/db/errors";
import { query, queryOne } from "@/server/db/pool";
import * as profileRepo from "@/server/repositories/profile.repository";
import * as settingsRepo from "@/server/repositories/settings.repository";
import * as avatarService from "@/server/services/avatar.service";
import {
  resolveAuthAvatarUrl,
  resolveAuthFullName,
  trimProfileName,
} from "@/lib/profile-names";
import { resolveClientAvatarUrl } from "@/lib/avatar-url";

const AVATAR_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function getProfileForUser(userId: string) {
  return profileRepo.getProfile(userId);
}

export function toClientAvatarUrl(
  row: Awaited<ReturnType<typeof profileRepo.getProfile>>,
) {
  if (!row) return null;
  return resolveClientAvatarUrl({
    userId: row.id,
    avatarFileId: row.avatar_file_id,
    avatarStoragePath: row.avatar_storage_path,
    avatarUrl: row.avatar_url,
    avatarUpdatedAt: row.avatar_updated_at,
  });
}

export async function syncProfileFromAuth(input: {
  userId: string;
  email?: string | null;
  authMetadata?: Record<string, unknown> | null;
}) {
  const authFullName = resolveAuthFullName(input.authMetadata);
  const authAvatar = resolveAuthAvatarUrl(input.authMetadata);
  const existing = await profileRepo.getProfile(input.userId);
  const emailLocal = input.email?.split("@")[0] || "User";

  let displayName = existing?.display_name?.trim() || null;
  if (!displayName || displayName === emailLocal) {
    displayName = authFullName ?? displayName ?? emailLocal;
  }

  const needsAvatar = Boolean(authAvatar && !existing?.avatar_url);
  const displayUnchanged =
    (existing?.display_name?.trim() || null) === (displayName?.trim() || null);

  // Skip no-op UPDATEs — they used to echo through Realtime on every app open.
  if (existing && displayUnchanged && !needsAvatar) {
    if (authFullName) {
      await mirrorPersonalizationNames(input.userId, {
        fullName: authFullName,
      });
    }
    return existing;
  }

  const row = await profileRepo.updateProfile(input.userId, {
    displayName,
    ...(needsAvatar ? { avatarUrl: authAvatar } : {}),
  });

  if (authFullName) {
    await mirrorPersonalizationNames(input.userId, {
      fullName: authFullName,
    });
  }

  return row;
}

export async function updateUserProfile(
  userId: string,
  input: {
    fullName?: string;
    preferredName?: string;
    occupation?: string;
    avatarFileId?: string;
    username?: string;
    avatarShape?: string;
    showUsageStatistics?: boolean;
    showActivityGraph?: boolean;
    showTopPlugins?: boolean;
    showInsights?: boolean;
  },
) {
  const fullName = trimProfileName(input.fullName);
  const preferredName = trimProfileName(input.preferredName);
  const occupation = trimProfileName(input.occupation);
  const username = input.username?.trim().toLowerCase();
  if (username !== undefined && !/^[a-z0-9_]{3,32}$/.test(username)) {
    throw new AppError(
      "Use 3–32 letters, numbers, or underscores for your username.",
      400,
      "invalid_username",
    );
  }
  const avatarShapes = new Set([
    "circle",
    "squircle",
    "rounded",
    "oval",
    "scallop",
  ]);
  if (input.avatarShape !== undefined && !avatarShapes.has(input.avatarShape)) {
    throw new AppError(
      "Choose a supported profile photo shape.",
      400,
      "invalid_avatar_shape",
    );
  }

  if (input.avatarFileId) {
    await avatarService.attachUploadedAvatar(userId, input.avatarFileId);
  }

  if (
    fullName !== null ||
    preferredName !== null ||
    username !== undefined ||
    input.avatarShape !== undefined ||
    input.showUsageStatistics !== undefined ||
    input.showActivityGraph !== undefined ||
    input.showTopPlugins !== undefined ||
    input.showInsights !== undefined
  ) {
    try {
      await profileRepo.updateProfile(userId, {
        ...(fullName !== null ? { displayName: fullName } : {}),
        ...(preferredName !== null ? { preferredName } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(input.avatarShape !== undefined
          ? { avatarShape: input.avatarShape }
          : {}),
        ...(input.showUsageStatistics !== undefined
          ? { showUsageStatistics: input.showUsageStatistics }
          : {}),
        ...(input.showActivityGraph !== undefined
          ? { showActivityGraph: input.showActivityGraph }
          : {}),
        ...(input.showTopPlugins !== undefined
          ? { showTopPlugins: input.showTopPlugins }
          : {}),
        ...(input.showInsights !== undefined
          ? { showInsights: input.showInsights }
          : {}),
      });
    } catch (error) {
      if (
        username !== undefined &&
        error instanceof AppError &&
        error.code === "conflict"
      ) {
        throw new AppError(
          "That username is already in use.",
          409,
          "username_taken",
        );
      }
      throw error;
    }
  }

  await mirrorPersonalizationNames(userId, {
    ...(fullName !== null ? { fullName } : {}),
    ...(preferredName !== null ? { nickname: preferredName } : {}),
    ...(input.occupation !== undefined ? { occupation: occupation ?? "" } : {}),
  });

  if (fullName) {
    await query(
      `update public.user_settings
       set display_name = $2, updated_at = now()
       where user_id = $1`,
      [userId, fullName],
    );
  }

  if (preferredName) {
    await query(
      `update auth.users
       set raw_user_meta_data =
             coalesce(raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('preferred_name', $2::text),
           updated_at = now()
       where id = $1`,
      [userId, preferredName],
    );
  }

  return profileRepo.getProfile(userId);
}

export async function getPublicProfile(username: string) {
  const row = await profileRepo.getPublicProfileByUsername(username);
  if (!row) return null;

  const [usage, longestStreak, longestTask, plugins, myClauxen] =
    await Promise.all([
      queryOne<{ lifetime_tokens: string; peak_tokens: string }>(
        `select
         (select coalesce(sum(amount), 0)::text from public.token_transactions where user_id = $1 and type = 'debit') as lifetime_tokens,
         (select coalesce(max(day_total), 0)::text from (
           select sum(amount) as day_total from public.token_transactions
           where user_id = $1 and type = 'debit' group by created_at::date
         ) daily) as peak_tokens`,
        [row.id],
      ),
      queryOne<{ days: string; current_days: string }>(
        `with anchor as (
           select case when exists (
             select 1 from public.user_activity_days
             where user_id = $1 and activity_date = $2::date and message_count > 0
           ) then $2::date else $2::date - 1 end as day
         ), runs as (
           select activity_date,
             activity_date - (row_number() over (order by activity_date))::int as grp
           from public.user_activity_days where user_id = $1 and message_count > 0
         ), streaks as (
           select count(*) as days, max(activity_date) as last_day
           from runs group by grp
         )
         select coalesce(max(days), 0)::text as days,
           coalesce(max(days) filter (where last_day = (select day from anchor)), 0)::text as current_days
         from streaks`,
        [row.id, new Date().toISOString().slice(0, 10)],
      ),
      queryOne<{ seconds: string | null }>(
        `select coalesce(max(extract(epoch from (bounds.last_at - bounds.first_at))), 0)::text as seconds
       from (
         select min(created_at) as first_at, max(created_at) as last_at
         from public.chat_messages m
         join public.chats c on c.id = m.chat_id
         where c.user_id = $1 and m.user_id = $1 and m.role = 'user'
         group by m.chat_id
       ) bounds`,
        [row.id],
      ),
      query<{
        plugin_id: string;
        plugin_name: string;
        plugin_icon_url: string | null;
        last_used_at: string | null;
      }>(
        `select plugin_id, plugin_name, plugin_icon_url, last_used_at
         from (
           select distinct on (plugin_id) plugin_id, plugin_name, plugin_icon_url, last_used_at
           from public.plugin_connections where user_id = $1 and status = 'active'
           order by plugin_id, last_used_at desc nulls last
         ) active_plugins
         order by last_used_at desc nulls last, plugin_name
         limit 5`,
        [row.id],
      ),
      import("@/server/services/my-clauxen.service").then((m) =>
        m.getMyClauxen(row.id),
      ),
    ]);

  return {
    username: row.username,
    displayName:
      row.preferred_name?.trim() || row.display_name?.trim() || "User",
    avatarUrl: toClientAvatarUrl(row),
    avatarShape: row.avatar_shape,
    visibility: {
      usageStatistics: row.show_usage_statistics,
      activityGraph: row.show_activity_graph,
      topPlugins: row.show_top_plugins,
      insights: row.show_insights,
    },
    ...(row.show_usage_statistics
      ? {
          usage: {
            lifetimeTokens: Number(usage?.lifetime_tokens ?? 0),
            peakTokens: Number(usage?.peak_tokens ?? 0),
            longestTaskSeconds: Number(longestTask?.seconds ?? 0),
            longestStreakDays: Number(longestStreak?.days ?? 0),
            currentStreakDays: Number(longestStreak?.current_days ?? 0),
          },
        }
      : {}),
    ...(row.show_activity_graph ? { activity: myClauxen.heatmap } : {}),
    ...(row.show_top_plugins
      ? {
          plugins: plugins.map((plugin) => ({
            id: plugin.plugin_id,
            name: plugin.plugin_name,
            iconUrl: plugin.plugin_icon_url,
          })),
        }
      : {}),
    ...(row.show_insights
      ? {
          insights: {
            messages: myClauxen.messageCount,
            chats: myClauxen.chatCount,
            skills: Number(
              (
                await queryOne<{ count: string }>(
                  "select count(*)::text as count from public.user_skills where user_id = $1",
                  [row.id],
                )
              )?.count ?? 0,
            ),
          },
        }
      : {}),
  };
}

export function assertAvatarMime(mimeType: string | null | undefined) {
  const mime = (mimeType ?? "").toLowerCase();
  if (!AVATAR_MIMES.has(mime)) {
    throw new AppError(
      "Avatar must be PNG, JPEG, WebP, or GIF.",
      400,
      "invalid_avatar_type",
    );
  }
}

async function mirrorPersonalizationNames(
  userId: string,
  patch: {
    fullName?: string | null;
    nickname?: string | null;
    occupation?: string | null;
  },
) {
  const current = await settingsRepo.getUserSettings(userId);
  const settings = (current?.settings ?? {}) as Record<string, unknown>;
  const personalization = {
    ...((settings.personalization as Record<string, unknown>) ?? {}),
  };

  if (patch.fullName != null) personalization.fullName = patch.fullName;
  if (patch.nickname != null) personalization.nickname = patch.nickname;
  if (patch.occupation !== undefined) {
    personalization.occupation = patch.occupation ?? "";
  }

  await settingsRepo.updateUserSettings(userId, {
    settings: { ...settings, personalization },
  });
}
