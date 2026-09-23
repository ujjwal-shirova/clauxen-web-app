import type { RecentChat } from "@/lib/types";

export type ChatGroupBy = "none" | "date";

export type ChatGroup = {
  label: string;
  chats: RecentChat[];
};

function resolveUpdatedAt(chat: RecentChat): number {
  if (chat.updatedAt != null) return chat.updatedAt;
  const match = /^chat_(\d+)$/.exec(chat.id);
  if (match) return Number(match[1]);
  return 0;
}

function dateGroupLabel(timestamp: number): string {
  if (!timestamp) return "Older";
  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;

  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfYesterday) return "Yesterday";
  if (timestamp >= startOfWeek) return "Previous 7 days";
  return "Older";
}

export function groupChats(
  chats: RecentChat[],
  groupBy: ChatGroupBy,
): ChatGroup[] {
  if (groupBy === "none" || chats.length === 0) {
    return [{ label: "", chats }];
  }

  const buckets = new Map<string, RecentChat[]>();
  const order = ["Today", "Yesterday", "Previous 7 days", "Older"];

  for (const chat of chats) {
    const label = dateGroupLabel(resolveUpdatedAt(chat));
    const bucket = buckets.get(label) ?? [];
    bucket.push(chat);
    buckets.set(label, bucket);
  }

  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, chats: buckets.get(label)! }));
}
