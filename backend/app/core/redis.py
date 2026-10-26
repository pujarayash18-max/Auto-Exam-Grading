import logging
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class _NoOpRedis:
    """Fallback stub used when Redis is unavailable (dev-only). Rate limiting is disabled."""

    async def get(self, key):
        return None

    async def set(self, key, value, **kwargs):
        pass

    async def incr(self, key):
        return 1

    async def expire(self, key, seconds):
        pass

    async def delete(self, *keys):
        pass


def _make_client():
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        logger.info("Redis client created (connection will be verified on first use).")
        return client
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis unavailable — using no-op stub. Rate limiting disabled. (%s)", exc)
        return _NoOpRedis()


redis_client = _make_client()
