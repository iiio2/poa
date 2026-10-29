import type { GetServerSideProps } from "next";
import { REFRESH_COOKIE, verifyRefresh } from "@/lib/tokens";

// Landing: a valid (non-revoked) refresh token means an active session.
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const session = verifyRefresh(req.cookies[REFRESH_COOKIE]);
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
