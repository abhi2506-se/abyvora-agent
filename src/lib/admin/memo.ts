/**
 * Tiny in-process TTL memo for expensive, read-only aggregations (sidebar
 * counts, dashboard sections). Per-instance by design — on multi-instance
 * deployments every instance simply warms its own copy, which is safe because
 * the cache is only ever reachable behind requirePlatformOwner().
 */
const store = new Map<string, { value: unknown; expires: number }>();
const inflight = new Map<string, Promise<unknown>>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      if (store.size > 200) {
        for (const [k, v] of store) if (v.expires <= Date.now()) store.delete(k);
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function clearMemo(prefix?: string) {
  if (!prefix) return store.clear();
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
