import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as billingRepo from "@/backend/repositories/billing.repository";

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
