import { get } from "@vercel/edge-config";

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
 * Sub-15ms feature flags / model kill-switch from Vercel Edge Config.
 * Returns defaults when EDGE_CONFIG is unset (local/dev).
 */
export async function readEdgeFlags(): Promise<ClauxenEdgeFlags> {
  if (!process.env.EDGE_CONFIG?.trim()) {
    return { ...DEFAULT_FLAGS };
  }
  try {
    const [
      maintenanceMode,
      modelOverride,
      disableTools,
      providerFailover,
    ] = await Promise.all([
      get<boolean>("maintenanceMode"),
      get<string>("modelOverride"),
      get<boolean>("disableTools"),
      get<string>("providerFailover"),
    ]);
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
