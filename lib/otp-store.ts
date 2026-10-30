import crypto from "crypto";
import { b64urlDecode, hmac, safeEqual, signPayload, verifyPayload } from "./crypto";
import { buildCookie, clearCookie } from "./cookies";

// Stateless OTP: the challenge lives in a signed, HttpOnly cookie (pm_otp) in the
// requester's browser — no SMS, no server memory. The cookie holds a hash of the
// code plus attempt count and issue time, so request → verify works across
// serverless instances.

const OTP_TTL_SEC = 5 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 30;

export const OTP_COOKIE = "pm_otp";

// Set MOCK_OTP_CODE to force a fixed code; empty/unset means random.
const FIXED_CODE = process.env.MOCK_OTP_CODE || undefined;

type OtpClaims = { sub: string; ch: string; att: number; iat: number; exp: number };

/** Normalize to digits only; returns null if it doesn't look like a phone number. */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function randomCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function otpCookie(token: string): string {
  return buildCookie(OTP_COOKIE, token, OTP_TTL_SEC);
}

// Decode without enforcing exp, so verify can distinguish "expired" from "no code".
function decodeOtp(token: string | undefined): OtpClaims | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(body))) return null;
  try {
    return JSON.parse(b64urlDecode(body).toString("utf8")) as OtpClaims;
  } catch {
    return null;
  }
}

export type RequestResult =
  | { ok: true; code: string; cookie: string; expiresInSec: number }
  | { ok: false; retryAfterSec: number };

export function requestOtp(prevCookie: string | undefined, phone: string): RequestResult {
  const t = Math.floor(Date.now() / 1000);
  const prev = verifyPayload<OtpClaims>(prevCookie); // null if missing/expired
  if (prev && prev.sub === phone && t - prev.iat < RESEND_COOLDOWN_SEC) {
    return { ok: false, retryAfterSec: RESEND_COOLDOWN_SEC - (t - prev.iat) };
  }

  const code = FIXED_CODE ?? randomCode();
  const claims: OtpClaims = { sub: phone, ch: hmac(code), att: 0, iat: t, exp: t + OTP_TTL_SEC };

  // Stand-in for "sending" the OTP.
  console.log(`[mock-otp] code for ${phone}: ${code}`);

  return { ok: true, code, cookie: otpCookie(signPayload(claims)), expiresInSec: OTP_TTL_SEC };
}

export type VerifyFailReason = "no_code" | "expired" | "too_many_attempts" | "mismatch";
export type VerifyResult =
  | { ok: true; cookie: string } // cookie clears pm_otp (single-use)
  | { ok: false; reason: VerifyFailReason; attemptsLeft?: number; cookie?: string };

export function verifyOtp(prevCookie: string | undefined, phone: string, code: string): VerifyResult {
  const prev = decodeOtp(prevCookie);
  if (!prev || prev.sub !== phone) return { ok: false, reason: "no_code" };

  const t = Math.floor(Date.now() / 1000);
  if (t > prev.exp) return { ok: false, reason: "expired", cookie: clearCookie(OTP_COOKIE) };
  if (prev.att >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts", cookie: clearCookie(OTP_COOKIE) };
  }

  if (!safeEqual(prev.ch, hmac(code || ""))) {
    const att = prev.att + 1;
    const next = otpCookie(signPayload({ ...prev, att }));
    return { ok: false, reason: "mismatch", attemptsLeft: MAX_ATTEMPTS - att, cookie: next };
  }

  // Single-use: clear the challenge on success.
  return { ok: true, cookie: clearCookie(OTP_COOKIE) };
}

const VERIFY_MESSAGES: Record<VerifyFailReason, string> = {
  no_code: "No code was requested for this number. Request one first.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many incorrect attempts. Request a new code.",
  mismatch: "Incorrect code.",
};

export function otpErrorResponse(result: Extract<VerifyResult, { ok: false }>): {
  status: number;
  error: string;
  attemptsLeft?: number;
} {
  return {
    status: result.reason === "mismatch" ? 401 : 400,
    error: VERIFY_MESSAGES[result.reason],
    ...(result.attemptsLeft !== undefined ? { attemptsLeft: result.attemptsLeft } : {}),
  };
}

/** Whether codes are revealed to the client. On in dev; opt-in via MOCK_REVEAL_OTP in prod. */
export const revealCode =
  process.env.NODE_ENV !== "production" || process.env.MOCK_REVEAL_OTP === "true";
