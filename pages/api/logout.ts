import type { NextApiRequest, NextApiResponse } from "next";
import { REFRESH_COOKIE, clearAuthCookies, revokeRefresh, verifyRefresh } from "@/lib/tokens";
import { requirePost } from "@/lib/http";
import type { SimpleOk } from "@/lib/api-types";

// Logout: revoke the refresh token server-side and clear both cookies.
// POST-only so a cross-site GET navigation can't force a logout.
export default function handler(req: NextApiRequest, res: NextApiResponse<SimpleOk>) {
  if (!requirePost(req, res)) return;

  const claims = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  if (claims) revokeRefresh(claims.jti);
  res.setHeader("Set-Cookie", clearAuthCookies());
  return res.status(200).json({ ok: true });
}
