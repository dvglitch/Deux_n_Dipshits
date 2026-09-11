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
        self.connection.commit()

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
        self.connection.commit()

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
