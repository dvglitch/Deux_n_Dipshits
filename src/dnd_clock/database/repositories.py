from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Protocol


_COLLECTIONS = ("player_profiles", "spells", "world_maps", "objectives", "recaps")


class CampaignRepository(Protocol):
    def load_collection(self, collection: str) -> list[dict[str, Any]]:
        ...

    def save_collection(self, collection: str, records: list[dict[str, Any]]) -> None:
        ...

    def delete_collection(self, collection: str) -> None:
        ...

    def load_active_session(self) -> dict[str, Any] | None:
        ...

    def save_active_session(
        self, state: dict[str, Any], expected_revision: int | None = None
    ) -> dict[str, Any]:
        ...


class RepositoryError(RuntimeError):
    """Raised when a durable campaign operation cannot be completed."""


def _validate_collection(collection: str) -> None:
    if collection not in _COLLECTIONS:
        raise ValueError(f"Unsupported campaign collection: {collection}")


def _record_payload(record: Any) -> dict[str, Any]:
    if is_dataclass(record):
        return asdict(record)
    if not isinstance(record, dict):
        raise TypeError("Campaign records must be dictionaries or dataclasses")
    return record


class SQLiteCampaignRepository:
    """Small local/test adapter using the same logical shape as production."""

    def __init__(self, database_path: str | Path = ":memory:"):
        self.database_path = str(database_path)
        self.connection = sqlite3.connect(self.database_path)
        self.connection.row_factory = sqlite3.Row
        self._migrate()

    def _migrate(self) -> None:
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS campaign_records (
                collection TEXT NOT NULL,
                record_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (collection, record_id)
            )
            """
        )
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS active_session_state (
                session_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                revision INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self.connection.commit()

    def load_active_session(self) -> dict[str, Any] | None:
        row = self.connection.execute(
            """
            SELECT payload, revision, updated_at
            FROM active_session_state WHERE session_id = 'active'
            """
        ).fetchone()
        if row is None:
            return None
        state = json.loads(row["payload"])
        state["revision"] = row["revision"]
        state["saved_at"] = row["updated_at"]
        return state

    def save_active_session(
        self, state: dict[str, Any], expected_revision: int | None = None
    ) -> dict[str, Any]:
        try:
            payload = json.dumps(state)
            with self.connection:
                if expected_revision is None:
                    self.connection.execute(
                        """
                        INSERT INTO active_session_state (session_id, payload, revision)
                        VALUES ('active', ?, 1)
                        ON CONFLICT(session_id) DO UPDATE SET
                            payload = excluded.payload,
                            revision = active_session_state.revision + 1,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                        (payload,),
                    )
                elif expected_revision == 0:
                    cursor = self.connection.execute(
                        """
                        INSERT INTO active_session_state (session_id, payload, revision)
                        VALUES ('active', ?, 1)
                        ON CONFLICT(session_id) DO NOTHING
                        """,
                        (payload,),
                    )
                    if cursor.rowcount != 1:
                        raise RepositoryError("Active session changed; reload and retry")
                else:
                    cursor = self.connection.execute(
                        """
                        UPDATE active_session_state
                        SET payload = ?, revision = revision + 1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE session_id = 'active' AND revision = ?
                        """,
                        (payload, expected_revision),
                    )
                    if cursor.rowcount != 1:
                        raise RepositoryError("Active session changed; reload and retry")
            saved = self.load_active_session()
            if saved is None:
                raise RepositoryError("Active session disappeared after save")
            return saved
        except (sqlite3.Error, TypeError, ValueError) as error:
            raise RepositoryError("Could not save active session") from error

    def load_collection(self, collection: str) -> list[dict[str, Any]]:
        _validate_collection(collection)
        rows = self.connection.execute(
            "SELECT payload FROM campaign_records WHERE collection = ? ORDER BY record_id",
            (collection,),
        ).fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def save_collection(self, collection: str, records: list[dict[str, Any]]) -> None:
        _validate_collection(collection)
        try:
            with self.connection:
                self.connection.execute(
                    "DELETE FROM campaign_records WHERE collection = ?", (collection,)
                )
                for index, record in enumerate(records):
                    payload = _record_payload(record)
                    record_id = str(payload.get("id", index))
                    self.connection.execute(
                        """
                        INSERT INTO campaign_records (collection, record_id, payload)
                        VALUES (?, ?, ?)
                        """,
                        (collection, record_id, json.dumps(payload)),
                    )
        except (sqlite3.Error, TypeError, ValueError) as error:
            raise RepositoryError(f"Could not save campaign collection {collection}") from error

    def delete_collection(self, collection: str) -> None:
        _validate_collection(collection)
        try:
            with self.connection:
                self.connection.execute(
                    "DELETE FROM campaign_records WHERE collection = ?", (collection,)
                )
        except sqlite3.Error as error:
            raise RepositoryError(f"Could not delete campaign collection {collection}") from error

    def close(self) -> None:
        self.connection.close()


class PostgresCampaignRepository:
    """Supabase/PostgreSQL adapter loaded only when a database URL is configured."""

    def __init__(self, database_url: str):
        if not database_url:
            raise ValueError("DATABASE_URL is required for PostgreSQL persistence")
        try:
            import psycopg
        except ImportError as error:
            raise RepositoryError(
                "PostgreSQL persistence requires the psycopg package"
            ) from error

        self._psycopg = psycopg
        self.connection = psycopg.connect(database_url)
        self._migrate()

    def _migrate(self) -> None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS campaign_records (
                    collection TEXT NOT NULL,
                    record_id TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (collection, record_id)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS active_session_state (
                    session_id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    revision BIGINT NOT NULL DEFAULT 1,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        self.connection.commit()

    def load_active_session(self) -> dict[str, Any] | None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT payload, revision, updated_at
                FROM active_session_state WHERE session_id = 'active'
                """
            )
            row = cursor.fetchone()
        if row is None:
            return None
        state = row[0]
        state["revision"] = row[1]
        state["saved_at"] = row[2].isoformat()
        return state

    def save_active_session(
        self, state: dict[str, Any], expected_revision: int | None = None
    ) -> dict[str, Any]:
        try:
            with self.connection.transaction():
                with self.connection.cursor() as cursor:
                    if expected_revision is None:
                        cursor.execute(
                            """
                            INSERT INTO active_session_state (session_id, payload, revision)
                            VALUES ('active', %s::jsonb, 1)
                            ON CONFLICT(session_id) DO UPDATE SET
                                payload = EXCLUDED.payload,
                                revision = active_session_state.revision + 1,
                                updated_at = NOW()
                            RETURNING revision, updated_at
                            """,
                            (json.dumps(state),),
                        )
                    elif expected_revision == 0:
                        cursor.execute(
                            """
                            INSERT INTO active_session_state (session_id, payload, revision)
                            VALUES ('active', %s::jsonb, 1)
                            ON CONFLICT(session_id) DO NOTHING
                            RETURNING revision, updated_at
                            """,
                            (json.dumps(state),),
                        )
                    else:
                        cursor.execute(
                            """
                            UPDATE active_session_state
                            SET payload = %s::jsonb, revision = revision + 1,
                                updated_at = NOW()
                            WHERE session_id = 'active' AND revision = %s
                            RETURNING revision, updated_at
                            """,
                            (json.dumps(state), expected_revision),
                        )
                    row = cursor.fetchone()
                    if row is None:
                        raise RepositoryError(
                            "Active session changed; reload and retry"
                        )
            saved = dict(state)
            saved["revision"] = row[0]
            saved["saved_at"] = row[1].isoformat()
            return saved
        except (self._psycopg.Error, TypeError, ValueError) as error:
            raise RepositoryError("Could not save active session") from error

    def load_collection(self, collection: str) -> list[dict[str, Any]]:
        _validate_collection(collection)
        with self.connection.cursor() as cursor:
            cursor.execute(
                "SELECT payload FROM campaign_records WHERE collection = %s ORDER BY record_id",
                (collection,),
            )
            return [row[0] for row in cursor.fetchall()]

    def save_collection(self, collection: str, records: list[dict[str, Any]]) -> None:
        _validate_collection(collection)
        try:
            with self.connection.transaction():
                with self.connection.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM campaign_records WHERE collection = %s", (collection,)
                    )
                    for index, record in enumerate(records):
                        payload = _record_payload(record)
                        record_id = str(payload.get("id", index))
                        cursor.execute(
                            """
                            INSERT INTO campaign_records (collection, record_id, payload)
                            VALUES (%s, %s, %s)
                            """,
                            (collection, record_id, json.dumps(payload)),
                        )
        except (self._psycopg.Error, TypeError, ValueError) as error:
            raise RepositoryError(f"Could not save campaign collection {collection}") from error

    def delete_collection(self, collection: str) -> None:
        _validate_collection(collection)
        try:
            with self.connection.transaction():
                with self.connection.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM campaign_records WHERE collection = %s", (collection,)
                    )
        except self._psycopg.Error as error:
            raise RepositoryError(f"Could not delete campaign collection {collection}") from error

    def close(self) -> None:
        self.connection.close()
