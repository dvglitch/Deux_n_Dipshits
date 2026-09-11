import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def database_url() -> str | None:
    """Return the preferred server-side PostgreSQL connection string."""
    return os.getenv("DATABASE_URL") or os.getenv("POSTGRES_PRISMA_URL") or os.getenv("POSTGRES_URL")


def supabase_url() -> str | None:
    return os.getenv("SUPABASE_URL")


def storage_bucket() -> str:
    return os.getenv("SUPABASE_STORAGE_BUCKET", "player-portraits")
