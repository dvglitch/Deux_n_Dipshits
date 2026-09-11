-- DnD Clock campaign persistence schema.
-- Live combat state is intentionally not stored here.

CREATE TABLE IF NOT EXISTS campaign_records (
    collection TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection, record_id)
);

CREATE INDEX IF NOT EXISTS campaign_records_collection_idx
    ON campaign_records (collection);
