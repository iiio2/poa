import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhone, requestOtp, revealCode } from "@/lib/otp-store";

type Data =
  | { ok: true; expiresInSec: number; devCode?: string }
  | { ok: false; error: string; retryAfterSec?: number };

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ ok: false, error: "Enter a valid phone number." });
  }

  const result = requestOtp(phone);
  if (!result.ok) {
    return res.status(429).json({
      ok: false,
      error: `Please wait ${result.retryAfterSec}s before requesting a new code.`,
      retryAfterSec: result.retryAfterSec,
    });
  }

  return res.status(200).json({
    ok: true,
    expiresInSec: result.expiresInSec,
    // Dev convenience: surface the code so you can test without SMS.
    ...(revealCode ? { devCode: result.code } : {}),
  });
}
