import { randomId, signPayload, verifyPayload } from "./crypto";

// Two-token model (self-contained, no third party):
//   access  — short-lived credential for protected API calls (15 min)
//   refresh — long-lived proof of an active session (30 days), rotated on use
//             and individually revocable via a server-side registry.

export const ACCESS_COOKIE = "pm_access";
export const REFRESH_COOKIE = "pm_refresh";

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

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
  iat: number;
  exp: number;
};

type RefreshRecord = { sub: string; did: string; exp: number; valid: boolean };

// Refresh registry survives dev hot-reloads.
const registry: Map<string, RefreshRecord> =
  (globalThis as { __refreshRegistry?: Map<string, RefreshRecord> }).__refreshRegistry ?? new Map();
(globalThis as { __refreshRegistry?: Map<string, RefreshRecord> }).__refreshRegistry = registry;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function mintAccess(sub: string, did: string, trusted: boolean): string {
  const iat = now();
  const claims: AccessClaims = { sub, typ: "access", did, trusted, iat, exp: iat + ACCESS_TTL_SEC };
  return signPayload(claims);
}

export function mintRefresh(sub: string, did: string): { token: string; jti: string } {
  const iat = now();
  const jti = randomId(16);
  const exp = iat + REFRESH_TTL_SEC;
  const claims: RefreshClaims = { sub, typ: "refresh", did, jti, iat, exp };
  registry.set(jti, { sub, did, exp, valid: true });
  return { token: signPayload(claims), jti };
}

export function verifyAccess(token: string | undefined): AccessClaims | null {
  const claims = verifyPayload<AccessClaims>(token);
  return claims && claims.typ === "access" ? claims : null;
}

export function verifyRefresh(token: string | undefined): RefreshClaims | null {
  const claims = verifyPayload<RefreshClaims>(token);
  if (!claims || claims.typ !== "refresh") return null;
  const record = registry.get(claims.jti);
  if (!record || !record.valid) return null; // revoked or unknown
  return claims;
}

/** Rotate: invalidate the presented refresh token and issue a fresh pair. */
export function rotateRefresh(claims: RefreshClaims): { access: string; refresh: string; jti: string } {
  registry.set(claims.jti, {
    sub: claims.sub,
    did: claims.did,
    exp: claims.exp,
    valid: false,
  });
  const access = mintAccess(claims.sub, claims.did, true);
  const { token: refresh, jti } = mintRefresh(claims.sub, claims.did);
  return { access, refresh, jti };
}

export function revokeRefresh(jti: string): void {
  const record = registry.get(jti);
  if (record) record.valid = false;
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
  return [
    `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}
