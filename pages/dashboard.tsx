import { useCallback, useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Geist } from "next/font/google";
import Brand from "@/components/Brand";
import { REFRESH_COOKIE, verifyRefresh } from "@/lib/tokens";
import { apiGet, apiPost, authedFetch } from "@/lib/client";
import type { MeResponse, PinSetResponse, RefreshResponse, SessionResponse } from "@/lib/api-types";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

type Props = { phone: string };

// Page gate: a valid refresh token means an active session. (Access tokens are
// short-lived and refreshed client-side for API calls.)
export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const session = verifyRefresh(req.cookies[REFRESH_COOKIE]);
  if (!session) return { redirect: { destination: "/login", permanent: false } };
  return { props: { phone: session.sub } };
};

const ACTIONS = ["Scan & Pay", "To Mobile", "To Bank", "Add Money"];
const ACTIVITY = [
  { name: "Chai Point", when: "Today, 9:12 AM", amount: -45 },
  { name: "Received from Ravi", when: "Yesterday", amount: 500 },
  { name: "Metro Recharge", when: "Mon", amount: -120 },
];

export default function Dashboard({ phone }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [me, setMe] = useState<Extract<MeResponse, { ok: true }> | null>(null);
  const [accessExpAt, setAccessExpAt] = useState<number | null>(null);
  const [refreshExpAt, setRefreshExpAt] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [log, setLog] = useState("Ready.");

  const reload = useCallback(async () => {
    try {
      const meRes = await authedFetch("/api/me");
      if (meRes.status === 401) {
        router.push("/login");
        return;
      }
      const m = (await meRes.json()) as MeResponse;
      setMe(m.ok ? m : null);

      const s = await apiGet<SessionResponse>("/api/session");
      setSession(s);
      const base = Date.now();
      setAccessExpAt(s.access.valid && s.access.expiresInSec != null ? base + s.access.expiresInSec * 1000 : null);
      setRefreshExpAt(s.refresh.valid && s.refresh.expiresInSec != null ? base + s.refresh.expiresInSec * 1000 : null);
    } catch {
      setLog("Network error while loading session.");
    }
  }, [router]);

  useEffect(() => {
    // Load on mount, then keep the panel in sync (authedFetch auto-refreshes
    // access when it has expired). setState runs after the awaits, not sync.
    // oxlint-disable-next-line react/set-state-in-effect
    reload();
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [reload]);

  async function logout() {
    try {
      await apiPost("/api/logout");
    } catch {
      /* ignore — navigate away regardless */
    } finally {
      router.push("/login");
    }
  }

  async function doRefresh() {
    try {
      const data = await apiPost<RefreshResponse>("/api/token/refresh");
      setLog(data.ok ? "Access token refreshed (refresh token rotated)." : `Refresh failed: ${data.error}`);
      await reload();
    } catch {
      setLog("Network error during refresh.");
    }
  }

  async function callProtected() {
    try {
      const res = await authedFetch("/api/me");
      if (res.status === 401) {
        setLog("Session lost — redirecting to login.");
        router.push("/login");
        return;
      }
      const data = (await res.json()) as MeResponse;
      setLog(
        data.ok
          ? `GET /api/me → 200 (phone ${data.phone}, trusted ${data.trusted})`
          : `GET /api/me → 401 (${data.error})`,
      );
      await reload();
    } catch {
      setLog("Network error calling /api/me.");
    }
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = me?.hasPin ? { pin, currentPin } : { pin };
      const res = await authedFetch("/api/pin/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as PinSetResponse;
      setLog(data.ok ? "Transaction PIN saved." : `PIN error: ${data.error}`);
      setPin("");
      setCurrentPin("");
      await reload();
    } catch {
      setLog("Network error saving PIN.");
    }
  }

  return (
    <div className={`${geistSans.variable} min-h-screen bg-zinc-50 font-sans dark:bg-black`}>
      <header className="flex items-center justify-between border-b border-black/[.06] px-4 py-4 dark:border-white/[.08]">
        <Brand />
        <button
          onClick={logout}
          className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <section className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white shadow-sm">
          <p className="text-sm text-white/80">Wallet balance</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">₹ 1,245.00</p>
          <p className="mt-4 text-xs text-white/85">
            Signed in as <span className="font-mono">{phone}</span>
          </p>
        </section>

        <section className="mt-6 grid grid-cols-4 gap-3">
          {ACTIONS.map((label) => (
            <button
              key={label}
              className="flex flex-col items-center gap-2 rounded-xl border border-black/[.06] bg-white p-3 text-center text-xs font-medium text-zinc-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-white/[.08] dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[.04]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                ₹
              </span>
              {label}
            </button>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Recent activity</h2>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded-2xl border border-black/[.06] bg-white dark:divide-white/[.08] dark:border-white/[.08] dark:bg-zinc-950">
            {ACTIVITY.map((tx) => (
              <li key={tx.name} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-black dark:text-zinc-50">{tx.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{tx.when}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    tx.amount < 0 ? "text-zinc-800 dark:text-zinc-200" : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {tx.amount < 0 ? "−" : "+"}₹{Math.abs(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <AuthPanel
          trusted={Boolean(session?.trusted || me?.trusted)}
          deviceId={session?.deviceId ?? me?.deviceId ?? ""}
          hasPin={Boolean(me?.hasPin)}
          accessExpAt={accessExpAt}
          refreshExpAt={refreshExpAt}
          pin={pin}
          setPin={setPin}
          currentPin={currentPin}
          setCurrentPin={setCurrentPin}
          log={log}
          onRefresh={doRefresh}
          onCallProtected={callProtected}
          onSavePin={savePin}
        />
      </main>
    </div>
  );
}

function fmt(sec: number): string {
  if (sec <= 0) return "expired";
  if (sec < 120) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

// Self-ticking so only this node re-renders each second (not the whole page).
// `now` is read from state (set in the interval callback) so render stays pure.
function Countdown({ expAt }: { expAt: number | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    // oxlint-disable-next-line react/set-state-in-effect
    update(); // initial clock sync
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  if (expAt == null) return <>none / expired</>;
  if (now === 0) return <>…</>;
  const remaining = Math.max(0, Math.round((expAt - now) / 1000));
  return <>{remaining > 0 ? `valid · ${fmt(remaining)}` : "expired"}</>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-black dark:text-zinc-50">{children}</span>
    </div>
  );
}

function AuthPanel({
  trusted,
  deviceId,
  hasPin,
  accessExpAt,
  refreshExpAt,
  pin,
  setPin,
  currentPin,
  setCurrentPin,
  log,
  onRefresh,
  onCallProtected,
  onSavePin,
}: {
  trusted: boolean;
  deviceId: string;
  hasPin: boolean;
  accessExpAt: number | null;
  refreshExpAt: number | null;
  pin: string;
  setPin: (v: string) => void;
  currentPin: string;
  setCurrentPin: (v: string) => void;
  log: string;
  onRefresh: () => void;
  onCallProtected: () => void;
  onSavePin: (e: React.FormEvent) => void;
}) {
  const shortDevice = deviceId ? `${deviceId.slice(0, 8)}…` : "—";

  return (
    <section className="mt-8 rounded-2xl border border-dashed border-indigo-300/70 bg-indigo-50/30 p-5 dark:border-indigo-500/30 dark:bg-indigo-500/5">
      <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Auth lifecycle (developer view)</h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Live view of the device-binding and token stages.
      </p>

      <div className="mt-4 divide-y divide-black/[.06] dark:divide-white/[.08]">
        <Row label="Device">
          {shortDevice}{" "}
          {trusted ? (
            <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-400">
              TRUSTED
            </span>
          ) : (
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              NEW
            </span>
          )}
        </Row>
        <Row label="Access token">
          <Countdown expAt={accessExpAt} />
        </Row>
        <Row label="Refresh token">
          <Countdown expAt={refreshExpAt} />
        </Row>
        <Row label="Transaction PIN">{hasPin ? "set" : "not set"}</Row>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onRefresh}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Refresh access token
        </button>
        <button
          onClick={onCallProtected}
          className="rounded-lg border border-black/[.12] px-3 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Call protected /api/me
        </button>
      </div>

      <form onSubmit={onSavePin} className="mt-4 flex flex-col gap-2">
        {hasPin && (
          <input
            type="password"
            inputMode="numeric"
            aria-label="Current PIN"
            placeholder="Current PIN (required to change)"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-10 rounded-lg border border-black/[.12] bg-transparent px-3 text-sm text-black outline-none focus:border-indigo-500 dark:border-white/[.16] dark:text-zinc-50"
          />
        )}
        <div className="flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            aria-label={hasPin ? "New PIN" : "Set PIN"}
            placeholder={hasPin ? "New 4-6 digit PIN" : "Set 4-6 digit PIN"}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-10 min-w-0 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-sm text-black outline-none focus:border-indigo-500 dark:border-white/[.16] dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={pin.length < 4 || (hasPin && currentPin.length < 4)}
            className="rounded-lg border border-black/[.12] px-3 text-sm font-medium text-black hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
          >
            Save PIN
          </button>
        </div>
      </form>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-black/[.04] p-3 text-xs text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300">
        {log}
      </pre>
    </section>
  );
}
