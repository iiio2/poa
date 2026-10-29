import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_COOKIE, verifyAccess } from "@/lib/tokens";
import { setPin } from "@/lib/users";

type Data = { ok: true } | { ok: false; error: string };

// Set the transaction PIN for the signed-in user (requires a valid access token).
export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const claims = verifyAccess(req.cookies[ACCESS_COOKIE]);
  if (!claims) {
    return res.status(401).json({ ok: false, error: "Not authenticated." });
  }

  const pin = String(req.body?.pin ?? "");
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ ok: false, error: "PIN must be 4-6 digits." });
  }

  setPin(claims.sub, pin);
  return res.status(200).json({ ok: true });
}
