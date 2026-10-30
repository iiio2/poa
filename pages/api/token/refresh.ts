import type { NextApiRequest, NextApiResponse } from "next";
import {
  ACCESS_TTL_SEC,
  REFRESH_COOKIE,
  accessCookie,
  refreshCookie,
  rotateRefresh,
  verifyRefresh,
} from "@/lib/tokens";
import { requirePost } from "@/lib/http";
import type { RefreshResponse } from "@/lib/api-types";

// Token refresh: exchange a valid (non-revoked) refresh token for a new access
// token, rotating the refresh token in the process.
export default function handler(req: NextApiRequest, res: NextApiResponse<RefreshResponse>) {
  if (!requirePost(req, res)) return;

  const claims = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  if (!claims) {
    return res.status(401).json({ ok: false, error: "Invalid or expired refresh token." });
  }

  const { access, refresh } = rotateRefresh(claims);
  res.setHeader("Set-Cookie", [accessCookie(access), refreshCookie(refresh)]);
  return res.status(200).json({ ok: true, accessExpiresInSec: ACCESS_TTL_SEC });
}
