import crypto from "crypto";
import { safeEqual } from "./crypto";
import { globalMap } from "./global-store";

// In-memory OTP store for the mock flow. No SMS is sent — the code is logged
// to the server console and (in dev) returned in the API response so you can
// test the full flow without any provider.
//
// Note: this store is process-local and resets when the dev server reloads.

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_PER_WINDOW = 5;

// Set MOCK_OTP_CODE to force a fixed code (e.g. 123456). An empty or unset value
// means random — `|| undefined` so `MOCK_OTP_CODE=` isn't treated as a fixed "".
const FIXED_CODE = process.env.MOCK_OTP_CODE || undefined;

type OtpEntry = {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

const store = globalMap<string, OtpEntry>("__otpStore");
// Send timestamps per phone — kept separately so the rate cap survives the
// deletion of an OTP entry on success/lockout (a global-ish cap, not per-code).
const sendLog = globalMap<string, number[]>("__otpSendLog");

/** Normalize to digits only; returns null if it doesn't look like a phone number. */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function randomCode(): string {
  // 6-digit, zero-padded, from a uniform draw.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export type RequestResult =
  | { ok: true; code: string; expiresInSec: number }
  | { ok: false; reason: "cooldown" | "rate_limited"; retryAfterSec: number };

export function requestOtp(phone: string): RequestResult {
  const now = Date.now();
  const existing = store.get(phone);

  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000),
    };
  }

  // Sustained-rate cap over a rolling window.
  const recent = (sendLog.get(phone) ?? []).filter((t) => now - t < SEND_WINDOW_MS);
  if (recent.length >= MAX_SENDS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((SEND_WINDOW_MS - (now - recent[0])) / 1000);
    sendLog.set(phone, recent);
    return { ok: false, reason: "rate_limited", retryAfterSec };
  }
  recent.push(now);
  sendLog.set(phone, recent);

  const code = FIXED_CODE ?? randomCode();
  store.set(phone, { code, expiresAt: now + OTP_TTL_MS, attempts: 0, lastSentAt: now });

  // Stand-in for "sending" the OTP.
  console.log(`[mock-otp] code for ${phone}: ${code}`);

  return { ok: true, code, expiresInSec: Math.floor(OTP_TTL_MS / 1000) };
}

export type VerifyFailReason = "no_code" | "expired" | "too_many_attempts" | "mismatch";
export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailReason; attemptsLeft?: number };

export function verifyOtp(phone: string, code: string): VerifyResult {
  const entry = store.get(phone);
  if (!entry) return { ok: false, reason: "no_code" };

  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return { ok: false, reason: "expired" };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(phone);
    return { ok: false, reason: "too_many_attempts" };
  }

  entry.attempts += 1;

  if (!safeEqual(entry.code, code || "")) {
    return { ok: false, reason: "mismatch", attemptsLeft: MAX_ATTEMPTS - entry.attempts };
  }

  // Single-use: consume on success.
  store.delete(phone);
  return { ok: true };
}

/** Map a failed verify result to an HTTP status + user-facing message (shared by routes). */
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

/**
 * Whether codes are revealed to the client. On in dev; in production it's off
 * unless MOCK_REVEAL_OTP=true (opt-in, for running this mock as a demo).
 */
export const revealCode =
  process.env.NODE_ENV !== "production" || process.env.MOCK_REVEAL_OTP === "true";
