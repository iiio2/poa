import type { NextApiRequest, NextApiResponse } from "next";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

type Data = { authenticated: true; phone: string } | { authenticated: false };

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const session = verifySessionToken(req.cookies[SESSION_COOKIE]);
  if (!session) return res.status(200).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, phone: session.phone });
}
