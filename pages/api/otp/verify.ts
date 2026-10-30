import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, otpErrorResponse, verifyOtp, OTP_COOKIE } from "@/lib/otp-store";
import { DEVICES_COOKIE, addDeviceCookie, readDevices } from "@/lib/devices";
import { ACCESS_TTL_SEC, accessCookie, mintAccess, mintRefresh, refreshCookie } from "@/lib/tokens";
import { requirePost } from "@/lib/http";
import type { OtpVerifyResponse } from "@/lib/api-types";

// Initial login / device verification: validates the OTP (from the pm_otp
// cookie), binds the device as trusted, and issues access + refresh tokens.
export default function handler(req: NextApiRequest, res: NextApiResponse<OtpVerifyResponse>) {
  if (!requirePost(req, res)) return;

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").trim();
  const deviceId = String(req.body?.deviceId ?? "");
  if (!phone || !code) {
    return res.status(400).json({ ok: false, error: "Phone and code are required." });
  }

  const result = verifyOtp(req.cookies[OTP_COOKIE], phone, code);
  if (!result.ok) {
    if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
    const { status, error, attemptsLeft } = otpErrorResponse(result);
    return res.status(status).json({ ok: false, error, ...(attemptsLeft !== undefined ? { attemptsLeft } : {}) });
  }

  const devices = readDevices(req.cookies[DEVICES_COOKIE]);
  res.setHeader("Set-Cookie", [
    result.cookie, // clears pm_otp
    addDeviceCookie(devices, deviceId),
    accessCookie(mintAccess(phone, deviceId, true)),
    refreshCookie(mintRefresh(phone, deviceId)),
  ]);

  return res.status(200).json({ ok: true, phone, deviceId, trusted: true, accessExpiresInSec: ACCESS_TTL_SEC });
}
