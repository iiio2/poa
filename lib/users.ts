import { hashSecret, verifySecret } from "./crypto";

// Minimal user store keyed by phone. Holds a hashed transaction PIN so we can
// model a recovery flow (reset PIN via OTP) that is distinct from login.

type UserRecord = { pinHash?: string; pinSalt?: string };

const users: Map<string, UserRecord> =
  (globalThis as { __users?: Map<string, UserRecord> }).__users ?? new Map();
(globalThis as { __users?: Map<string, UserRecord> }).__users = users;

function record(phone: string): UserRecord {
  let r = users.get(phone);
  if (!r) {
    r = {};
    users.set(phone, r);
  }
  return r;
}

export function hasPin(phone: string): boolean {
  const r = users.get(phone);
  return Boolean(r?.pinHash && r?.pinSalt);
}

export function setPin(phone: string, pin: string): void {
  const { hash, salt } = hashSecret(pin);
  const r = record(phone);
  r.pinHash = hash;
  r.pinSalt = salt;
}

export function verifyPin(phone: string, pin: string): boolean {
  const r = users.get(phone);
  if (!r?.pinHash || !r?.pinSalt) return false;
  return verifySecret(pin, r.pinHash, r.pinSalt);
}
