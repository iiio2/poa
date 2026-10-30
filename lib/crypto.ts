import crypto from "crypto";

// Shared signing primitives for the mock auth stack. HMAC-SHA256 over a
// base64url(JSON) body, producing compact `body.signature` tokens.

// The HMAC key, resolved lazily on first use (not at import, so builds don't
// need it). Fail closed in production: a missing/weak SESSION_SECRET would let
// anyone forge tokens with the committed default, so signing/verifying throws.
let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret !== null) return cachedSecret;
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) {
    cachedSecret = s;
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to a strong value (>=16 chars) in production.");
  } else {
    cachedSecret = "dev-insecure-secret-change-me";
  }
  return cachedSecret;
}

export function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function hmac(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

/** Constant-time string compare that tolerates length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function randomId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Sign an arbitrary claims object into a `body.sig` token. */
export function signPayload(claims: Record<string, unknown>): string {
  const body = b64url(JSON.stringify(claims));
  return `${body}.${hmac(body)}`;
}

/**
 * Verify a `body.sig` token: checks the signature and, if the claims carry a
 * numeric `exp` (unix seconds), that it hasn't expired. Returns the claims or null.
 */
export function verifyPayload<T extends { exp?: number }>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(body))) return null;
  try {
    const claims = JSON.parse(b64urlDecode(body).toString("utf8")) as T;
    if (typeof claims.exp === "number" && claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

/** Hash a secret (PIN/password) with scrypt + per-secret salt. */
export function hashSecret(secret: string): { hash: string; salt: string } {
  const salt = randomId(16);
  const hash = crypto.scryptSync(secret, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifySecret(secret: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(secret, salt, 64).toString("hex");
  return safeEqual(computed, hash);
}
