import os
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def _sanitize_db_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.query:
        return url
    query_params = parse_qs(parsed.query)
    # Remove parameters that Prisma uses but psycopg rejects
    query_params.pop("pgbouncer", None)
    new_query = urlencode(query_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def database_url() -> str | None:
    """Return the preferred server-side PostgreSQL connection string."""
    raw_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
    )
    return _sanitize_db_url(raw_url)


def supabase_url() -> str | None:
    return os.getenv("SUPABASE_URL")


def storage_bucket() -> str:
    return os.getenv("SUPABASE_STORAGE_BUCKET", "player-portraits")
