import { hashSecret, verifySecret } from "./crypto";
import { globalMap } from "./global-store";

// Minimal user store keyed by phone. Holds a hashed transaction PIN so we can
// model a recovery flow (reset PIN via OTP) that is distinct from login.

type UserRecord = { pinHash?: string; pinSalt?: string };

const users = globalMap<string, UserRecord>("__users");

function getOrCreate(phone: string): UserRecord {
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
  const r = getOrCreate(phone);
  r.pinHash = hash;
  r.pinSalt = salt;
}

export function verifyPin(phone: string, pin: string): boolean {
  const r = users.get(phone);
  if (!r?.pinHash || !r?.pinSalt) return false;
  return verifySecret(pin, r.pinHash, r.pinSalt);
}
