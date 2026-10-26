import asyncio
from app.api.deps import get_db
from sqlalchemy import text

async def f():
    async for db in get_db():
        r = await db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'student_viva_runs'"))
        for row in r.fetchall():
            print(row[0], row[1])
        break

asyncio.run(f())
