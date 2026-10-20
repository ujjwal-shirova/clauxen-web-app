import { z } from "zod";
const segment = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
const filePath = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (p) =>
      !p.startsWith("/") &&
      !p.includes("\\") &&
      !p.split("/").some((s) => !s || s === "." || s === "..") &&
      !/^\.git(?:\/|$)/i.test(p),
    "Invalid repository path",
  );
export const repoSchema = z.object({ owner: segment, repo: segment });
export const changeSchema = repoSchema
  .extend({
    request_id: z.uuid(),
    base_branch: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_./-]+$/),
    expected_head_sha: z.string().regex(/^[0-9a-f]{40}$/),
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((s) => !s.includes("\n")),
    body: z.string().max(30000).default(""),
    files: z
      .array(z.object({ path: filePath, content: z.string().max(200000) }))
      .min(1)
      .max(30),
  })
  .superRefine((v, c) => {
    if (new Set(v.files.map((f) => f.path)).size !== v.files.length)
      c.addIssue({ code: "custom", message: "Duplicate file paths." });
    if (v.files.some((f) => f.path.startsWith(".github/workflows/")))
      c.addIssue({
        code: "custom",
        message: "Workflow editing is not granted to this app.",
      });
  });
export type ChangeInput = z.infer<typeof changeSchema>;
export function manifest(origin: string) {
  return {
    name: "Clauxen Agent",
    url: "https://www.clauxen.com",
    public: true,
    description:
      "Clauxen Agent connects your repositories to Clauxen on web and Android, creates attributed commits on new branches, and opens pull requests.",
    redirect_url: `${origin}/api/v1/github/manifest/callback`,
    callback_urls: [`${origin}/api/v1/github/oauth/callback`],
    setup_url: `${origin}/github`,
    setup_on_update: true,
    hook_attributes: { url: `${origin}/api/v1/github/webhook`, active: true },
    default_permissions: {
      contents: "write",
      pull_requests: "write",
      metadata: "read",
    },
    // Installation lifecycle webhooks are delivered automatically, not selectable subscriptions.
    default_events: [],
    request_oauth_on_install: false,
  };
}
