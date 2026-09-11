from .repositories import CampaignRepository, PostgresCampaignRepository, SQLiteCampaignRepository
from ..config import database_url


def create_campaign_repository(
    *,
    database_url_override: str | None = None,
    sqlite_path: str = ":memory:",
) -> CampaignRepository:
    """Create a repository without connecting during module import.

    PostgreSQL is selected when a deployment/local connection string exists;
    SQLite remains the deterministic fallback for tests and offline development.
    """
    configured_url = database_url() if database_url_override is None else database_url_override
    if configured_url:
        return PostgresCampaignRepository(configured_url)
    return SQLiteCampaignRepository(sqlite_path)
