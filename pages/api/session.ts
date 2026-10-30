import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccess, verifyRefresh } from "@/lib/tokens";
import { isTrustedDevice } from "@/lib/devices";
import type { SessionResponse } from "@/lib/api-types";

// Informational: reports the state of both tokens so the UI can render a live
// session panel. Cookies are HttpOnly, so the client can't read them directly.

function expiresInSec(exp: number | undefined): number | null {
  if (typeof exp !== "number") return null;
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}

export default function handler(req: NextApiRequest, res: NextApiResponse<SessionResponse>) {
  const access = verifyAccess(req.cookies[ACCESS_COOKIE]);
  const refresh = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  const phone = refresh?.sub ?? access?.sub ?? null;
  const deviceId = refresh?.did ?? access?.did ?? null;
  return res.status(200).json({
    ok: true,
    access: { valid: Boolean(access), expiresInSec: expiresInSec(access?.exp) },
    refresh: { valid: Boolean(refresh), expiresInSec: expiresInSec(refresh?.exp) },
    phone,
    deviceId,
    // Trust reflects the device registry, so it stays accurate even once the
    // short-lived access token has expired.
    trusted: Boolean(phone && deviceId && isTrustedDevice(phone, deviceId)),
  });
}
