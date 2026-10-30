// Single helper for the in-memory stores that must survive dev hot-reloads.
// Centralizes the globalThis stash so each store doesn't repeat the cast.
export function globalMap<K, V>(name: string): Map<K, V> {
  const g = globalThis as Record<string, unknown>;
  const existing = g[name];
  if (existing instanceof Map) return existing as Map<K, V>;
  const created = new Map<K, V>();
  g[name] = created;
  return created;
}
