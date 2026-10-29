# PayMock — simulated wallet auth

A Next.js (pages router) demo of a **wallet-style OTP authentication lifecycle**,
built entirely self-contained: OTPs are generated locally (no SMS, no third-party
service), and sessions run on your own signed tokens. It's a starting point for
building your own payments-style app and seeing the full auth flow work.

## Features

- **Phone + OTP login** — country code, auto-advancing 6-box OTP input, resend timer
- **Device verification** — new devices are detected and bound as trusted on verify
- **Token exchange** — short-lived access token + rotating refresh token (revocable)
- **Session readiness** — protected API (`/api/me`) with auto-refresh on 401
- **PIN set & recovery** — recovery is a separate OTP-gated path (no session issued)
- **Live auth panel** on the dashboard to watch each stage in real time

## Run

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

Enter any 10-digit number. The 6-digit code appears on screen and in the server
console (no SMS is sent). Then explore the dashboard's **Auth lifecycle** panel.

### Environment

Copy `.env.example` → `.env.local`:

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | HMAC key for tokens (`openssl rand -hex 32`) |
| `MOCK_OTP_CODE` | force a fixed OTP code (e.g. `123456`) |

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | start the dev server |
| `pnpm build` / `pnpm start` | production build / serve |
| `pnpm lint` / `pnpm lint:fix` | oxlint check / autofix |

## Project structure

```
lib/        crypto, tokens, otp-store, devices, users, device-id
pages/      login, forgot-pin, dashboard, index (redirect)
pages/api/  otp/{request,verify}, token/refresh, pin/{set,reset}, me, session, logout
components/ OtpInput, Brand
docs/       AUTH.md — full stage map, fields, headers, config, state
```

## Auth lifecycle

See **[docs/AUTH.md](docs/AUTH.md)** for the complete flow diagram and a mapping
of every stage to its source file, request fields, headers, config and state.

## Notes

- All stores are **in-memory** and reset on dev reload — fine for a mock.
- To productionize *your own* app: swap the in-memory stores for a datastore and
  the OTP "send" for a real SMS provider. The route/token/UI layers don't change.
