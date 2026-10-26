from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Float, Boolean, Text, DateTime
from app.models.base import Base

class AISettings(Base):
    __tablename__ = "ai_settings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Active Provider & Model Selection
    active_provider = Column(String, default="gemini", nullable=False) # "gemini", "openai", "claude", "ollama"
    active_model = Column(String, default="gemini-1.5-flash", nullable=False) 
    
    # API Keys
    gemini_api_key = Column(String, nullable=True)
    openai_api_key = Column(String, nullable=True)
    claude_api_key = Column(String, nullable=True)
    ollama_host = Column(String, default="http://localhost:11434", nullable=True)
    
    # Dynamic Gateway & Merchant Configuration
    razorpay_key_id = Column(String, nullable=True)
    razorpay_key_secret = Column(String, nullable=True)
    merchant_upi_id = Column(String, default="autoexam.billing@icici", nullable=True)
    merchant_name = Column(String, default="AutoExam Examination Cell", nullable=True)
    gst_rate_percent = Column(Float, default=18.0, nullable=False)
    gateway_mode = Column(String, default="YOUPI", nullable=False) # "YOUPI", "HYBRID", "RAZORPAY"

    # YouPI-PG Sovereign Gateway Configuration
    youpi_api_url = Column(String, default="http://localhost:6100", nullable=True)
    youpi_checkout_url = Column(String, default="http://localhost:7000", nullable=True)
    youpi_merchant_id = Column(String, default="00000000-0000-0000-0000-000000000001", nullable=True)
    youpi_webhook_secret = Column(String, default="sec_youpi_autoexam_webhook_key", nullable=True)
    youpi_api_key = Column(String, nullable=True)

    # Prepaid Token & Financial Tracker (Default to 0 - No Mock Balance)
    token_balance = Column(BigInteger, default=0, nullable=False)
    wallet_balance_inr = Column(Float, default=0.0, nullable=False)
    total_tokens_used = Column(BigInteger, default=0, nullable=False)
    total_cost_spent_inr = Column(Float, default=0.0, nullable=False)
    
    # Thresholds & Controls
    low_token_threshold = Column(Integer, default=50000, nullable=False)
    is_prepaid_enforced = Column(Boolean, default=True, nullable=False)

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )


class PrepaidPlan(Base):
    __tablename__ = "prepaid_plans"

    id = Column(String, primary_key=True, index=True) # e.g. "plan_starter"
    name = Column(String, nullable=False)
    tokens = Column(BigInteger, nullable=False)
    price_inr = Column(Float, nullable=False)
    description = Column(Text, nullable=False)
    rate_per_k = Column(Float, nullable=False)
    is_popular = Column(Boolean, default=False, nullable=False)
    badge = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class AITokenUsageLog(Base):
    __tablename__ = "ai_token_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    provider = Column(String, nullable=False) # "gemini", "openai", "claude", "ollama"
    model_name = Column(String, nullable=False)
    operation_type = Column(String, nullable=False) # "answer_evaluation", "viva_report", "question_generation"
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    cost_inr = Column(Float, default=0.0, nullable=False)
    cost_usd = Column(Float, default=0.0, nullable=False)
    question_id = Column(Integer, nullable=True)
    student_id = Column(Integer, nullable=True)
    status = Column(String, default="SUCCESS", nullable=False)
    notes = Column(Text, nullable=True)


class TokenRechargeTransaction(Base):
    __tablename__ = "token_recharge_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)
    gateway_order_id = Column(String, nullable=True)
    gateway_payment_id = Column(String, nullable=True)
    youpi_payment_id = Column(String, nullable=True)
    gateway_signature = Column(String, nullable=True)
    invoice_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    plan_name = Column(String, nullable=False)
    tokens_purchased = Column(BigInteger, nullable=False)
    base_amount_inr = Column(Float, default=0.0, nullable=False)
    gst_amount_inr = Column(Float, default=0.0, nullable=False)
    amount_inr = Column(Float, nullable=False)
    payment_method = Column(String, default="UPI", nullable=False)
    payment_gateway = Column(String, default="Razorpay", nullable=False)
    utr_reference = Column(String, nullable=True)
    status = Column(String, default="COMPLETED", nullable=False) # "COMPLETED", "PENDING", "FAILED"
    reference_note = Column(String, nullable=True)
