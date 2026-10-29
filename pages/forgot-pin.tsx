import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Geist } from "next/font/google";
import Brand from "@/components/Brand";
import OtpInput from "@/components/OtpInput";
import { getDeviceId } from "@/lib/device-id";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

type Step = "phone" | "code" | "pin";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// PIN recovery — a separate path from login. It verifies control of the number
// with an OTP, sets a new PIN, and does NOT create a session.
export default function ForgotPin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const fullPhone = `+91${phone}`;

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await post("/api/otp/request", { phone: fullPhone, deviceId: getDeviceId() });
      if (!data.ok) return setError(data.error);
      setDevCode(data.devCode ?? null);
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function resetPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await post("/api/pin/reset", { phone: fullPhone, code, newPin: pin });
      if (!data.ok) return setError(data.error);
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${geistSans.variable} flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black`}>
      <header className="flex items-center justify-center py-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-start justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-7 shadow-sm dark:border-white/[.12] dark:bg-zinc-950">
          <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Reset your PIN
          </h1>

          {done ? (
            <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
              PIN updated. Redirecting to sign in…
            </p>
          ) : step === "phone" ? (
            <form onSubmit={requestCode} className="mt-6 flex flex-col gap-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                We&apos;ll send a code to confirm it&apos;s your number.
              </p>
              <div className="flex gap-2">
                <span className="flex h-12 items-center rounded-xl border border-black/[.12] px-3 text-sm text-zinc-500 dark:border-white/[.16]">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  placeholder="Mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="h-12 flex-1 rounded-xl border border-black/[.12] bg-transparent px-3 text-black outline-none focus:border-indigo-500 dark:border-white/[.16] dark:text-zinc-50"
                />
              </div>
              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="h-12 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : step === "code" ? (
            <div className="mt-6 flex flex-col gap-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Enter the 6-digit code.</p>
              <OtpInput value={code} onChange={setCode} disabled={loading} />
              <button
                type="button"
                disabled={code.length !== 6}
                onClick={() => setStep("pin")}
                className="h-12 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          ) : (
            <form onSubmit={resetPin} className="mt-6 flex flex-col gap-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Choose a new 4-6 digit PIN.</p>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="New PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 rounded-xl border border-black/[.12] bg-transparent px-3 tracking-[0.3em] text-black outline-none focus:border-indigo-500 dark:border-white/[.16] dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="h-12 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Set new PIN"}
              </button>
            </form>
          )}

          {devCode && !done && (
            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Demo code (no SMS sent): <span className="font-mono font-semibold">{devCode}</span>
            </p>
          )}
          {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

          <p className="mt-6 border-t border-black/[.06] pt-4 text-center text-sm text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
