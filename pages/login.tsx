import { useState } from "react";
import { useRouter } from "next/router";
import { Geist } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

type Step = "phone" | "code";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setDevCode(data.devCode ?? null);
      setStep("code");
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`${geistSans.variable} flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-black`}
    >
      <main className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.12] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {step === "phone" ? "Sign in" : "Enter code"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {step === "phone"
            ? "We'll send a one-time code to your phone."
            : `Code sent to ${phone}.`}
        </p>

        {step === "phone" ? (
          <form onSubmit={requestCode} className="mt-6 flex flex-col gap-3">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-black outline-none focus:border-black/[.4] dark:border-white/[.16] dark:text-zinc-50 dark:focus:border-white/[.4]"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-lg bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-11 rounded-lg border border-black/[.12] bg-transparent px-3 tracking-[0.3em] text-black outline-none focus:border-black/[.4] dark:border-white/[.16] dark:text-zinc-50 dark:focus:border-white/[.4]"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-lg bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
                setDevCode(null);
              }}
              className="text-sm text-zinc-500 hover:text-black dark:hover:text-zinc-50"
            >
              ← Use a different number
            </button>
          </form>
        )}

        {devCode && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Dev code: <span className="font-mono font-semibold">{devCode}</span>
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </main>
    </div>
  );
}
