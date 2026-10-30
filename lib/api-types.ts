// Shared response contracts for the auth API, imported by both the route
// handlers and the client so the two can't drift.

export type ApiError = { ok: false; error: string };

export type OtpRequestResponse =
  | { ok: true; expiresInSec: number; newDevice: boolean; devCode?: string }
  | (ApiError & { retryAfterSec?: number });

export type OtpVerifyResponse =
  | { ok: true; phone: string; deviceId: string; trusted: true; accessExpiresInSec: number }
  | (ApiError & { attemptsLeft?: number });

export type VerifyResetResponse =
  | { ok: true; resetToken: string }
  | (ApiError & { attemptsLeft?: number });

export type PinResetResponse = { ok: true } | ApiError;
export type PinSetResponse = { ok: true } | ApiError;
export type SimpleOk = { ok: true } | ApiError;

export type RefreshResponse = { ok: true; accessExpiresInSec: number } | ApiError;

export type MeResponse =
  | { ok: true; authenticated: true; phone: string; deviceId: string; trusted: boolean; hasPin: boolean }
  | { ok: false; authenticated: false; error: string };

export type TokenState = { valid: boolean; expiresInSec: number | null };

export type SessionResponse = {
  ok: true;
  access: TokenState;
  refresh: TokenState;
  phone: string | null;
  deviceId: string | null;
  trusted: boolean;
};
