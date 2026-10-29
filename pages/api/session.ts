import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccess, verifyRefresh } from "@/lib/tokens";

// Informational: reports the state of both tokens so the UI can render a live
// session panel. Cookies are HttpOnly, so the client can't read them directly.
type TokenState = { valid: boolean; expiresInSec: number | null };
type Data = {
  access: TokenState;
  refresh: TokenState;
  phone: string | null;
  deviceId: string | null;
  trusted: boolean;
};

function expiresInSec(exp: number | undefined): number | null {
  if (typeof exp !== "number") return null;
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const access = verifyAccess(req.cookies[ACCESS_COOKIE]);
  const refresh = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  return res.status(200).json({
    access: { valid: Boolean(access), expiresInSec: expiresInSec(access?.exp) },
    refresh: { valid: Boolean(refresh), expiresInSec: expiresInSec(refresh?.exp) },
    phone: refresh?.sub ?? access?.sub ?? null,
    deviceId: refresh?.did ?? access?.did ?? null,
    trusted: access?.trusted ?? false,
  });
}
