export const CLAUXEN_CODE_CLIENT_ID = "clauxen-code";

export const CLAUXEN_CODE_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "code:inference",
  "code:profile",
  // Legacy names still requested by the bundled CLI runtime
  "user:inference",
  "user:profile",
  "user:sessions:claude_code",
  "user:mcp_servers",
  "user:file_upload",
  "org:create_api_key",
] as const;

export type ClauxenCodeScope = (typeof CLAUXEN_CODE_SCOPES)[number];

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
export const AUTH_CODE_TTL_SECONDS = 60 * 10; // 10 minutes
export const DEVICE_CODE_TTL_SECONDS = 60 * 15; // 15 minutes
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

export const ACCESS_TOKEN_PREFIX = "cla_at_";
export const REFRESH_TOKEN_PREFIX = "cla_rt_";
export const AUTH_CODE_PREFIX = "cla_ac_";
export const DEVICE_CODE_PREFIX = "cla_dc_";
