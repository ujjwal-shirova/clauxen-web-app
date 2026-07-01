// =============================================================================
// Route: GET /api/v1/research/runs/[id] — single parallel research run detail
// Auth: requireAuth — session mandatory; run id + user_id composite lookup
// Response: { run } — status, objective, result/error JSON, timestamps
// =============================================================================

import { withApiRouteParams } from "@/backend/http/route-params"; // dynamic [id] segment — research run UUID
import { jsonData } from "@/backend/http/api-response"; // success JSON envelope
import { requireSession } from "@/backend/auth/require-session"; // authenticated user id for owner scope
import * as researchRepo from "@/backend/repositories/research.repository"; // getResearchRun — research_runs table
import { AppError, notFound } from "@/backend/db/errors"; // 400 malformed id; 404 when run missing or wrong owner

// UUID shape — invalid ids fail fast with 400 instead of database_error 500
const RESEARCH_RUN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs"; // Postgres query — Node runtime
export const dynamic = "force-dynamic"; // run status/result live update — cache off

export const GET = withApiRouteParams<{ id: string }>(
  async ({ session, params }) => {
    // session required — anonymous run detail access forbidden
    const user = requireSession(session);
    if (!RESEARCH_RUN_ID_RE.test(params.id)) {
      throw new AppError("Invalid research run id.", 400, "bad_request");
    }
    // getResearchRun — where id=$1 and user_id=$2; cross-user id guess → null
    const run = await researchRepo.getResearchRun(params.id, user.id);
    if (!run) throw notFound("Research run not found.");
    return jsonData({ run });
  },
  { requireAuth: true },
);
