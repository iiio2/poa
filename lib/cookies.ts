// Shared cookie builder. All auth state lives in signed, HttpOnly cookies so the
// app is stateless and works across serverless instances (e.g. Vercel).

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function buildCookie(name: string, value: string, maxAgeSec: number): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return buildCookie(name, "", 0);
}
