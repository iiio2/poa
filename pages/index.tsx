import type { GetServerSideProps } from "next";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Landing: route to the dashboard when signed in, otherwise to login.
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const session = verifySessionToken(req.cookies[SESSION_COOKIE]);
  return {
    redirect: {
      destination: session ? "/dashboard" : "/login",
      permanent: false,
    },
  };
};

export default function Home() {
  return null;
}
