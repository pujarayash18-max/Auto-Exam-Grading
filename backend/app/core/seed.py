import asyncio
import os
import secrets
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from argon2 import PasswordHasher

from app.core.config import settings
from app.models.user import User, RoleEnum, LoginAlias

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def seed_superadmin():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).join(LoginAlias).where(LoginAlias.alias == "superadmin")
        )
        existing_admin = result.scalars().first()

        if existing_admin:
            print("Superadmin already exists.")
            return

        env_prod = settings.ENVIRONMENT.lower() == "production"
        password = os.getenv("SUPERADMIN_PASSWORD")
        
        if env_prod and not password:
            print("ERROR: In production, you MUST provide SUPERADMIN_PASSWORD in .env")
            return
            
        if not password:
            password = secrets.token_urlsafe(12)
            print(f"Generated Superadmin password: {password} (Please save this!)")

        print("Creating superadmin user...")
        ph = PasswordHasher()
        hashed = ph.hash(password)

        new_user = User(
            role=RoleEnum.SUPERADMIN,
            password_hash=hashed,
            must_change_password=True,
            active=True
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        # Add alias
        alias = LoginAlias(
            alias="superadmin",
            user_id=new_user.id
        )
        session.add(alias)
        await session.commit()
        print("Superadmin created with alias 'superadmin'.")

if __name__ == "__main__":
    asyncio.run(seed_superadmin())
