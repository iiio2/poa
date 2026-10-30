// Stable per-browser device id, persisted in localStorage. Sent with OTP
// requests so the server can distinguish known devices from new ones.
const KEY = "pm_device_id";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Stable for the tab's lifetime when storage is blocked, so request+verify in
// one login use the same id (instead of every browser sharing one constant).
let ephemeralId = "";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: use a per-session ephemeral id.
    if (!ephemeralId) ephemeralId = `eph-${newId()}`;
    return ephemeralId;
  }
}

/** Forget this device (so the next login is treated as a new device). */
export function clearDeviceId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
