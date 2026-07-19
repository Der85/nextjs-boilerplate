# Der's Tracker

A private, mobile-first personal tracker — daily medication logging, weekly weight,
and monthly finances. Single-user, installable as a PWA, with push reminders.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth) · Web Push (VAPID) · Vercel Cron
- **Deploy target:** Vercel, domain `adhder.io`

## Local setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in the values (see below).
3. `npm run dev` → http://localhost:3000

## Environment variables

| Var | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API settings (secret — cron only) |
| `NEXT_PUBLIC_APP_URL` | `https://adhder.io` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | any long random string; also set on Vercel |
| `ALLOWED_EMAIL` | your email — the only account allowed to use the app |

## Database

Run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
in the Supabase SQL editor. It creates every table with RLS locked to `auth.uid()`.

After you've signed up once (`/signup`), uncomment the seed block at the bottom of
that migration and run it while authenticated to seed your medications and finance
accounts.

## Auth model

Real Supabase email/password auth, but single-user. [`proxy.ts`](proxy.ts) (Next 16's
middleware) protects everything except `/login`, `/signup`, `/api/cron/*`, and
`/api/push/*`. Any logged-in user whose email ≠ `ALLOWED_EMAIL` is signed out —
defense-in-depth if anyone else ever signs up.

## Push reminders

Vercel Cron hits `GET /api/cron/reminders` daily at 08:00 (see [`vercel.json`](vercel.json)),
authenticated with `CRON_SECRET`. It sends **meds** daily, **weight** on Sundays, and
**finance** on the 1st — de-duped per day via `reminder_log`. Enable reminders from the
in-app header button (registers the service worker and subscribes this device).

## Verify

```bash
npm run build   # type-checks + production build
npm run lint    # ESLint
```
