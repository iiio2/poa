import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone } from "@/lib/otp-store";
import { verifyResetToken } from "@/lib/tokens";
import { setPin } from "@/lib/users";
import { requirePost } from "@/lib/http";
import type { PinResetResponse } from "@/lib/api-types";

// Recovery step 2 (distinct from login): consume the one-time reset token from
// step 1 and set a new PIN. Does NOT issue a session — the user logs in after.
export default function handler(req: NextApiRequest, res: NextApiResponse<PinResetResponse>) {
  if (!requirePost(req, res)) return;

  const phone = normalizePhone(req.body?.phone);
  const resetToken = String(req.body?.resetToken ?? "");
  const newPin = String(req.body?.newPin ?? "");
  if (!phone) {
    return res.status(400).json({ ok: false, error: "Phone is required." });
  }
  if (!/^\d{4,6}$/.test(newPin)) {
    return res.status(400).json({ ok: false, error: "PIN must be 4-6 digits." });
  }

  const sub = verifyResetToken(resetToken);
  if (!sub || sub !== phone) {
    return res.status(401).json({ ok: false, error: "Reset session invalid or expired. Start again." });
  }

  setPin(phone, newPin);
  return res.status(200).json({ ok: true });
}
