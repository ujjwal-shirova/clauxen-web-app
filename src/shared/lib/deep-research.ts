export type DeepResearchPlan = {
  title: string;
  tasks: string[];
  summary: string;
};

export const DEEP_RESEARCH_PREFIX = "[Deep research]\n";

/** Strictly validate model output before rendering an interactive plan. */
export function parseDeepResearchPlan(
  content: string,
): DeepResearchPlan | null {
  const match = /```research-plan\s*\n([\s\S]*?)\n```/.exec(content);
  if (!match || match[1].length > 20_000) return null;
  try {
    const value = JSON.parse(match[1]);
    if (
      typeof value.title !== "string" ||
      !value.title.trim() ||
      value.title.length > 200 ||
      typeof value.summary !== "string" ||
      value.summary.length > 2000 ||
      !Array.isArray(value.tasks) ||
      value.tasks.length < 3 ||
      value.tasks.length > 8 ||
      !value.tasks.every(
        (task: unknown) =>
          typeof task === "string" && task.trim() && task.length <= 1000,
      )
    )
      return null;
    return {
      title: value.title.trim(),
      tasks: value.tasks.map((task: string) => task.trim()),
      summary: value.summary.trim(),
    };
  } catch {
    return null;
  }
}

export function researchActionPrefix(
  action: "start" | "cancel",
  planId: string,
) {
  return `[Deep research ${action}: ${planId}]\n`;
}

export function displayResearchMessage(content: string): string {
  const newline = content.indexOf("\n");
  if (newline < 0) return content;
  const marker = content.slice(0, newline);
  if (
    marker === "[Deep research]" ||
    ((marker.startsWith("[Deep research start: ") ||
      marker.startsWith("[Deep research cancel: ")) &&
      marker.endsWith("]"))
  ) {
    return content.slice(newline + 1);
  }
  return content;
}

/** Recover approved edits from the durable start message when history reloads. */
export function approvedResearchTasks(content: string): string[] | null {
  const start = content.indexOf("Approved research plan:\n");
  if (start < 0) return null;
  const lines = content
    .slice(start + "Approved research plan:\n".length)
    .split("\n");
  const tasks: string[] = [];
  for (const line of lines) {
    const match = /^\d+\. (.+)$/.exec(line);
    if (!match) break;
    tasks.push(match[1]);
  }
  return tasks.length >= 3 && tasks.length <= 8 ? tasks : null;
}
