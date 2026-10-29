import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Geist } from "next/font/google";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

type Props = { phone: string };

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const session = verifySessionToken(req.cookies[SESSION_COOKIE]);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: { phone: session.phone } };
};

export default function Dashboard({ phone }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div
      className={`${geistSans.variable} flex min-h-screen items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-black`}
    >
      <main className="w-full max-w-md rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.12] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
          You&apos;re signed in
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Authenticated as{" "}
          <span className="font-mono font-medium text-black dark:text-zinc-50">{phone}</span>.
          This page is gated server-side on the session cookie.
        </p>
        <button
          onClick={logout}
          className="mt-6 h-11 w-full rounded-lg border border-black/[.12] font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Log out
        </button>
      </main>
    </div>
  );
}
