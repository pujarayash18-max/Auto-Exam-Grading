import asyncio
from app.api.deps import AsyncSessionLocal
from sqlalchemy import text

async def f():
    async with AsyncSessionLocal() as s:
        res = await s.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_viva_answers'"))
        print("answers cols:", [r[0] for r in res.all()])
        res2 = await s.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_viva_runs'"))
        print("runs cols:", [r[0] for r in res2.all()])

if __name__ == "__main__":
    asyncio.run(f())
