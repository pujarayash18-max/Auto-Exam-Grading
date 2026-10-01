from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Request
from app.core.config import settings
from app.core.redis import redis_client

ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def record_failed_login(ip: str, login_id: str) -> None:
    ip_key = f"lockout:ip:{ip}"
    user_key = f"lockout:user:{login_id}"
    
    await redis_client.incr(ip_key)
    await redis_client.expire(ip_key, 15 * 60) # 15 minutes
    
    await redis_client.incr(user_key)
    await redis_client.expire(user_key, 15 * 60)

async def check_lockout(ip: str, login_id: str) -> bool:
    ip_attempts = await redis_client.get(f"lockout:ip:{ip}")
    user_attempts = await redis_client.get(f"lockout:user:{login_id}")
    
    if (ip_attempts and int(ip_attempts) >= 5) or (user_attempts and int(user_attempts) >= 5):
        return True
    return False

async def clear_lockout(ip: str, login_id: str) -> None:
    await redis_client.delete(f"lockout:ip:{ip}")
    await redis_client.delete(f"lockout:user:{login_id}")
