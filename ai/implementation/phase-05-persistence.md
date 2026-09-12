# Phase 05 - Persistence

Status: Local repository/schema/provider foundation complete; deployed read/write proof remains.

## Objective
Establish durable campaign storage and repository interfaces without putting timer ticks on the database.

## Scope
- Verify free-tier Supabase first, with Neon as fallback.
- Configure local and Vercel secrets, migrations, seed/empty state, and recovery/export.
- Define repositories for campaign and deliberate session-boundary operations.
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
- Local health check returned HTTP 200 with `{"database": "ok"}`.
- Handled Prisma/pgbouncer URL query parameter sanitization for Vercel Supabase integration compatibility.
- Full test suite now has 17 passing tests.

## Manual setup required before production adapter validation

The user rotated the database password previously exposed in chat, ran the schema in Supabase, and shared the required Vercel integration variables. Real values remain outside the repository. Do not send them through chat or commit them.

See [phase-05-persistence-setup.md](phase-05-persistence-setup.md) for the exact setup and handoff steps.

## Handoff

Adapter selection is now wired and the local provider proof passes. Before declaring Phase 5 complete, expose a deliberate campaign persistence path, deploy it, and run a harmless deployed read/write proof. Portrait storage should be added when player profile implementation begins; live timer state must remain outside the campaign repository.
