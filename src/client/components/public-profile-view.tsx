"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Pencil, X } from "@/components/ui/bootstrap-icon";
import { sessionFetch } from "@/lib/api/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppLayout } from "@/components/app-layout-context";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { useToast } from "@/hooks/use-toast";
import { UserAvatarDisplay } from "@/components/settings/profile-avatar-upload";
import { ProfileAvatarUpload } from "@/components/settings/profile-avatar-upload";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/profile-names";

type Shape = "circle" | "squircle" | "rounded" | "oval" | "scallop";
type Visibility = {
  usageStatistics: boolean;
  activityGraph: boolean;
  insights: boolean;
};
type Profile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarShape: Shape;
  visibility: Visibility;
  usage?: {
    lifetimeTokens: number;
    peakTokens: number;
    longestTaskSeconds: number;
    longestStreakDays: number;
    currentStreakDays: number;
  };
  activity?: { date: string; count: number }[];
  insights?: { messages: number; chats: number; skills: number };
};

const shapes: { id: Shape; label: string; className: string }[] = [
  { id: "circle", label: "Circle", className: "rounded-full" },
  { id: "squircle", label: "Squircle", className: "rounded-[34%]" },
  { id: "rounded", label: "Rounded square", className: "rounded-[22%]" },
  { id: "oval", label: "Oval", className: "rounded-[42%/32%]" },
  { id: "scallop", label: "Scallop", className: "profile-avatar-scallop" },
];

function compact(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function duration(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function Heatmap({ activity }: { activity: NonNullable<Profile["activity"]> }) {
  const days = useMemo(() => {
    const byDate = new Map(activity.map((day) => [day.date, day.count]));
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 370);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const out: { date: string; count: number }[] = [];
    for (
      const cursor = new Date(start);
      cursor <= end;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      out.push({ date, count: byDate.get(date) ?? 0 });
    }
    return out;
  }, [activity]);
  const monthLabels = useMemo(() => {
    const labels: { month: string; column: number }[] = [];
    days.forEach((day, index) => {
      const date = new Date(`${day.date}T00:00:00Z`);
      if (date.getUTCDate() < 8)
        labels.push({
          month: date.toLocaleString(undefined, {
            month: "short",
            timeZone: "UTC",
          }),
          column: Math.floor(index / 7),
        });
    });
    return labels;
  }, [days]);
  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="min-w-[620px]">
        <div
          className="mb-2 grid h-4"
          style={{
            gridTemplateColumns: `repeat(${Math.ceil(days.length / 7)}, 1fr)`,
          }}
        >
          {monthLabels.map((item, index) => (
            <span
              key={`${item.month}-${index}`}
              className="text-[10px] text-[var(--ui-fg-muted)]"
              style={{ gridColumn: `${item.column + 1} / span 4` }}
            >
              {item.month}
            </span>
          ))}
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[3px]"
          aria-label="Daily activity over the past year"
        >
          {days.map(({ date, count }) => (
            <span
              key={date}
              title={`${date}: ${count} messages`}
              className={cn(
                "size-[10px] rounded-[3px]",
                count === 0
                  ? "bg-[var(--ui-hover-wash)]"
                  : count < 5
                    ? "bg-sky-200"
                    : count < 15
                      ? "bg-sky-400"
                      : count < 35
                        ? "bg-blue-600"
                        : "bg-blue-800",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
        checked ? "bg-zinc-700" : "bg-zinc-200",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function PublicProfileView({ username }: { username: string }) {
  const router = useRouter();
  const auth = useAuth();
  const { openMobileNav } = useAppLayout();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftShape, setDraftShape] = useState<Shape>("circle");
  const [draftVisibility, setDraftVisibility] = useState<Visibility>({
    usageStatistics: true,
    activityGraph: true,
    insights: true,
  });
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/public-profiles/${encodeURIComponent(username)}`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as {
        data?: { profile?: Profile | null };
      };
      if (!response.ok || !json.data?.profile)
        throw new Error("This profile could not be found.");
      setProfile(json.data.profile);
      if (auth.user?.id) {
        try {
          const ownResponse = await sessionFetch("/api/v1/profile", {
            credentials: "include",
            cache: "no-store",
          });
          if (ownResponse.ok) {
            const ownJson = (await ownResponse.json()) as {
              data?: {
                profile?: {
                  id?: string;
                  username?: string;
                  avatarShape?: Shape;
                  visibility?: Visibility;
                };
              };
            };
            const own = ownJson.data?.profile;
            setIsOwner(Boolean(own?.id && own.id === auth.user.id));
            if (own?.id === auth.user.id) {
              setDraftUsername(own.username ?? username);
              setDraftShape(own.avatarShape ?? "circle");
              setDraftVisibility(
                own.visibility ?? {
                  usageStatistics: true,
                  activityGraph: true,
                  insights: true,
                },
              );
            }
          } else {
            setIsOwner(false);
          }
        } catch {
          setIsOwner(false);
        }
      } else setIsOwner(false);
    } catch (error) {
      setProfile(null);
      toast({
        title: "Profile unavailable",
        description:
          error instanceof Error ? error.message : "Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id, toast, username]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await sessionFetch("/api/v1/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: draftUsername,
          avatarShape: draftShape,
          showUsageStatistics: draftVisibility.usageStatistics,
          showActivityGraph: draftVisibility.activityGraph,
          showInsights: draftVisibility.insights,
        }),
      });
      const json = (await response.json()) as {
        data?: { profile?: { username: string } };
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(json.error?.message || "Could not save your profile.");
      setEditing(false);
      toast({ title: "Profile updated" });
      const nextUsername = json.data?.profile?.username;
      if (nextUsername && nextUsername !== username)
        router.replace(`/u/${nextUsername}`);
      else await load();
    } catch (error) {
      toast({
        title: "Could not save profile",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const section = (
    title: string,
    visible: boolean,
    children: React.ReactNode,
  ) =>
    visible ? (
      <section className="mt-7">
        <h2 className="mb-3 text-[14px] font-medium text-[var(--ui-fg)]">
          {title}
        </h2>
        {children}
      </section>
    ) : null;

  return (
    <div className="flex h-full min-h-0 w-full bg-[var(--app-panel-bg,var(--app-frame-bg))] text-[var(--ui-fg)]">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-3 sm:hidden">
          <MobileMenuButton onClick={openMobileNav} />
          <span className="truncate text-[14px] font-medium">
            {profile?.displayName ?? "Profile"}
          </span>
        </div>
        {loading && !profile ? (
          <div className="flex h-full items-center justify-center text-[var(--ui-fg-muted)]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !profile ? (
          <div className="mx-auto flex max-w-xl flex-col items-center px-6 pt-24 text-center">
            <h1 className="text-xl font-semibold">Profile not found</h1>
            <p className="mt-2 text-sm text-[var(--ui-fg-muted)]">
              Check the username and try again.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium"
            >
              <ChevronLeft className="size-4" />
              Go back
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[760px] px-5 pb-12 pt-8 sm:px-8 sm:pt-10">
            <header className="relative flex flex-col items-center pb-5 text-center">
              {isOwner && (
                <button
                  onClick={() => setEditing(true)}
                  className="absolute right-0 top-0 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--ui-border)] px-3 text-[12px] font-medium hover:bg-[var(--ui-hover-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
                >
                  <Pencil className="size-3.5" />
                  Edit profile
                </button>
              )}
              <UserAvatarDisplay
                name={profile.displayName}
                avatarUrl={profile.avatarUrl}
                className={cn(
                  "!h-[84px] !w-[84px] bg-pink-500 text-white text-[25px] font-normal",
                  shapes.find((shape) => shape.id === profile.avatarShape)
                    ?.className,
                )}
                size="lg"
              />
              <h1 className="mt-3 text-[22px] font-medium tracking-[-0.02em]">
                {profile.displayName}
              </h1>
              <p className="mt-0.5 text-[13px] text-[var(--ui-fg-muted)]">
                @{profile.username}
              </p>
            </header>

            {section(
              "Usage statistics",
              profile.visibility.usageStatistics,
              <div className="grid grid-cols-2 divide-x divide-[var(--ui-border)] rounded-2xl border border-[var(--ui-border)] px-2 py-3 sm:grid-cols-5">
                {[
                  [
                    compact(profile.usage?.lifetimeTokens ?? 0),
                    "Lifetime tokens",
                  ],
                  [
                    compact(profile.usage?.peakTokens ?? 0),
                    "Peak tokens / day",
                  ],
                  [
                    duration(profile.usage?.longestTaskSeconds ?? 0),
                    "Longest conversation",
                  ],
                  [
                    `${profile.usage?.longestStreakDays ?? 0} days`,
                    "Longest streak",
                  ],
                  [
                    `${profile.usage?.currentStreakDays ?? 0} days`,
                    "Current streak",
                  ],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center px-2 py-1 text-center"
                  >
                    <span className="text-[13px] font-medium tabular-nums">
                      {value}
                    </span>
                    <span className="mt-0.5 text-[11px] text-[var(--ui-fg-muted)]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>,
            )}

            {section(
              "Showcase",
              true,
              <div className="flex min-h-[142px] flex-col items-center justify-center rounded-2xl bg-[var(--ui-hover-wash)] px-5 text-center">
                <p className="text-[13px] text-[var(--ui-fg-muted)]">
                  No showcase links yet
                </p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => router.push("/upgrade")}
                    className="mt-3 rounded-full border border-[var(--ui-border)] px-3.5 py-1.5 text-[12px] font-medium hover:bg-[var(--app-panel-bg,var(--app-frame-bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
                  >
                    Upgrade to edit your showcase
                  </button>
                )}
              </div>,
            )}

            {section(
              "Activity",
              profile.visibility.activityGraph,
              <div className="rounded-xl border border-[var(--ui-border)] p-3">
                <Heatmap activity={profile.activity ?? []} />
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-[var(--ui-fg-muted)]">
                  <span>Less</span>
                  {[
                    "bg-[var(--ui-hover-wash)]",
                    "bg-sky-200",
                    "bg-sky-400",
                    "bg-blue-600",
                    "bg-blue-800",
                  ].map((c, i) => (
                    <span key={i} className={cn("size-2.5 rounded-[3px]", c)} />
                  ))}
                  <span>More</span>
                </div>
              </div>,
            )}

            {section(
              "Insights",
              profile.visibility.insights,
              <dl className="space-y-2 text-[12px]">
                {[
                  ["Messages sent", compact(profile.insights?.messages ?? 0)],
                  ["Chats started", compact(profile.insights?.chats ?? 0)],
                  ["Skills explored", compact(profile.insights?.skills ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-[var(--ui-fg-muted)]">{label}</dt>
                    <dd className="tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>,
            )}
          </div>
        )}
      </main>

      {editing && profile && (
        <>
          <button
            aria-label="Close profile editor"
            className="fixed inset-0 z-[70] bg-black/20 lg:hidden"
            onClick={() => setEditing(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-[390px] flex-col border-l border-[var(--ui-border)] bg-[var(--app-panel-bg,var(--app-frame-bg))] shadow-2xl lg:static lg:z-auto lg:h-full lg:shrink-0 lg:shadow-none">
            <div className="flex h-[62px] shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-5">
              <h2 className="text-[17px] font-medium">Edit profile</h2>
              <div className="flex items-center gap-2">
                <button
                  disabled={saving}
                  onClick={() => setEditing(false)}
                  className="rounded-full px-3 py-2 text-[13px] text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  onClick={() => void save()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ui-fg)] px-4 text-[13px] font-medium text-[var(--app-panel-bg,var(--app-frame-bg))] disabled:opacity-60"
                >
                  {saving && <Loader2 className="size-3.5 animate-spin" />}Save
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
              <section className="border-b border-[var(--ui-border)] py-5">
                <label
                  htmlFor="profile-username"
                  className="mb-2 block text-[13px] font-medium"
                >
                  Username
                </label>
                <div className="flex items-center rounded-xl border border-[var(--ui-border)] px-3">
                  <span className="text-sm text-[var(--ui-fg-muted)]">@</span>
                  <input
                    id="profile-username"
                    value={draftUsername}
                    onChange={(event) =>
                      setDraftUsername(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "")
                          .slice(0, 32),
                      )
                    }
                    className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
                    autoComplete="off"
                  />
                  <span className="text-[10px] text-[var(--ui-fg-subtle)]">
                    /u/{draftUsername || "username"}
                  </span>
                </div>
              </section>
              <section className="py-5">
                <h3 className="mb-3 text-[14px] font-medium">Photo</h3>
                <div className="rounded-2xl border border-[var(--ui-border)] p-3">
                  <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-3">
                    <span className="text-[13px]">Upload photo</span>
                    <ProfileAvatarUpload
                      name={profile.displayName}
                      avatarUrl={profile.avatarUrl}
                      size="md"
                      onUpdated={(next) =>
                        setProfile((current) =>
                          current
                            ? { ...current, avatarUrl: next.avatarUrl }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1 pt-3">
                    {shapes.map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        title={shape.label}
                        aria-label={`${shape.label} photo shape`}
                        aria-pressed={draftShape === shape.id}
                        onClick={() => setDraftShape(shape.id)}
                        className={cn(
                          "relative flex size-12 items-center justify-center bg-pink-500 text-[13px] text-white transition-transform",
                          shape.className,
                          draftShape === shape.id &&
                            "ring-2 ring-zinc-900 ring-offset-2 ring-offset-[var(--app-panel-bg,var(--app-frame-bg))]",
                        )}
                      >
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            className={cn(
                              "size-full object-cover",
                              shape.className,
                            )}
                          />
                        ) : (
                          initialsFromName(profile.displayName)
                        )}
                        {draftShape === shape.id && (
                          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-zinc-900 text-white">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
              <section className="pt-3">
                <h3 className="text-[14px] font-medium">What others see</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--ui-fg-muted)]">
                  Choose which parts of your profile are visible to others.
                </p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--ui-border)]">
                  {(
                    [
                      ["usageStatistics", "Show usage statistics"],
                      ["activityGraph", "Show activity graph"],
                      ["insights", "Show insights"],
                    ] as const
                  ).map(([key, label], index) => (
                    <div
                      key={key}
                      className={cn(
                        "flex min-h-[56px] items-center justify-between gap-3 px-4",
                        index > 0 && "border-t border-[var(--ui-border)]",
                      )}
                    >
                      <span className="text-[13px]">{label}</span>
                      <Toggle
                        label={label}
                        checked={draftVisibility[key]}
                        onChange={(value) =>
                          setDraftVisibility((current) => ({
                            ...current,
                            [key]: value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
              <p className="mt-4 text-[11px] leading-4 text-[var(--ui-fg-subtle)]">
                Your username is part of your public profile link. Changes are
                visible after you save.
              </p>
            </div>
            <button
              className="sr-only"
              aria-label="Close editor"
              onClick={() => setEditing(false)}
            >
              <X />
            </button>
          </aside>
        </>
      )}
    </div>
  );
}
