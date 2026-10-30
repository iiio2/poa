import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, otpErrorResponse, verifyOtp, OTP_COOKIE } from "@/lib/otp-store";
import { mintResetToken } from "@/lib/tokens";
import { requirePost } from "@/lib/http";
import type { VerifyResetResponse } from "@/lib/api-types";

// Recovery step 1: verify the OTP (consuming it, with the attempt cap) and issue
// a short-lived one-time reset token. No session is created here.
export default function handler(req: NextApiRequest, res: NextApiResponse<VerifyResetResponse>) {
  if (!requirePost(req, res)) return;

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").trim();
  if (!phone || !code) {
    return res.status(400).json({ ok: false, error: "Phone and code are required." });
  }

  const result = verifyOtp(req.cookies[OTP_COOKIE], phone, code);
  if (!result.ok) {
    if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
    const { status, error, attemptsLeft } = otpErrorResponse(result);
    return res.status(status).json({ ok: false, error, ...(attemptsLeft !== undefined ? { attemptsLeft } : {}) });
  }

  res.setHeader("Set-Cookie", result.cookie); // clears pm_otp
  return res.status(200).json({ ok: true, resetToken: mintResetToken(phone) });
}
