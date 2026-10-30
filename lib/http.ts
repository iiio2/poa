import type { NextApiRequest, NextApiResponse } from "next";

// Shared method guard for API routes. Sends a 405 (with Allow) and returns
// false when the method is wrong, so the handler can early-return.
export function requirePost(req: NextApiRequest, res: NextApiResponse): boolean {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return false;
  }
  return true;
}
