import { env } from "@/backend/config/env";
import { parseUsdInrRate } from "@/lib/checkout-currency";

export function getServerUsdInrRate(): number {
  return parseUsdInrRate(env.checkoutUsdInrRate);
}
