import { hashSecret, signPayload, verifyPayload, verifySecret } from "./crypto";
import { buildCookie } from "./cookies";

// Stateless transaction PIN, stored (hashed) in a signed, HttpOnly cookie
// (pm_pin) per browser. Lets us model a recovery flow distinct from login.

export const PIN_COOKIE = "pm_pin";
const PIN_TTL_SEC = 365 * 24 * 60 * 60;

type PinClaims = { sub: string; hash: string; salt: string; exp: number };

export function readPin(cookie: string | undefined): PinClaims | null {
  return verifyPayload<PinClaims>(cookie);
}

export function hasPin(pin: PinClaims | null, phone: string): boolean {
  return Boolean(pin && pin.sub === phone && pin.hash && pin.salt);
}

export function verifyPin(pin: PinClaims | null, phone: string, value: string): boolean {
  if (!hasPin(pin, phone)) return false;
  return verifySecret(value, pin!.hash, pin!.salt);
}

/** Returns a Set-Cookie string storing a new (hashed) PIN for this phone. */
export function pinCookie(phone: string, value: string): string {
  const { hash, salt } = hashSecret(value);
  const exp = Math.floor(Date.now() / 1000) + PIN_TTL_SEC;
  return buildCookie(PIN_COOKIE, signPayload({ sub: phone, hash, salt, exp }), PIN_TTL_SEC);
}
