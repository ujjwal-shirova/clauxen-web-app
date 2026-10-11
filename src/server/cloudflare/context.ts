import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Bindings are request-scoped; never retain this context in a module global. */
export function cloudflareContext() {
  try {
    return getCloudflareContext();
  } catch {
    return null;
  }
}
