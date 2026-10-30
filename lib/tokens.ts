import { signPayload, verifyPayload } from "./crypto";
import { buildCookie, clearCookie } from "./cookies";

// Stateless two-token model — tokens are self-contained signed values, so no
// server-side registry is needed (works across serverless instances):
//   access  — short-lived credential for protected API calls (15 min)
//   refresh — longer-lived proof of an active session (30 days)
// Trade-off vs. a stateful store: no server-side revocation / reuse detection;
// logout clears the cookies in the caller's browser.

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
  iat: number;
  exp: number;
};

type ResetClaims = { sub: string; typ: "pin_reset"; iat: number; exp: number };

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function mintAccess(sub: string, did: string, trusted: boolean): string {
  const iat = now();
  const claims: AccessClaims = { sub, typ: "access", did, trusted, iat, exp: iat + ACCESS_TTL_SEC };
  return signPayload(claims);
}

export function mintRefresh(sub: string, did: string): string {
  const iat = now();
  const claims: RefreshClaims = { sub, typ: "refresh", did, iat, exp: iat + REFRESH_TTL_SEC };
  return signPayload(claims);
}

export function verifyAccess(token: string | undefined): AccessClaims | null {
  const claims = verifyPayload<AccessClaims>(token);
  return claims && claims.typ === "access" ? claims : null;
}

export function verifyRefresh(token: string | undefined): RefreshClaims | null {
  const claims = verifyPayload<RefreshClaims>(token);
  return claims && claims.typ === "refresh" ? claims : null;
}

/** Issue a fresh access + refresh pair from a valid refresh token. */
export function rotateRefresh(claims: RefreshClaims): { access: string; refresh: string } {
  return {
    access: mintAccess(claims.sub, claims.did, true),
    refresh: mintRefresh(claims.sub, claims.did),
  };
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

export function accessCookie(token: string): string {
  return buildCookie(ACCESS_COOKIE, token, ACCESS_TTL_SEC);
}

export function refreshCookie(token: string): string {
  return buildCookie(REFRESH_COOKIE, token, REFRESH_TTL_SEC);
}

export function clearAuthCookies(): string[] {
  return [clearCookie(ACCESS_COOKIE), clearCookie(REFRESH_COOKIE)];
}
