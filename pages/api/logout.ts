import type { NextApiRequest, NextApiResponse } from "next";
import { clearAuthCookies } from "@/lib/tokens";
import { requirePost } from "@/lib/http";
import type { SimpleOk } from "@/lib/api-types";

// Logout: clear the session cookies in the caller's browser. (Stateless tokens
// have no server-side registry to revoke; clearing the cookies ends the session.)
export default function handler(req: NextApiRequest, res: NextApiResponse<SimpleOk>) {
  if (!requirePost(req, res)) return;
  res.setHeader("Set-Cookie", clearAuthCookies());
  return res.status(200).json({ ok: true });
}
