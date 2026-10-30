import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, otpErrorResponse, verifyOtp } from "@/lib/otp-store";
import { trustDevice } from "@/lib/devices";
import { ACCESS_TTL_SEC, accessCookie, mintAccess, mintRefresh, refreshCookie } from "@/lib/tokens";
import { requirePost } from "@/lib/http";
import type { OtpVerifyResponse } from "@/lib/api-types";

// Initial login / device verification: validates the OTP, binds the device as
// trusted, and performs the token exchange (issues access + refresh).
export default function handler(req: NextApiRequest, res: NextApiResponse<OtpVerifyResponse>) {
  if (!requirePost(req, res)) return;

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").trim();
  const deviceId = String(req.body?.deviceId ?? "");
  if (!phone || !code) {
    return res.status(400).json({ ok: false, error: "Phone and code are required." });
  }

  const result = verifyOtp(phone, code);
  if (!result.ok) {
    const { status, error, attemptsLeft } = otpErrorResponse(result);
    return res.status(status).json({ ok: false, error, ...(attemptsLeft !== undefined ? { attemptsLeft } : {}) });
  }

  trustDevice(phone, deviceId);
  const access = mintAccess(phone, deviceId, true);
  const { token: refresh } = mintRefresh(phone, deviceId);
  res.setHeader("Set-Cookie", [accessCookie(access), refreshCookie(refresh)]);

  return res.status(200).json({
    ok: true,
    phone,
    deviceId,
    trusted: true,
    accessExpiresInSec: ACCESS_TTL_SEC,
  });
}
