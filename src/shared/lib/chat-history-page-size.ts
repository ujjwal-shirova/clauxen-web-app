import { DEFAULT_CLIENT_HYDRATE_LIMIT } from "@/lib/chat-hydrate-limits";

/**
 * First edge fetch window for open-chat hydrate.
 * Long threads continue via Worker keyset pages (Cache → KV → R2 → Hyperdrive).
 */
export const FULL_CHAT_HYDRATE_LIMIT = DEFAULT_CLIENT_HYDRATE_LIMIT;
