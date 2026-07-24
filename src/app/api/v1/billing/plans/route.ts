import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import * as billingRepo from "@/server/repositories/billing.repository"; // plans DB read

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const plans = await billingRepo.listPlans(); // saari subscription plans
  return jsonData({ plans }); // frontend billing UI ke liye
});
