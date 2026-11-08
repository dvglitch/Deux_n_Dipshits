-- DnD Clock campaign persistence schema.
-- Active session state is saved as a canonical snapshot between meaningful changes.

CREATE TABLE IF NOT EXISTS campaign_records (
    collection TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection, record_id)
);

CREATE INDEX IF NOT EXISTS campaign_records_collection_idx
    ON campaign_records (collection);

CREATE TABLE IF NOT EXISTS active_session_state (
    session_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
