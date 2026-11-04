import asyncio
from app.api.deps import engine
from sqlalchemy import text

async def main():
    print("Migrating Faculty Token Reservation and Allocation schema...")
    try:
        async with engine.begin() as conn:
            # 1. Add columns to faculty_profiles
            await conn.execute(text("ALTER TABLE faculty_profiles ADD COLUMN IF NOT EXISTS token_quota_ceiling BIGINT DEFAULT NULL;"))
            await conn.execute(text("ALTER TABLE faculty_profiles ADD COLUMN IF NOT EXISTS total_tokens_consumed BIGINT NOT NULL DEFAULT 0;"))

            # 2. Add columns to ai_token_usage_logs
            await conn.execute(text("ALTER TABLE ai_token_usage_logs ADD COLUMN IF NOT EXISTS faculty_id INTEGER;"))
            await conn.execute(text("ALTER TABLE ai_token_usage_logs ADD COLUMN IF NOT EXISTS exam_id INTEGER;"))
            await conn.execute(text("ALTER TABLE ai_token_usage_logs ADD COLUMN IF NOT EXISTS reservation_id INTEGER;"))

            # 3. Create exam_token_reservations table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS exam_token_reservations (
                    id SERIAL PRIMARY KEY,
                    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
                    faculty_id INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
                    reservation_type VARCHAR NOT NULL DEFAULT 'VIVA_EVALUATION',
                    estimated_tokens BIGINT NOT NULL DEFAULT 0,
                    tokens_consumed BIGINT NOT NULL DEFAULT 0,
                    tokens_reclaimed BIGINT NOT NULL DEFAULT 0,
                    status VARCHAR NOT NULL DEFAULT 'ACTIVE',
                    notes VARCHAR,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    closed_at TIMESTAMP WITH TIME ZONE
                );
            """))

            # 4. Create indices
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_exam_token_res_exam ON exam_token_reservations (exam_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_exam_token_res_faculty ON exam_token_reservations (faculty_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ai_token_usage_faculty ON ai_token_usage_logs (faculty_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ai_token_usage_exam ON ai_token_usage_logs (exam_id);"))

        print("Migration for Faculty Token Reservations completed successfully!")
    except Exception as e:
        print(f"Migration error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
