import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, requestOtp, revealCode } from "@/lib/otp-store";
import { isTrustedDevice } from "@/lib/devices";
import { requirePost } from "@/lib/http";
import type { OtpRequestResponse } from "@/lib/api-types";

export default function handler(req: NextApiRequest, res: NextApiResponse<OtpRequestResponse>) {
  if (!requirePost(req, res)) return;

  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ ok: false, error: "Enter a valid phone number." });
  }

  const deviceId = String(req.body?.deviceId ?? "");
  const newDevice = !isTrustedDevice(phone, deviceId);

  const result = requestOtp(phone);
  if (!result.ok) {
    const error =
      result.reason === "cooldown"
        ? `Please wait ${result.retryAfterSec}s before requesting a new code.`
        : "Too many codes requested. Try again later.";
    return res.status(429).json({ ok: false, error, retryAfterSec: result.retryAfterSec });
  }

  return res.status(200).json({
    ok: true,
    expiresInSec: result.expiresInSec,
    newDevice,
    ...(revealCode ? { devCode: result.code } : {}),
  });
}
