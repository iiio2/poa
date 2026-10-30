// Typed client-side fetch helpers shared across the pages.

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return (await res.json()) as T;
}

/**
 * Fetch that transparently refreshes the access token once on a 401 and retries.
 * Returns the final Response; callers decide what to do if it's still 401.
 */
export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 401) {
    const refreshed = await fetch("/api/token/refresh", { method: "POST" });
    if (refreshed.ok) res = await fetch(url, init);
  }
  return res;
}
