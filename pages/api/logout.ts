import type { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie } from "@/lib/session";

export default function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true }>) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ ok: true });
}
