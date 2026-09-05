# Phase 05 - Persistence

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
