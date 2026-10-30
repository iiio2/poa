import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Geist } from "next/font/google";
import Brand from "@/components/Brand";
import OtpInput from "@/components/OtpInput";
import { getDeviceId } from "@/lib/device-id";
import { apiPost } from "@/lib/client";
import type { OtpRequestResponse, OtpVerifyResponse } from "@/lib/api-types";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

type Step = "phone" | "code";

const RESEND_SECONDS = 30;

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [newDevice, setNewDevice] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  const fullPhone = `${countryCode}${phone}`;
  const maskedPhone = phone ? `${countryCode} •••••${phone.slice(-3)}` : "";

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendCode() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<OtpRequestResponse>("/api/otp/request", {
        phone: fullPhone,
        deviceId: getDeviceId(),
      });
      if (!data.ok) {
        setError(data.error);
        if ("retryAfterSec" in data && data.retryAfterSec) setResendIn(data.retryAfterSec);
        return false;
      }
      setDevCode(data.devCode ?? null);
      setNewDevice(data.newDevice);
      setResendIn(RESEND_SECONDS);
      return true;
    } catch {
      setError("Network error. Is the dev server running?");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    const ok = await sendCode();
    if (ok) {
      setStep("code");
      setCode("");
      setFocusSignal((n) => n + 1);
    }
  }

  async function verify(fullCode: string) {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<OtpVerifyResponse>("/api/otp/verify", {
        phone: fullPhone,
        code: fullCode,
        deviceId: getDeviceId(),
      });
      if (!data.ok) {
        setError(data.error);
        setCode("");
        setFocusSignal((n) => n + 1); // return focus to the first box
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
    <div className={`${geistSans.variable} flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black`}>
      <header className="flex items-center justify-center py-6">
        <Brand />
      </header>

      <main className="flex flex-1 items-start justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-7 shadow-sm dark:border-white/[.12] dark:bg-zinc-950">
          {step === "phone" ? (
            <PhoneStep
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              onSubmit={handlePhoneSubmit}
            />
          ) : (
            <CodeStep
              maskedPhone={maskedPhone}
              newDevice={newDevice}
              code={code}
              setCode={setCode}
              loading={loading}
              resendIn={resendIn}
              invalid={Boolean(error)}
              focusSignal={focusSignal}
              onComplete={verify}
              onResend={sendCode}
              onBack={() => {
                setStep("phone");
                setCode("");
                setError(null);
                setDevCode(null);
              }}
            />
          )}

          {devCode && (
            <p
              aria-live="polite"
              className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              Demo code (no SMS sent): <span className="font-mono font-semibold">{devCode}</span>
            </p>
          )}
          {error && (
            <p id="login-error" role="alert" className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <p className="mt-6 border-t border-black/[.06] pt-4 text-center text-sm text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">
            Forgot your PIN?{" "}
            <Link href="/forgot-pin" className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              Reset it
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Demo wallet app · OTP is simulated locally
      </footer>
    </div>
  );
}

function PhoneStep({
  countryCode,
  setCountryCode,
  phone,
  setPhone,
  loading,
  onSubmit,
}: {
  countryCode: string;
  setCountryCode: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">Enter mobile number</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        We&apos;ll send a one-time code to verify it&apos;s you.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            aria-label="Country code"
            className="h-12 rounded-xl border border-black/[.12] bg-transparent px-2 text-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/[.16] dark:text-zinc-50 dark:[&>option]:bg-zinc-900"
          >
            <option value="+91">🇮🇳 +91</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+971">🇦🇪 +971</option>
          </select>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            aria-label="Mobile number"
            placeholder="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="h-12 flex-1 rounded-xl border border-black/[.12] bg-transparent px-3 text-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/[.16] dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-xl bg-indigo-600 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Continue"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        By continuing you agree to the demo Terms. No real messages are sent.
      </p>
    </>
  );
}

function CodeStep({
  maskedPhone,
  newDevice,
  code,
  setCode,
  loading,
  resendIn,
  invalid,
  focusSignal,
  onComplete,
  onResend,
  onBack,
}: {
  maskedPhone: string;
  newDevice: boolean;
  code: string;
  setCode: (v: string) => void;
  loading: boolean;
  resendIn: number;
  invalid: boolean;
  focusSignal: number;
  onComplete: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  // Guard so a submit fires once per completed entry (covers auto-submit + button).
  const submitted = useRef(false);
  useEffect(() => {
    if (code.length !== 6) submitted.current = false;
  }, [code]);

  function submit(full: string) {
    if (submitted.current || loading) return;
    submitted.current = true;
    onComplete(full);
  }

  return (
    <>
      <button type="button" onClick={onBack} className="text-sm text-zinc-500 hover:text-black dark:hover:text-zinc-50">
        ← Back
      </button>
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-black dark:text-zinc-50">Verify your number</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Enter the 6-digit code sent to{" "}
        <span className="font-medium text-black dark:text-zinc-50">{maskedPhone}</span>
      </p>

      {newDevice && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          <span aria-hidden>🛡️</span> New device detected — verifying it with this code.
        </p>
      )}

      <div className="mt-6">
        <OtpInput
          value={code}
          onChange={setCode}
          disabled={loading}
          invalid={invalid}
          errorId="login-error"
          autoFocus
          focusSignal={focusSignal}
          onComplete={submit}
        />
      </div>

      <button
        type="button"
        disabled={loading || code.length !== 6}
        onClick={() => submit(code)}
        className="mt-5 h-12 w-full rounded-xl bg-indigo-600 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Verify"}
      </button>

      <div className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {resendIn > 0 ? (
          <span>Resend code in {resendIn}s</span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Resend code
          </button>
        )}
      </div>
    </>
  );
}
