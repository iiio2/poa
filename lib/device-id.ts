// Stable per-browser device id, persisted in localStorage. Sent with OTP
// requests so the server can distinguish known devices from new ones.
const KEY = "pm_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: fall back to an ephemeral id.
    return "ephemeral-device";
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
