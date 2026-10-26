import asyncio
from app.api.deps import engine
from app.models.base import Base
from app.models.ai_billing import AISettings, PrepaidPlan, AITokenUsageLog, TokenRechargeTransaction
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

DEFAULT_PLANS = [
    {
        "id": "plan_starter",
        "name": "Starter Class Pack",
        "tokens": 500000,
        "price_inr": 499.0,
        "description": "Ideal for 1-2 practical classes. Evaluates approx 130 students (650 viva questions).",
        "rate_per_k": 0.998,
        "is_popular": False,
        "badge": "Entry Tier",
        "is_active": True
    },
    {
        "id": "plan_pro",
        "name": "Pro Department Pack",
        "tokens": 2500000,
        "price_inr": 1999.0,
        "description": "Best for mid-semester evaluations. Evaluates approx 680 students (3,400 viva questions).",
        "rate_per_k": 0.799,
        "is_popular": True,
        "badge": "Most Popular",
        "is_active": True
    },
    {
        "id": "plan_campus",
        "name": "Campus Enterprise Pack",
        "tokens": 10000000,
        "price_inr": 6999.0,
        "description": "Full end-semester university batch coverage. Evaluates approx 2,700 students (13,500 questions).",
        "rate_per_k": 0.699,
        "is_popular": False,
        "badge": "Best Value (30% Savings)",
        "is_active": True
    }
]

async def main():
    print("Migrating AI Billing and Settings tables...")
    try:
        async with engine.begin() as conn:
            # Add columns to ai_settings if missing
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS razorpay_key_id VARCHAR;"))
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS razorpay_key_secret VARCHAR;"))
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS youpi_api_url VARCHAR DEFAULT 'http://localhost:6100';"))
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS youpi_checkout_url VARCHAR DEFAULT 'http://localhost:7000';"))
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS youpi_merchant_id VARCHAR DEFAULT '00000000-0000-0000-0000-000000000001';"))
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS youpi_webhook_secret VARCHAR DEFAULT 'sec_youpi_autoexam_webhook_key';"))
            await conn.execute(text("ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS youpi_api_key VARCHAR;"))

            # Add columns to token_recharge_transactions if missing
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS youpi_payment_id VARCHAR;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS gateway_signature VARCHAR;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS invoice_number VARCHAR;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS base_amount_inr FLOAT DEFAULT 0.0;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS gst_amount_inr FLOAT DEFAULT 0.0;"))
            await conn.execute(text("ALTER TABLE token_recharge_transactions ADD COLUMN IF NOT EXISTS utr_reference VARCHAR;"))

            # Create any other missing tables (like prepaid_plans)
            await conn.run_sync(Base.metadata.create_all)
            print("Columns and tables updated!")

        SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with SessionLocal() as db:
            # Seed plans if empty
            res_plans = await db.execute(select(PrepaidPlan))
            if not res_plans.scalars().all():
                for p in DEFAULT_PLANS:
                    db.add(PrepaidPlan(
                        id=p["id"],
                        name=p["name"],
                        tokens=p["tokens"],
                        price_inr=p["price_inr"],
                        description=p["description"],
                        rate_per_k=p["rate_per_k"],
                        is_popular=p["is_popular"],
                        badge=p["badge"],
                        is_active=True
                    ))
                await db.commit()
                print("Seeded dynamic prepaid_plans table!")

            res = await db.execute(select(AISettings).limit(1))
            settings_row = res.scalars().first()
            if settings_row:
                # Reset mock balance to real 0
                settings_row.token_balance = 0
                settings_row.wallet_balance_inr = 0.0
                settings_row.total_tokens_used = 0
                settings_row.total_cost_spent_inr = 0.0
                await db.commit()
                print("Mock balances successfully reset to real 0!")
    except Exception as e:
        print(f"Migration error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
