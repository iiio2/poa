import crypto from "crypto";

// In-memory OTP store for the mock flow. No SMS is sent — the code is logged
// to the server console and (in dev) returned in the API response so you can
// test the full flow without any provider.
//
// Note: this store is process-local and resets when the dev server reloads.
// That is fine for a mock. Swap this module for a real provider + datastore
// to go to production.

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

// Set MOCK_OTP_CODE to force a fixed code (e.g. 123456). Otherwise a random
// 6-digit code is generated and revealed in dev.
const FIXED_CODE = process.env.MOCK_OTP_CODE;

type OtpEntry = {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

// Persist across hot reloads in dev.
const store: Map<string, OtpEntry> =
  (globalThis as { __otpStore?: Map<string, OtpEntry> }).__otpStore ?? new Map();
(globalThis as { __otpStore?: Map<string, OtpEntry> }).__otpStore = store;

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
  | { ok: false; reason: "cooldown"; retryAfterSec: number };

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

  const code = FIXED_CODE ?? randomCode();
  store.set(phone, {
    code,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  });

  // Stand-in for "sending" the OTP.
  console.log(`[mock-otp] code for ${phone}: ${code}`);

  return { ok: true, code, expiresInSec: Math.floor(OTP_TTL_MS / 1000) };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many_attempts" | "mismatch"; attemptsLeft?: number };

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

  const a = Buffer.from(entry.code);
  const b = Buffer.from(code || "");
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    return { ok: false, reason: "mismatch", attemptsLeft: MAX_ATTEMPTS - entry.attempts };
  }

  // Single-use: consume on success.
  store.delete(phone);
  return { ok: true };
}

/** Whether codes are revealed to the client (dev convenience). */
export const revealCode = process.env.NODE_ENV !== "production";
