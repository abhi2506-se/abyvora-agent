# Platform Owner console (`/admin`)

## ⚠ If nobody can sign in after updating the code
This release adds columns to the `User` table, so **every** sign-in fails until the database is updated.
Run `npm run db:check` to see exactly what is missing, then:

    npx prisma db push
    # restart `npm run dev`

(The login page now says "database schema is out of date…" instead of "Invalid email or password", and the server prints a red warning at boot.)

## First-time setup
1. `npx prisma db push` — adds `Team`, `KnowledgeArticle`, `HealthCheck`, `User.teamId`, `User.lastLoginAt` and indexes (additive only).
2. `OWNER_EMAIL=you@company.com OWNER_PASSWORD='…12+ chars…' npm run create-owner`
3. Sign in at `/login` → you're sent to `/admin/mfa` to enrol/verify an authenticator → then `/admin`.
4. Production runs over **HTTPS** (the middleware reads the `__Secure-` session cookie when `NODE_ENV=production`).

## Optional
- **Uptime KPI / System Health:** set `CRON_SECRET` and call `GET /api/cron/health` every 1–5 min with `Authorization: Bearer $CRON_SECRET`. Without it the dashboard shows "Monitoring not configured".
- **Demo data (development DB only):** `npm run seed:demo` — refuses to run in production or on a non-local database.

## Where things live
- Pages `src/app/admin/(protected)/**` · APIs `src/app/api/admin/**` · UI `src/components/admin/**` · logic `src/lib/admin/**`
- Every page calls `pageGuard()` and every API handler is wrapped in `apiGuard()`; `src/__tests__/admin-structure.test.ts` fails CI if one isn't.
- Revenue rule (one definition everywhere): net = settled payments − processed refunds; failed/cancelled never count.

## Known limits
Sessions are stateless JWTs (can't list/revoke other devices). Services Management is derived from project types (no catalogue table). Language menu is English-only.
