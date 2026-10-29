import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, verifyOtp } from "@/lib/otp-store";
import { setPin } from "@/lib/users";

type Data = { ok: true } | { ok: false; error: string };

// Recovery flow (distinct from login): reset the PIN by proving control of the
// number with a fresh OTP. This path verifies the OTP itself and does NOT issue
// a session — it only updates the PIN, then the user logs in normally.
export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").trim();
  const newPin = String(req.body?.newPin ?? "");
  if (!phone || !code) {
    return res.status(400).json({ ok: false, error: "Phone and code are required." });
  }
  if (!/^\d{4,6}$/.test(newPin)) {
    return res.status(400).json({ ok: false, error: "PIN must be 4-6 digits." });
  }

  const result = verifyOtp(phone, code);
  if (!result.ok) {
    return res.status(result.reason === "mismatch" ? 401 : 400).json({
      ok: false,
      error: result.reason === "mismatch" ? "Incorrect code." : "Code invalid or expired.",
    });
  }

  setPin(phone, newPin);
  return res.status(200).json({ ok: true });
}
