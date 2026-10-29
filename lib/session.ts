import crypto from "crypto";

// Signed, HTTP-only cookie session for the mock auth flow.
// This is a self-contained dev session — no third-party service is involved.
// For real deployments, set SESSION_SECRET to a long random value.

const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
const SESSION_TTL_SEC = 60 * 60 * 24; // 24h

export const SESSION_COOKIE = "mock_session";

export type SessionPayload = {
  phone: string;
  iat: number; // issued-at (unix seconds)
  exp: number; // expiry (unix seconds)
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

export function createSessionToken(phone: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    phone,
    iat: now,
    exp: now + SESSION_TTL_SEC,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  // Constant-time compare to avoid leaking signature via timing.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SEC}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
