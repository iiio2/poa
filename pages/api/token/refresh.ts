import type { NextApiRequest, NextApiResponse } from "next";
import {
  ACCESS_TTL_SEC,
  REFRESH_COOKIE,
  accessCookie,
  refreshCookie,
  rotateRefresh,
  verifyRefresh,
} from "@/lib/tokens";

type Data =
  | { ok: true; accessExpiresInSec: number }
  | { ok: false; error: string };

// Token refresh: exchange a valid (non-revoked) refresh token for a new access
// token, rotating the refresh token in the process.
export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const claims = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  if (!claims) {
    return res.status(401).json({ ok: false, error: "Invalid or expired refresh token." });
  }

  const { access, refresh } = rotateRefresh(claims);
  res.setHeader("Set-Cookie", [accessCookie(access), refreshCookie(refresh)]);
  return res.status(200).json({ ok: true, accessExpiresInSec: ACCESS_TTL_SEC });
}
