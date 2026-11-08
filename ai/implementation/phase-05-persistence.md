# Phase 05 - Persistence

Status: Campaign persistence is complete. Active-session persistence is implemented and passes isolated local tests; deployment verification is pending.

## Objective
Establish durable campaign storage and active-session snapshots without putting timer ticks on the database.

## Scope
- Verify free-tier Supabase first, with Neon as fallback.
- Configure local and Vercel secrets, migrations, seed/empty state, and recovery/export.
- Define repositories for campaign collections and the active-session snapshot.
- Use local SQLite/in-memory adapters for tests where practical.
- Add portrait storage with replacement and size/type limits.

## Dependencies
Phases 01-04.

## Deliverables
Provider setup guide, schema, migrations, repository adapters, environment checklist, persistence tests, and deployed read/write proof.

## Success criteria
Campaign data survives deployment restart; failed saves are visible; local setup is reproducible; no paid-only service is required.

## Completed locally

- Added provider-neutral `CampaignRepository` protocol.
- Added SQLite adapter for local development and tests.
- Added lazy PostgreSQL adapter for Supabase production use.
- Added `campaign_records` schema and supported durable collections.
- Added transactional collection replacement behavior.
- Added `.env.example` and environment-variable documentation.
- Added 4 repository tests; the full suite now has 14 passing tests.
- Added dotenv loading and environment-based repository selection.
- Updated psycopg to `3.2.13` for Python 3.14 binary-wheel support.
- Verified the local Supabase PostgreSQL connection with `SELECT 1`.
- Verified the PostgreSQL repository initializes the schema and reads all five campaign collections; all are currently empty.
- Added `/api/persistence/health` for a read-only application-level database check.
- Added an `active_session_state` table for durable current-session snapshots, including revision and save time.
- Meaningful live-state mutations are auto-saved; timer ticks use saved timestamps and are not written every tick.
- Reconnects resume the shared active session. The user chose a manual Save Session checkpoint, Start New Session as an intentional reset, and no automatic expiry.
- Local health check returned HTTP 200 with `{"database": "ok"}`.
- Deployed Vercel health check returned HTTP 200 with `{"backend":"PostgresCampaignRepository","database":"ok"}`.
- Handled Prisma/pgbouncer/supa URL query parameter sanitization for Vercel Supabase integration compatibility.
- Full test suite has 17 passing tests.

## Handoff

Campaign PostgreSQL persistence was verified in production with connection pooling and query sanitization. Active-session persistence still requires isolated tests and a controlled preview deployment before relying on it in production.
