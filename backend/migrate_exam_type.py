import asyncio
from app.api.deps import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exams';"))
        cols = [r[0] for r in res.fetchall()]
        print("Exams cols:", cols)
        if "exam_type" not in cols:
            await conn.execute(text("ALTER TABLE exams ADD COLUMN exam_type VARCHAR DEFAULT 'ppt_only';"))
            print("Successfully added exam_type column to exams table!")
        else:
            print("exam_type column already present.")

if __name__ == "__main__":
    asyncio.run(main())
