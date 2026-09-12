# Phase 05 Persistence Setup

Status: Complete. Database persistence verified locally and on Vercel deployment.

## Current design

- Campaign data uses provider-neutral collection repositories.
- SQLite is the local/test adapter.
- PostgreSQL is the production adapter for Supabase.
- `campaign_records` stores durable campaign collections as JSON payloads.
- Live combat state is intentionally not stored in this table and timer ticks must not write to the database.
- Supported collections: `player_profiles`, `spells`, `world_maps`, `objectives`, and `recaps`.
- A collection replacement runs inside a transaction so a deliberate save does not leave a partial collection.

## Files

- `src/dnd_clock/database/repositories.py`: repository protocol, SQLite adapter, PostgreSQL adapter.
- `src/dnd_clock/database/factory.py`: PostgreSQL-or-SQLite selection from environment configuration.
- `src/dnd_clock/config.py`: local `.env` loading and deployment environment lookup.
- `src/dnd_clock/database/schema.sql`: production schema.
- `.env.example`: names of local/deployment variables without values.
- `tests/test_retained_behavior.py`: local repository tests.

## Secrets and environment variables

Do not put real values in git, chat, or project notes. Add them manually.

### Local development

Create an untracked `.env` or configure the VS Code/PowerShell environment with:

```text
DATABASE_URL=<Supabase pooled PostgreSQL connection string>
SUPABASE_URL=<Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only key, if storage integration needs it>
SUPABASE_STORAGE_BUCKET=player-portraits
```

Local `.env` loading and runtime adapter selection are now wired. The application still does not perform campaign reads/writes on ordinary page import; that deliberate workflow belongs in the next persistence integration step.

### Vercel

In Vercel Project Settings -> Environment Variables, add the same variables to Production and Preview as needed. Use the pooled/database connection string recommended by Supabase for server-side/serverless connections. Never use or expose a service-role key in browser JavaScript.

The user must enter the values directly in Supabase/Vercel. The assistant does not need to receive them.

## Supabase steps

1. Rotate the database password previously exposed in chat.
2. In Supabase, open the project settings and obtain the pooled PostgreSQL connection string. Do not paste it into chat.
3. Run `src/dnd_clock/database/schema.sql` in the Supabase SQL Editor, or use the migration mechanism chosen for deployment.
4. Confirm the `campaign_records` table exists and is empty/ready.
5. Create the `player-portraits` Storage bucket only when portrait implementation begins. Keep it private unless the display architecture explicitly requires public URLs.
6. Add `DATABASE_URL` to local/Vercel environments manually.
7. Deploy a preview after the runtime adapter is wired, then run a harmless campaign read/write proof.

## Recovery/export

Before production campaign writes:

- Use Supabase's database export/backup capability available on the current free plan.
- Keep a copy of the schema migration in git.
- Test exporting `campaign_records` and restoring it to a disposable local database.
- Do not treat disposable combat state as recoverable campaign data.

## Current pause point

The repository and schema code now pass local provider validation. A read-only application health endpoint is available at `/api/persistence/health`.

## Health check

With the local app running, open:

```text
http://localhost:5000/api/persistence/health
```

Expected response:

```json
{"database": "ok"}
```

If the database connection fails, the endpoint returns HTTP `503` with:

```json
{"database": "error"}
```

The endpoint does not return connection details, secrets, or campaign data. It opens the configured repository, reads the player-profile collection, and closes the connection.

After pushing to Vercel, run the same check against:

```text
https://deux-n-dipshits.vercel.app/api/persistence/health
```

The remaining Phase 5 gate is a controlled campaign read/write proof through a deliberate maintenance service. Live timer state must remain outside that proof.
