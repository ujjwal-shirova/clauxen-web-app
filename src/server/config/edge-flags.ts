import { cloudflareContext } from "@/server/cloudflare/context";

export type ClauxenEdgeFlags = {
  /** Kill switch for all chat generation. */
  maintenanceMode?: boolean;
  /** Preferred upstream model slug override. */
  modelOverride?: string;
  /** Disable agent tools globally. */
  disableTools?: boolean;
  /** Provider failover hint (opaque string for generate routing). */
  providerFailover?: string;
};

const DEFAULT_FLAGS: ClauxenEdgeFlags = {
  maintenanceMode: false,
  disableTools: false,
};

/**
 * Feature flags from the Cloudflare application configuration namespace.
 * Returns defaults when bindings are absent (local Next development).
 */
export async function readEdgeFlags(): Promise<ClauxenEdgeFlags> {
  try {
    const flags =
      await cloudflareContext()?.env.APP_CONFIG_KV.get<ClauxenEdgeFlags>(
        "feature-flags",
        "json",
      );
    const { maintenanceMode, modelOverride, disableTools, providerFailover } =
      flags ?? DEFAULT_FLAGS;
    return {
      maintenanceMode: Boolean(maintenanceMode),
      modelOverride:
        typeof modelOverride === "string" && modelOverride.trim()
          ? modelOverride.trim()
          : undefined,
      disableTools: Boolean(disableTools),
      providerFailover:
        typeof providerFailover === "string" && providerFailover.trim()
          ? providerFailover.trim()
          : undefined,
    };
  } catch (error) {
    console.warn("[edge-config] read failed; using defaults", error);
    return { ...DEFAULT_FLAGS };
  }
}
