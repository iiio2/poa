import { randomId, signPayload, verifyPayload } from "./crypto";
import { globalMap } from "./global-store";

// Two-token model (self-contained, no third party):
//   access  — short-lived credential for protected API calls (15 min)
//   refresh — long-lived proof of an active session (30 days), rotated on use.
//
// Rotation tracks a per-login "family": presenting an already-consumed refresh
// token is treated as theft and revokes the whole family. Also mints a
// short-lived one-time reset token used by the PIN-recovery flow.

export const ACCESS_COOKIE = "pm_access";
export const REFRESH_COOKIE = "pm_refresh";

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const RESET_TTL_SEC = 5 * 60;

export type AccessClaims = {
  sub: string; // phone
  typ: "access";
  did: string; // device id
  trusted: boolean;
  iat: number;
  exp: number;
};

export type RefreshClaims = {
  sub: string;
  typ: "refresh";
  did: string;
  jti: string; // unique id, tracked for rotation/revocation
  fam: string; // login family, shared across rotations
  iat: number;
  exp: number;
};

type ResetClaims = { sub: string; typ: "pin_reset"; iat: number; exp: number };

type RefreshRecord = { sub: string; did: string; fam: string; exp: number; valid: boolean };

const registry = globalMap<string, RefreshRecord>("__refreshRegistry");

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/** Drop records whose tokens have expired, so the registry stays bounded. */
function prune(): void {
  const t = now();
  for (const [jti, r] of registry) {
    if (r.exp < t) registry.delete(jti);
  }
}

export function mintAccess(sub: string, did: string, trusted: boolean): string {
  const iat = now();
  const claims: AccessClaims = { sub, typ: "access", did, trusted, iat, exp: iat + ACCESS_TTL_SEC };
  return signPayload(claims);
}

export function mintRefresh(sub: string, did: string, fam?: string): { token: string; jti: string; fam: string } {
  prune();
  const iat = now();
  const jti = randomId(16);
  const family = fam ?? randomId(16);
  const exp = iat + REFRESH_TTL_SEC;
  const claims: RefreshClaims = { sub, typ: "refresh", did, jti, fam: family, iat, exp };
  registry.set(jti, { sub, did, fam: family, exp, valid: true });
  return { token: signPayload(claims), jti, fam: family };
}

export function verifyAccess(token: string | undefined): AccessClaims | null {
  const claims = verifyPayload<AccessClaims>(token);
  return claims && claims.typ === "access" ? claims : null;
}

export function verifyRefresh(token: string | undefined): RefreshClaims | null {
  const claims = verifyPayload<RefreshClaims>(token);
  if (!claims || claims.typ !== "refresh") return null;
  const record = registry.get(claims.jti);
  if (!record) return null; // unknown token
  if (!record.valid) {
    // Reuse of a consumed/rotated token: treat as theft, revoke the family.
    revokeFamily(record.fam);
    return null;
  }
  return claims;
}

/** Rotate: invalidate the presented refresh token and issue a fresh pair (same family). */
export function rotateRefresh(claims: RefreshClaims): { access: string; refresh: string } {
  const record = registry.get(claims.jti);
  if (record) record.valid = false;
  const access = mintAccess(claims.sub, claims.did, true);
  const { token: refresh } = mintRefresh(claims.sub, claims.did, claims.fam);
  return { access, refresh };
}

export function revokeRefresh(jti: string): void {
  const record = registry.get(jti);
  if (record) record.valid = false;
}

export function revokeFamily(fam: string): void {
  for (const record of registry.values()) {
    if (record.fam === fam) record.valid = false;
  }
}

// One-time token proving a verified OTP, used to gate PIN reset without a session.
export function mintResetToken(sub: string): string {
  const iat = now();
  const claims: ResetClaims = { sub, typ: "pin_reset", iat, exp: iat + RESET_TTL_SEC };
  return signPayload(claims);
}

export function verifyResetToken(token: string | undefined): string | null {
  const claims = verifyPayload<ResetClaims>(token);
  return claims && claims.typ === "pin_reset" ? claims.sub : null;
}

function cookie(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function accessCookie(token: string): string {
  return cookie(ACCESS_COOKIE, token, ACCESS_TTL_SEC);
}

export function refreshCookie(token: string): string {
  return cookie(REFRESH_COOKIE, token, REFRESH_TTL_SEC);
}

export function clearAuthCookies(): string[] {
  // Reuse the builder so cleared cookies carry the same attributes (incl. Secure).
  return [cookie(ACCESS_COOKIE, "", 0), cookie(REFRESH_COOKIE, "", 0)];
}
