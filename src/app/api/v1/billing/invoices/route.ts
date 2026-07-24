import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingRepo from "@/server/repositories/billing.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const invoices = await billingRepo.listInvoices(user.id);
    return jsonData({ invoices });
  },
  { requireAuth: true },
);
