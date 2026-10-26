import asyncio
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User, LoginAlias
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def list_users():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(LoginAlias, User).join(User, LoginAlias.user_id == User.id))
        rows = result.all()
        for alias, user in rows:
            print(f"Alias: {alias.alias}, Role: {user.role}, ID: {user.id}")

if __name__ == "__main__":
    asyncio.run(list_users())
