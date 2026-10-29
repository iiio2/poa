import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, verifyOtp } from "@/lib/otp-store";
import { trustDevice } from "@/lib/devices";
import { accessCookie, mintAccess, mintRefresh, refreshCookie } from "@/lib/tokens";

type Data =
  | { ok: true; phone: string; deviceId: string; trusted: true; accessExpiresInSec: number }
  | { ok: false; error: string; attemptsLeft?: number };

const MESSAGES: Record<string, string> = {
  no_code: "No code was requested for this number. Request one first.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many incorrect attempts. Request a new code.",
  mismatch: "Incorrect code.",
};

// Initial login / device verification: validates the OTP, binds the device as
// trusted, and performs the token exchange (issues access + refresh).
export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").trim();
  const deviceId = String(req.body?.deviceId ?? "");
  if (!phone || !code) {
    return res.status(400).json({ ok: false, error: "Phone and code are required." });
  }

  const result = verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.reason === "mismatch" ? 401 : 400;
    return res.status(status).json({
      ok: false,
      error: MESSAGES[result.reason] ?? "Verification failed.",
      ...(result.attemptsLeft !== undefined ? { attemptsLeft: result.attemptsLeft } : {}),
    });
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
    accessExpiresInSec: 15 * 60,
  });
}
