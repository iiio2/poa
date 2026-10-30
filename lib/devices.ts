import { signPayload, verifyPayload } from "./crypto";
import { buildCookie } from "./cookies";

// Stateless trusted-device list, stored in a signed, HttpOnly cookie (pm_devices)
// per browser. A device becomes trusted once it completes an OTP verification;
// unseen devices are flagged so the UI can show the device-verification step.

export const DEVICES_COOKIE = "pm_devices";
const DEVICES_TTL_SEC = 365 * 24 * 60 * 60;
const MAX_DEVICES = 10; // bound the cookie size

type DevicesClaims = { devs: string[]; exp: number };

export function readDevices(cookie: string | undefined): string[] {
  const claims = verifyPayload<DevicesClaims>(cookie);
  return Array.isArray(claims?.devs) ? claims.devs : [];
}

export function isTrustedDevice(devices: string[], deviceId: string): boolean {
  return Boolean(deviceId) && devices.includes(deviceId);
}

/** Returns a Set-Cookie string with deviceId added to the trusted list. */
export function addDeviceCookie(devices: string[], deviceId: string): string {
  const set = new Set(devices);
  if (deviceId) set.add(deviceId);
  const devs = [...set].slice(-MAX_DEVICES);
  const exp = Math.floor(Date.now() / 1000) + DEVICES_TTL_SEC;
  return buildCookie(DEVICES_COOKIE, signPayload({ devs, exp }), DEVICES_TTL_SEC);
}
