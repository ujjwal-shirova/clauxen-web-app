import { AsyncLocalStorage } from "node:async_hooks";

type Resource = { value: unknown; dispose: () => Promise<void> };
type Scope = { resources: Map<string, Resource>; closed: boolean };
const scopes = new AsyncLocalStorage<Scope>();

/** Share resources only inside one invocation, never between users/requests. */
export async function withRequestResources<T>(
  run: () => Promise<T>,
  defer?: (cleanup: Promise<void>) => void,
  isolated = false,
): Promise<T> {
  if (!isolated && scopes.getStore() && !scopes.getStore()?.closed)
    return run();
  const scope: Scope = { resources: new Map(), closed: false };
  return scopes.run(scope, async () => {
    try {
      return await run();
    } finally {
      scope.closed = true;
      const cleanup = Promise.allSettled(
        [...scope.resources.values()].map((resource) => resource.dispose()),
      ).then(() => undefined);
      if (defer) defer(cleanup);
      else await cleanup;
    }
  });
}

export function requestResource<T>(
  key: string,
  create: () => T,
  dispose: (resource: T) => Promise<void>,
): T | undefined {
  const scope = scopes.getStore();
  if (!scope || scope.closed) return undefined;
  let entry = scope.resources.get(key);
  if (!entry) {
    const value = create();
    entry = { value, dispose: () => dispose(value) };
    scope.resources.set(key, entry);
  }
  return entry.value as T;
}

export function ownsRequestResource(key: string, resource: unknown): boolean {
  return scopes.getStore()?.resources.get(key)?.value === resource;
}

export function forgetRequestResource(key: string, resource: unknown): void {
  if (ownsRequestResource(key, resource))
    scopes.getStore()?.resources.delete(key);
}
