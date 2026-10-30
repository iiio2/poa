import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_COOKIE, verifyAccess } from "@/lib/tokens";
import { PIN_COOKIE, hasPin, pinCookie, readPin, verifyPin } from "@/lib/users";
import { requirePost } from "@/lib/http";
import type { PinSetResponse } from "@/lib/api-types";

// Set or change the transaction PIN (requires a valid access token). Changing an
// existing PIN is a step-up action: the current PIN must be supplied.
export default function handler(req: NextApiRequest, res: NextApiResponse<PinSetResponse>) {
  if (!requirePost(req, res)) return;

  const claims = verifyAccess(req.cookies[ACCESS_COOKIE]);
  if (!claims) {
    return res.status(401).json({ ok: false, error: "Not authenticated." });
  }

  const pin = String(req.body?.pin ?? "");
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ ok: false, error: "PIN must be 4-6 digits." });
  }

  const existing = readPin(req.cookies[PIN_COOKIE]);
  if (hasPin(existing, claims.sub)) {
    const currentPin = String(req.body?.currentPin ?? "");
    if (!verifyPin(existing, claims.sub, currentPin)) {
      return res.status(403).json({ ok: false, error: "Current PIN is incorrect." });
    }
  }

  res.setHeader("Set-Cookie", pinCookie(claims.sub, pin));
  return res.status(200).json({ ok: true });
}
