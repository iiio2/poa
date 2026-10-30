import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_COOKIE, verifyAccess } from "@/lib/tokens";
import { DEVICES_COOKIE, isTrustedDevice, readDevices } from "@/lib/devices";
import { PIN_COOKIE, hasPin, readPin } from "@/lib/users";
import type { MeResponse } from "@/lib/api-types";

// Protected resource: requires a valid ACCESS token. When it has expired the
// client is expected to call /api/token/refresh and retry.
export default function handler(req: NextApiRequest, res: NextApiResponse<MeResponse>) {
  const claims = verifyAccess(req.cookies[ACCESS_COOKIE]);
  if (!claims) {
    return res.status(401).json({ ok: false, authenticated: false, error: "Access token missing or expired." });
  }
  const devices = readDevices(req.cookies[DEVICES_COOKIE]);
  const pin = readPin(req.cookies[PIN_COOKIE]);
  return res.status(200).json({
    ok: true,
    authenticated: true,
    phone: claims.sub,
    deviceId: claims.did,
    trusted: isTrustedDevice(devices, claims.did),
    hasPin: hasPin(pin, claims.sub),
  });
}
