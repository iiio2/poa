// Trusted-device registry. A device becomes trusted for a phone number once it
// completes an OTP verification. New (unseen) devices are flagged so the UI can
// show a "verifying new device" step — the device-verification stage.

type DeviceRecord = { trustedAt: number };

const devices: Map<string, Map<string, DeviceRecord>> =
  (globalThis as { __devices?: Map<string, Map<string, DeviceRecord>> }).__devices ?? new Map();
(globalThis as { __devices?: Map<string, Map<string, DeviceRecord>> }).__devices = devices;

function key(phone: string): Map<string, DeviceRecord> {
  let m = devices.get(phone);
  if (!m) {
    m = new Map();
    devices.set(phone, m);
  }
  return m;
}

export function isTrustedDevice(phone: string, deviceId: string): boolean {
  if (!deviceId) return false;
  return key(phone).has(deviceId);
}

export function trustDevice(phone: string, deviceId: string): void {
  if (!deviceId) return;
  key(phone).set(deviceId, { trustedAt: Date.now() });
}

export function listDevices(phone: string): Array<{ deviceId: string; trustedAt: number }> {
  return [...key(phone).entries()].map(([deviceId, r]) => ({ deviceId, trustedAt: r.trustedAt }));
}
