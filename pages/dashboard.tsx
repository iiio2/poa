import { useCallback, useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Geist } from "next/font/google";
import Brand from "@/components/Brand";
import { REFRESH_COOKIE, verifyRefresh } from "@/lib/tokens";

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

type SessionState = {
  access: { valid: boolean; expiresInSec: number | null };
  refresh: { valid: boolean; expiresInSec: number | null };
  phone: string | null;
  deviceId: string | null;
  trusted: boolean;
};

type MeState = {
  authenticated: boolean;
  deviceId?: string;
  trusted?: boolean;
  hasPin?: boolean;
};

/** Fetch that transparently refreshes the access token once on a 401. */
async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 401) {
    const r = await fetch("/api/token/refresh", { method: "POST" });
    if (r.ok) res = await fetch(url, init);
  }
  return res;
}

export default function Dashboard({ phone }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [me, setMe] = useState<MeState | null>(null);
  const [pin, setPin] = useState("");
  const [log, setLog] = useState<string>("Ready.");
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const [s, m] = await Promise.all([
      fetch("/api/session").then((r) => r.json()),
      authedFetch("/api/me").then((r) => r.json()),
    ]);
    setSession(s);
    setMe(m);
  }, []);

  useEffect(() => {
    // Fetch session + profile on mount (setState runs after the await, not sync).
    // oxlint-disable-next-line react/set-state-in-effect
    refresh();
  }, [refresh]);

  // Re-render every second for live countdowns.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  async function doRefresh() {
    const res = await fetch("/api/token/refresh", { method: "POST" });
    const data = await res.json();
    setLog(res.ok ? "Access token refreshed (refresh token rotated)." : `Refresh failed: ${data.error}`);
    refresh();
  }

  async function callProtected() {
    const res = await authedFetch("/api/me");
    const data = await res.json();
    setLog(
      data.authenticated
        ? `GET /api/me → 200 (phone ${data.phone}, trusted ${data.trusted})`
        : `GET /api/me → 401 (${data.error})`,
    );
    refresh();
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    const res = await authedFetch("/api/pin/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    setLog(res.ok ? "Transaction PIN set." : `PIN error: ${data.error}`);
    setPin("");
    refresh();
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
        {/* Balance card */}
        <section className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white shadow-sm">
          <p className="text-sm text-white/80">Wallet balance</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">₹ 1,245.00</p>
          <p className="mt-4 text-xs text-white/70">
            Signed in as <span className="font-mono">{phone}</span>
          </p>
        </section>

        {/* Quick actions */}
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

        {/* Recent activity */}
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
          session={session}
          me={me}
          pin={pin}
          setPin={setPin}
          log={log}
          onRefresh={doRefresh}
          onCallProtected={callProtected}
          onSavePin={savePin}
        />
      </main>
    </div>
  );
}

function fmt(sec: number | null): string {
  if (sec == null) return "—";
  if (sec <= 0) return "expired";
  if (sec < 120) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
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
  session,
  me,
  pin,
  setPin,
  log,
  onRefresh,
  onCallProtected,
  onSavePin,
}: {
  session: SessionState | null;
  me: MeState | null;
  pin: string;
  setPin: (v: string) => void;
  log: string;
  onRefresh: () => void;
  onCallProtected: () => void;
  onSavePin: (e: React.FormEvent) => void;
}) {
  const deviceId = session?.deviceId ?? me?.deviceId ?? "";
  const shortDevice = deviceId ? `${deviceId.slice(0, 8)}…` : "—";

  return (
    <section className="mt-8 rounded-2xl border border-dashed border-indigo-300/70 bg-indigo-50/30 p-5 dark:border-indigo-500/30 dark:bg-indigo-500/5">
      <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        Auth lifecycle (developer view)
      </h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Live view of the device-binding and token stages.
      </p>

      <div className="mt-4 divide-y divide-black/[.06] dark:divide-white/[.08]">
        <Row label="Device">
          {shortDevice}{" "}
          {session?.trusted || me?.trusted ? (
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
          {session?.access.valid ? `valid · ${fmt(session.access.expiresInSec)}` : "none / expired"}
        </Row>
        <Row label="Refresh token">
          {session?.refresh.valid ? `valid · ${fmt(session.refresh.expiresInSec)}` : "none"}
        </Row>
        <Row label="Transaction PIN">{me?.hasPin ? "set" : "not set"}</Row>
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

      <form onSubmit={onSavePin} className="mt-4 flex gap-2">
        <input
          type="password"
          inputMode="numeric"
          placeholder="Set 4-6 digit PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-10 flex-1 rounded-lg border border-black/[.12] bg-transparent px-3 text-sm text-black outline-none focus:border-indigo-500 dark:border-white/[.16] dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={pin.length < 4}
          className="rounded-lg border border-black/[.12] px-3 text-sm font-medium text-black hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Save PIN
        </button>
      </form>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-black/[.04] p-3 text-xs text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300">
        {log}
      </pre>
    </section>
  );
}
