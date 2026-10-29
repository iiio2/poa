import type { NextApiRequest, NextApiResponse } from "next";
import { ACCESS_COOKIE, verifyAccess } from "@/lib/tokens";
import { hasPin } from "@/lib/users";

type Data =
  | { authenticated: true; phone: string; deviceId: string; trusted: boolean; hasPin: boolean }
  | { authenticated: false; error: string };

// Protected resource: requires a valid ACCESS token. When it has expired the
// client is expected to call /api/token/refresh and retry.
export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const claims = verifyAccess(req.cookies[ACCESS_COOKIE]);
  if (!claims) {
    return res.status(401).json({ authenticated: false, error: "Access token missing or expired." });
  }
  return res.status(200).json({
    authenticated: true,
    phone: claims.sub,
    deviceId: claims.did,
    trusted: claims.trusted,
    hasPin: hasPin(claims.sub),
  });
}
