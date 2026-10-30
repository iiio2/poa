import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, requestOtp, revealCode, OTP_COOKIE } from "@/lib/otp-store";
import { DEVICES_COOKIE, isTrustedDevice, readDevices } from "@/lib/devices";
import { requirePost } from "@/lib/http";
import type { OtpRequestResponse } from "@/lib/api-types";

export default function handler(req: NextApiRequest, res: NextApiResponse<OtpRequestResponse>) {
  if (!requirePost(req, res)) return;

  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ ok: false, error: "Enter a valid phone number." });
  }

  const deviceId = String(req.body?.deviceId ?? "");
  const newDevice = !isTrustedDevice(readDevices(req.cookies[DEVICES_COOKIE]), deviceId);

  const result = requestOtp(req.cookies[OTP_COOKIE], phone);
  if (!result.ok) {
    return res.status(429).json({
      ok: false,
      error: `Please wait ${result.retryAfterSec}s before requesting a new code.`,
      retryAfterSec: result.retryAfterSec,
    });
  }

  res.setHeader("Set-Cookie", result.cookie);
  return res.status(200).json({
    ok: true,
    expiresInSec: result.expiresInSec,
    newDevice,
    ...(revealCode ? { devCode: result.code } : {}),
  });
}
