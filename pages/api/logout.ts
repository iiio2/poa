import type { NextApiRequest, NextApiResponse } from "next";
import { REFRESH_COOKIE, clearAuthCookies, revokeRefresh, verifyRefresh } from "@/lib/tokens";

// Logout: revoke the refresh token server-side and clear both cookies.
export default function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true }>) {
  const claims = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  if (claims) revokeRefresh(claims.jti);
  res.setHeader("Set-Cookie", clearAuthCookies());
  return res.status(200).json({ ok: true });
}
