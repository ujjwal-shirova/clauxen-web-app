import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { query } from "@/server/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const projects = await query<{
      id: string;
      name: string;
      description: string | null;
      updated_at: string;
    }>(
      `select id, name, description, updated_at
       from public.projects
       where user_id = $1 and status = 'active'
       order by updated_at desc
       limit 50`,
      [user.id],
    ).catch(() => []);
    return jsonData({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        updatedAt: project.updated_at,
      })),
    });
  },
  { requireAuth: true },
);
