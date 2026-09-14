import os
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

# Standard libpq connection parameters recognized by psycopg
VALID_LIBPQ_PARAMS = {
    "host",
    "hostaddr",
    "port",
    "dbname",
    "user",
    "password",
    "passfile",
    "channel_binding",
    "connect_timeout",
    "client_encoding",
    "options",
    "application_name",
    "fallback_application_name",
    "keepalives",
    "keepalives_idle",
    "keepalives_interval",
    "keepalives_count",
    "tcp_user_timeout",
    "sslmode",
    "sslcompression",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "sslcrl",
    "sslcrlpath",
    "sslsni",
    "requirepeer",
    "ssl_min_protocol_version",
    "ssl_max_protocol_version",
    "gssencmode",
    "krbsrvname",
    "gssdelegation",
    "target_session_attrs",
    "load_balance_hosts",
}


def _sanitize_db_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.query:
        return url
    query_params = parse_qs(parsed.query)
    # Only keep valid libpq parameters; drop custom provider params like pgbouncer, supa, etc.
    cleaned_params = {
        k: v for k, v in query_params.items() if k.lower() in VALID_LIBPQ_PARAMS
    }
    new_query = urlencode(cleaned_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def database_url() -> str | None:
    """Return the preferred server-side PostgreSQL connection string.
    
    Prefers pooled connections (POSTGRES_URL / POSTGRES_PRISMA_URL) which support
    IPv4 on serverless hosts like Vercel over direct IPv6 connections (port 5432).
    """
    raw_url = (
        os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
    )
    return _sanitize_db_url(raw_url)


def supabase_url() -> str | None:
    return os.getenv("SUPABASE_URL")


