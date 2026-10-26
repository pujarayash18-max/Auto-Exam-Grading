import asyncio
from sqlalchemy import select
from argon2 import PasswordHasher
from app.core.config import settings
from app.models.user import User, LoginAlias
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def reset():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).join(LoginAlias).where(LoginAlias.alias == "superadmin"))
        user = result.scalars().first()
        if user:
            ph = PasswordHasher()
            user.password_hash = ph.hash("admin")
            session.add(user)
            await session.commit()
            print("Password successfully reset to 'admin'")
        else:
            print("Superadmin user not found")

if __name__ == "__main__":
    asyncio.run(reset())
