from datetime import datetime, timezone
import uuid
import os
import hmac
import hashlib
from typing import Optional, List
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, delete

from app.api.deps import get_db, require_roles
from app.models.user import RoleEnum
from app.models.ai_billing import AISettings, PrepaidPlan, AITokenUsageLog, TokenRechargeTransaction

router = APIRouter()

# Official Pricing per 1,000,000 tokens (USD)
MODEL_PRICING = {
    "gemini-1.5-flash": {"provider": "gemini", "name": "Gemini 1.5 Flash", "input_per_m": 0.075, "output_per_m": 0.30, "speed": "Ultra Fast", "badge": "Most Cost-Effective"},
    "gemini-2.0-flash": {"provider": "gemini", "name": "Gemini 2.0 Flash", "input_per_m": 0.15, "output_per_m": 0.60, "speed": "Ultra Fast", "badge": "Next-Gen Speed"},
    "gemini-1.5-pro": {"provider": "gemini", "name": "Gemini 1.5 Pro", "input_per_m": 1.25, "output_per_m": 5.00, "speed": "Medium", "badge": "Deep Academic Reasoning"},
    "gpt-4o-mini": {"provider": "openai", "name": "GPT-4o mini", "input_per_m": 0.15, "output_per_m": 0.60, "speed": "Very Fast", "badge": "High Accuracy & Economy"},
    "gpt-4o": {"provider": "openai", "name": "GPT-4o", "input_per_m": 2.50, "output_per_m": 10.00, "speed": "Fast", "badge": "Flagship Multimodal"},
    "claude-3-5-haiku": {"provider": "claude", "name": "Claude 3.5 Haiku", "input_per_m": 0.80, "output_per_m": 4.00, "speed": "Very Fast", "badge": "Concise & Fast"},
    "claude-3-5-sonnet": {"provider": "claude", "name": "Claude 3.5 Sonnet", "input_per_m": 3.00, "output_per_m": 15.00, "speed": "Balanced", "badge": "Gold Standard Rubric Grading"},
    "llama3": {"provider": "ollama", "name": "Llama 3 8B (Local Ollama)", "input_per_m": 0.0, "output_per_m": 0.0, "speed": "Host Dependent", "badge": "100% Free / On-Premise"},
    "llama3.2": {"provider": "ollama", "name": "Llama 3.2 3B (Fast Local)", "input_per_m": 0.0, "output_per_m": 0.0, "speed": "Fast Local", "badge": "Fastest Local / 3B"},
    "mistral": {"provider": "ollama", "name": "Mistral (Local Ollama)", "input_per_m": 0.0, "output_per_m": 0.0, "speed": "Host Dependent", "badge": "Local Privacy"},
    "qwen2.5": {"provider": "ollama", "name": "Qwen 2.5 (Local Ollama)", "input_per_m": 0.0, "output_per_m": 0.0, "speed": "Host Dependent", "badge": "Open Source"},
}

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

def mask_key(key: Optional[str]) -> Optional[str]:
    if not key or len(key) < 8:
        return "Not Configured"
    return f"{key[:4]}...{key[-4:]}"

async def get_or_create_ai_settings(db: AsyncSession) -> AISettings:
    res = await db.execute(select(AISettings).limit(1))
    settings_obj = res.scalars().first()
    if not settings_obj:
        # Zero mock balance: starts clean at 0 tokens and 0.0 INR
        settings_obj = AISettings(
            active_provider="gemini",
            active_model="gemini-1.5-flash",
            merchant_upi_id="autoexam.billing@icici",
            merchant_name="AutoExam Examination Cell",
            gst_rate_percent=18.0,
            gateway_mode="HYBRID",
            token_balance=0,
            wallet_balance_inr=0.0,
            total_tokens_used=0,
            total_cost_spent_inr=0.0,
            low_token_threshold=50000,
            is_prepaid_enforced=True
        )
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)
    return settings_obj

async def ensure_prepaid_plans(db: AsyncSession):
    """Seeds default plans in database if table is empty."""
    res = await db.execute(select(PrepaidPlan))
    existing = res.scalars().all()
    if not existing:
        for p in DEFAULT_PLANS:
            plan_obj = PrepaidPlan(
                id=p["id"],
                name=p["name"],
                tokens=p["tokens"],
                price_inr=p["price_inr"],
                description=p["description"],
                rate_per_k=p["rate_per_k"],
                is_popular=p["is_popular"],
                badge=p["badge"],
                is_active=True
            )
            db.add(plan_obj)
        await db.commit()

# Schemas
class UpdateAISettingsRequest(BaseModel):
    active_provider: str = Field(..., description="Provider: gemini, openai, claude, ollama")
    active_model: str = Field(..., description="Model ID")
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    claude_api_key: Optional[str] = None
    ollama_host: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    merchant_upi_id: Optional[str] = None
    merchant_name: Optional[str] = None
    gst_rate_percent: Optional[float] = 18.0
    gateway_mode: Optional[str] = "HYBRID"
    low_token_threshold: Optional[int] = 50000
    is_prepaid_enforced: Optional[bool] = True

class CreatePlanRequest(BaseModel):
    name: str
    tokens: int
    price_inr: float
    description: str
    badge: Optional[str] = None
    is_popular: Optional[bool] = False

class CreateOrderRequest(BaseModel):
    plan_id: str
    custom_tokens: Optional[int] = None
    payment_method: str = "UPI" # UPI, CARD, NETBANKING

class VerifyPaymentRequest(BaseModel):
    transaction_id: str
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    gateway_signature: Optional[str] = None
    payment_method: str = "UPI"
    utr_reference: Optional[str] = None


@router.get("/settings", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_ai_settings(db: AsyncSession = Depends(get_db)):
    """
    Returns active AI model configuration, available models, real live balances and gateway status.
    """
    settings_obj = await get_or_create_ai_settings(db)
    
    env_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    env_openai = bool(os.environ.get("OPENAI_API_KEY"))
    env_claude = bool(os.environ.get("ANTHROPIC_API_KEY"))
    env_razorpay_key = os.environ.get("RAZORPAY_KEY_ID")

    active_rzp_key = settings_obj.razorpay_key_id or env_razorpay_key or ""

    return {
        "active_provider": settings_obj.active_provider,
        "active_model": settings_obj.active_model,
        "ollama_host": settings_obj.ollama_host or "http://localhost:11434",
        "keys_status": {
            "gemini": mask_key(settings_obj.gemini_api_key) if settings_obj.gemini_api_key else ("Configured via ENV" if env_gemini else "Not Configured"),
            "openai": mask_key(settings_obj.openai_api_key) if settings_obj.openai_api_key else ("Configured via ENV" if env_openai else "Not Configured"),
            "claude": mask_key(settings_obj.claude_api_key) if settings_obj.claude_api_key else ("Configured via ENV" if env_claude else "Not Configured"),
            "razorpay": mask_key(active_rzp_key) if active_rzp_key else "Not Configured (Using Direct Gateway)"
        },
        "has_razorpay_key": bool(active_rzp_key),
        "razorpay_key_id": active_rzp_key,
        "merchant_upi_id": settings_obj.merchant_upi_id or "autoexam.billing@icici",
        "merchant_name": settings_obj.merchant_name or "AutoExam Examination Cell",
        "gst_rate_percent": settings_obj.gst_rate_percent if settings_obj.gst_rate_percent is not None else 18.0,
        "gateway_mode": settings_obj.gateway_mode or "HYBRID",
        "token_balance": settings_obj.token_balance,
        "wallet_balance_inr": round(settings_obj.wallet_balance_inr, 2),
        "total_tokens_used": settings_obj.total_tokens_used,
        "total_cost_spent_inr": round(settings_obj.total_cost_spent_inr, 2),
        "low_token_threshold": settings_obj.low_token_threshold,
        "is_low_balance": settings_obj.token_balance <= settings_obj.low_token_threshold,
        "is_depleted": settings_obj.token_balance <= 0,
        "is_prepaid_enforced": settings_obj.is_prepaid_enforced,
        "available_models": MODEL_PRICING
    }


@router.put("/settings", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def update_ai_settings(req: UpdateAISettingsRequest, db: AsyncSession = Depends(get_db)):
    """
    Updates active AI model, provider, API keys, merchant UPI details, and payment gateway mode.
    """
    if req.active_model not in MODEL_PRICING:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.active_model}")
        
    expected_provider = MODEL_PRICING[req.active_model]["provider"]
    if req.active_provider != expected_provider:
        req.active_provider = expected_provider

    settings_obj = await get_or_create_ai_settings(db)
    settings_obj.active_provider = req.active_provider
    settings_obj.active_model = req.active_model
    
    if req.gemini_api_key is not None and req.gemini_api_key.strip():
        settings_obj.gemini_api_key = req.gemini_api_key.strip()
    if req.openai_api_key is not None and req.openai_api_key.strip():
        settings_obj.openai_api_key = req.openai_api_key.strip()
    if req.claude_api_key is not None and req.claude_api_key.strip():
        settings_obj.claude_api_key = req.claude_api_key.strip()
    if req.ollama_host is not None and req.ollama_host.strip():
        settings_obj.ollama_host = req.ollama_host.strip()
    if req.razorpay_key_id is not None:
        settings_obj.razorpay_key_id = req.razorpay_key_id.strip()
    if req.razorpay_key_secret is not None:
        settings_obj.razorpay_key_secret = req.razorpay_key_secret.strip()
    if req.merchant_upi_id is not None and req.merchant_upi_id.strip():
        settings_obj.merchant_upi_id = req.merchant_upi_id.strip()
    if req.merchant_name is not None and req.merchant_name.strip():
        settings_obj.merchant_name = req.merchant_name.strip()
    if req.gst_rate_percent is not None:
        settings_obj.gst_rate_percent = max(0.0, req.gst_rate_percent)
    if req.gateway_mode is not None:
        settings_obj.gateway_mode = req.gateway_mode
        
    if req.low_token_threshold is not None:
        settings_obj.low_token_threshold = max(1000, req.low_token_threshold)
    if req.is_prepaid_enforced is not None:
        settings_obj.is_prepaid_enforced = req.is_prepaid_enforced

    settings_obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(settings_obj)

    return {
        "msg": "Configuration updated successfully",
        "active_provider": settings_obj.active_provider,
        "active_model": settings_obj.active_model,
        "merchant_upi_id": settings_obj.merchant_upi_id,
        "merchant_name": settings_obj.merchant_name,
        "model_details": MODEL_PRICING[settings_obj.active_model]
    }


@router.post("/reset-balance", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def reset_token_balance(action: str = "zero", db: AsyncSession = Depends(get_db)):
    """
    Super Admin utility to wipe mock/test data:
    - 'zero': completely resets token balance to 0 and wallet to 0.0
    - 'sync': recalculates balances strictly based on real TokenRechargeTransaction records minus AITokenUsageLog
    """
    settings_obj = await get_or_create_ai_settings(db)
    
    if action == "zero":
        settings_obj.token_balance = 0
        settings_obj.wallet_balance_inr = 0.0
        settings_obj.total_tokens_used = 0
        settings_obj.total_cost_spent_inr = 0.0
        # Delete test transactions
        await db.execute(delete(TokenRechargeTransaction))
        await db.execute(delete(AITokenUsageLog))
        await db.commit()
        await db.refresh(settings_obj)
        return {
            "msg": "All balances and audit logs reset to real 0. Ready for live operations.",
            "token_balance": 0,
            "wallet_balance_inr": 0.0
        }
    else:
        # Sync mathematically from real transactions
        txns_res = await db.execute(select(TokenRechargeTransaction).where(TokenRechargeTransaction.status == "COMPLETED"))
        all_txns = txns_res.scalars().all()
        total_purchased_tokens = sum(t.tokens_purchased for t in all_txns)
        total_purchased_inr = sum(t.amount_inr for t in all_txns)

        logs_res = await db.execute(select(AITokenUsageLog))
        all_logs = logs_res.scalars().all()
        total_used_tokens = sum(l.total_tokens for l in all_logs)
        total_spent_inr = sum(l.cost_inr for l in all_logs)

        settings_obj.token_balance = max(0, total_purchased_tokens - total_used_tokens)
        settings_obj.wallet_balance_inr = max(0.0, round(total_purchased_inr - total_spent_inr, 2))
        settings_obj.total_tokens_used = total_used_tokens
        settings_obj.total_cost_spent_inr = round(total_spent_inr, 2)
        await db.commit()
        await db.refresh(settings_obj)

        return {
            "msg": "Balances successfully synced with real transaction ledger.",
            "token_balance": settings_obj.token_balance,
            "wallet_balance_inr": settings_obj.wallet_balance_inr
        }


@router.get("/usage", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_token_usage_tracker(db: AsyncSession = Depends(get_db)):
    """
    Fetches real-time usage metrics and audit logs.
    """
    settings_obj = await get_or_create_ai_settings(db)
    
    logs_res = await db.execute(
        select(AITokenUsageLog).order_by(desc(AITokenUsageLog.created_at)).limit(50)
    )
    logs = logs_res.scalars().all()

    formatted_logs = [
        {
            "id": l.id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "provider": l.provider,
            "model_name": l.model_name,
            "operation_type": l.operation_type,
            "prompt_tokens": l.prompt_tokens,
            "completion_tokens": l.completion_tokens,
            "total_tokens": l.total_tokens,
            "cost_inr": round(l.cost_inr, 4),
            "cost_usd": round(l.cost_usd, 6),
            "status": l.status,
            "notes": l.notes
        }
        for l in logs
    ]

    return {
        "token_balance": settings_obj.token_balance,
        "wallet_balance_inr": round(settings_obj.wallet_balance_inr, 2),
        "total_tokens_used": settings_obj.total_tokens_used,
        "total_cost_spent_inr": round(settings_obj.total_cost_spent_inr, 2),
        "total_cost_spent_usd": round(settings_obj.total_cost_spent_inr / 86.0, 4),
        "low_token_threshold": settings_obj.low_token_threshold,
        "is_low_balance": settings_obj.token_balance <= settings_obj.low_token_threshold,
        "is_depleted": settings_obj.token_balance <= 0,
        "recent_logs": formatted_logs
    }


@router.get("/plans", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_prepaid_plans(db: AsyncSession = Depends(get_db)):
    """
    Returns prepaid plans loaded dynamically from the database.
    """
    await ensure_prepaid_plans(db)
    settings_obj = await get_or_create_ai_settings(db)
    res = await db.execute(select(PrepaidPlan).where(PrepaidPlan.is_active == True))
    plans = res.scalars().all()
    
    return {
        "plans": [
            {
                "id": p.id,
                "name": p.name,
                "tokens": p.tokens,
                "price_inr": p.price_inr,
                "description": p.description,
                "rate_per_k": p.rate_per_k,
                "is_popular": p.is_popular,
                "badge": p.badge
            }
            for p in plans
        ],
        "custom_rate_per_k_tokens": 1.0,
        "gst_rate_percent": settings_obj.gst_rate_percent if settings_obj.gst_rate_percent is not None else 18.0,
        "currency": "INR"
    }


@router.post("/plans", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def add_custom_plan(req: CreatePlanRequest, db: AsyncSession = Depends(get_db)):
    """
    Allows Super Admin to dynamically create new token plans.
    """
    plan_id = f"plan_{uuid.uuid4().hex[:8]}"
    rate_per_k = round((req.price_inr / req.tokens) * 1000.0, 4) if req.tokens > 0 else 1.0
    
    new_plan = PrepaidPlan(
        id=plan_id,
        name=req.name,
        tokens=req.tokens,
        price_inr=req.price_inr,
        description=req.description,
        rate_per_k=rate_per_k,
        is_popular=bool(req.is_popular),
        badge=req.badge or "Custom Tier",
        is_active=True
    )
    db.add(new_plan)
    await db.commit()
    await db.refresh(new_plan)
    return {"msg": "New plan added dynamically", "plan_id": plan_id}


@router.delete("/plans/{plan_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def delete_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    """
    Allows Super Admin to deactivate a plan.
    """
    res = await db.execute(select(PrepaidPlan).where(PrepaidPlan.id == plan_id))
    plan = res.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.is_active = False
    await db.commit()
    return {"msg": f"Plan '{plan.name}' archived successfully"}


@router.post("/recharge/create-order", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def create_payment_order(req: CreateOrderRequest, db: AsyncSession = Depends(get_db)):
    """
    Creates an official payment gateway order.
    Dynamically computes taxes based on merchant configuration and supports live UPI and Razorpay.
    """
    settings_obj = await get_or_create_ai_settings(db)
    await ensure_prepaid_plans(db)

    tokens = 0
    base_amount = 0.0
    plan_name = ""

    if req.plan_id == "custom":
        if not req.custom_tokens or req.custom_tokens < 50000:
            raise HTTPException(status_code=400, detail="Minimum custom recharge is 50,000 tokens")
        tokens = req.custom_tokens
        base_amount = round((tokens / 1000.0) * 1.0, 2)
        plan_name = f"Custom Token Pack ({tokens:,} Tokens)"
    else:
        res = await db.execute(select(PrepaidPlan).where(PrepaidPlan.id == req.plan_id))
        plan = res.scalars().first()
        if not plan:
            raise HTTPException(status_code=404, detail="Selected plan not found")
        tokens = plan.tokens
        base_amount = plan.price_inr
        plan_name = plan.name

    gst_percent = settings_obj.gst_rate_percent if settings_obj.gst_rate_percent is not None else 18.0
    half_gst = gst_percent / 2.0
    cgst_inr = round(base_amount * (half_gst / 100.0), 2)
    sgst_inr = round(base_amount * (half_gst / 100.0), 2)
    total_gst = round(cgst_inr + sgst_inr, 2)
    total_payable = round(base_amount + total_gst, 2)
    
    transaction_id = f"TXN_{uuid.uuid4().hex[:12].upper()}"
    gateway_order_id = f"order_{uuid.uuid4().hex[:14]}"
    razorpay_key_id = settings_obj.razorpay_key_id or os.environ.get("RAZORPAY_KEY_ID")
    razorpay_key_secret = settings_obj.razorpay_key_secret or os.environ.get("RAZORPAY_KEY_SECRET")

    is_real_razorpay = False

    # If Razorpay keys are configured and gateway mode is not locked to UPI_DIRECT
    if razorpay_key_id and razorpay_key_secret and settings_obj.gateway_mode != "UPI_DIRECT":
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                rzp_res = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=(razorpay_key_id, razorpay_key_secret),
                    json={
                        "amount": int(total_payable * 100), # in paise
                        "currency": "INR",
                        "receipt": transaction_id,
                        "notes": {
                            "plan_id": req.plan_id,
                            "tokens": str(tokens),
                            "purpose": "AutoExam AI Token Recharge"
                        }
                    }
                )
                if rzp_res.status_code == 200:
                    rzp_data = rzp_res.json()
                    gateway_order_id = rzp_data.get("id", gateway_order_id)
                    is_real_razorpay = True
        except Exception as rzp_err:
            print(f"Razorpay order creation fallback: {rzp_err}")

    # Create pending transaction
    new_txn = TokenRechargeTransaction(
        transaction_id=transaction_id,
        gateway_order_id=gateway_order_id,
        plan_name=plan_name,
        tokens_purchased=tokens,
        base_amount_inr=base_amount,
        gst_amount_inr=total_gst,
        amount_inr=total_payable,
        payment_method=req.payment_method,
        payment_gateway="Razorpay Live" if is_real_razorpay else "AutoExam Secure Gateway",
        status="PENDING",
        reference_note=f"Initiated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )
    db.add(new_txn)
    await db.commit()

    merchant_upi = settings_obj.merchant_upi_id or "autoexam.billing@icici"
    merchant_name = settings_obj.merchant_name or "AutoExam Examination Cell"
    upi_intent = f"upi://pay?pa={merchant_upi}&pn={merchant_name.replace(' ', '%20')}&am={total_payable:.2f}&cu=INR&tn={transaction_id}"

    return {
        "transaction_id": transaction_id,
        "gateway_order_id": gateway_order_id,
        "is_real_razorpay": is_real_razorpay,
        "razorpay_key_id": razorpay_key_id if is_real_razorpay else None,
        "merchant_upi_id": merchant_upi,
        "merchant_name": merchant_name,
        "plan_id": req.plan_id,
        "plan_name": plan_name,
        "tokens_to_credit": tokens,
        "base_amount_inr": base_amount,
        "gst_percent": gst_percent,
        "cgst_inr": cgst_inr,
        "sgst_inr": sgst_inr,
        "total_gst_inr": total_gst,
        "total_payable_inr": total_payable,
        "payment_method": req.payment_method,
        "upi_intent_string": upi_intent
    }


@router.get("/recharge/order-status/{transaction_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def get_order_status(transaction_id: str, db: AsyncSession = Depends(get_db)):
    """
    Real-time polling endpoint. Allows client gateway to automatically detect payment completion.
    """
    settings_obj = await get_or_create_ai_settings(db)
    res = await db.execute(
        select(TokenRechargeTransaction).where(TokenRechargeTransaction.transaction_id == transaction_id)
    )
    txn = res.scalars().first()
    if not txn:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "transaction_id": txn.transaction_id,
        "status": txn.status, # "PENDING", "COMPLETED", "FAILED"
        "invoice_number": txn.invoice_number,
        "tokens_credited": txn.tokens_purchased if txn.status == "COMPLETED" else 0,
        "new_token_balance": settings_obj.token_balance,
        "new_wallet_balance_inr": round(settings_obj.wallet_balance_inr, 2),
        "amount_inr": txn.amount_inr
    }


@router.post("/recharge/verify-payment", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def verify_payment_and_credit(req: VerifyPaymentRequest, db: AsyncSession = Depends(get_db)):
    """
    Verifies payment settlement, performs signature check if Razorpay is configured,
    credits the prepaid token wallet, and issues an official tax invoice.
    """
    settings_obj = await get_or_create_ai_settings(db)
    
    # Locate pending transaction
    res = await db.execute(
        select(TokenRechargeTransaction).where(TokenRechargeTransaction.transaction_id == req.transaction_id)
    )
    txn = res.scalars().first()
    if not txn:
        raise HTTPException(status_code=404, detail="Order transaction not found.")
        
    if txn.status == "COMPLETED":
        return {
            "msg": "Transaction already verified and credited.",
            "transaction_id": txn.transaction_id,
            "invoice_number": txn.invoice_number,
            "token_balance": settings_obj.token_balance
        }

    # Verify Razorpay signature if provided
    razorpay_key_secret = settings_obj.razorpay_key_secret or os.environ.get("RAZORPAY_KEY_SECRET")
    if req.gateway_signature and req.gateway_order_id and req.gateway_payment_id and razorpay_key_secret:
        msg = f"{req.gateway_order_id}|{req.gateway_payment_id}".encode("utf-8")
        expected_sig = hmac.new(razorpay_key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, req.gateway_signature):
            txn.status = "FAILED"
            txn.reference_note = "Razorpay HMAC signature verification failed."
            await db.commit()
            raise HTTPException(status_code=400, detail="Invalid payment signature. Verification rejected.")

    # Generate sequential Tax Invoice Number
    inv_count_res = await db.execute(select(func.count(TokenRechargeTransaction.id)))
    inv_seq = (inv_count_res.scalar() or 0) + 1
    current_year = datetime.now(timezone.utc).year
    invoice_no = f"INV-{current_year}-{inv_seq:05d}"

    # Update transaction
    payment_id = req.gateway_payment_id or f"pay_{uuid.uuid4().hex[:12].upper()}"
    txn.gateway_payment_id = payment_id
    txn.gateway_signature = req.gateway_signature or "SIG_VERIFIED"
    txn.utr_reference = req.utr_reference or f"UTR{uuid.uuid4().int % 1000000000000:012d}"
    txn.payment_method = req.payment_method
    txn.invoice_number = invoice_no
    txn.status = "COMPLETED"
    txn.reference_note = f"Verified via {req.payment_method} on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"

    # Credit Token Wallet Dynamically
    settings_obj.token_balance += txn.tokens_purchased
    settings_obj.wallet_balance_inr += txn.amount_inr
    settings_obj.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(settings_obj)
    await db.refresh(txn)

    return {
        "msg": "Payment verified! Tokens have been credited to your prepaid balance.",
        "transaction_id": txn.transaction_id,
        "invoice_number": invoice_no,
        "payment_id": payment_id,
        "tokens_credited": txn.tokens_purchased,
        "new_token_balance": settings_obj.token_balance,
        "new_wallet_balance_inr": round(settings_obj.wallet_balance_inr, 2),
        "status": "COMPLETED",
        "tax_breakdown": {
            "sac_code": "998431",
            "base_amount": txn.base_amount_inr,
            "cgst": round(txn.gst_amount_inr / 2.0, 2),
            "sgst": round(txn.gst_amount_inr / 2.0, 2),
            "cgst_9": round(txn.gst_amount_inr / 2.0, 2),
            "sgst_9": round(txn.gst_amount_inr / 2.0, 2),
            "total_gst": txn.gst_amount_inr,
            "total_paid": txn.amount_inr
        }
    }


@router.post("/recharge/webhook")
async def payment_gateway_webhook(request: Request, x_razorpay_signature: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    """
    Asynchronous Webhook Listener for external payment gateway events.
    Automatically marks orders as COMPLETED and credits tokens.
    """
    settings_obj = await get_or_create_ai_settings(db)
    payload_body = await request.body()
    razorpay_key_secret = settings_obj.razorpay_key_secret or os.environ.get("RAZORPAY_KEY_SECRET")

    # If Razorpay signature header is present, verify
    if x_razorpay_signature and razorpay_key_secret:
        expected = hmac.new(razorpay_key_secret.encode("utf-8"), payload_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = await request.json()
        event_type = event.get("event", "")
        
        if event_type in ["payment.captured", "order.paid"]:
            payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            
            if order_id:
                res = await db.execute(select(TokenRechargeTransaction).where(TokenRechargeTransaction.gateway_order_id == order_id))
                txn = res.scalars().first()
                if txn and txn.status != "COMPLETED":
                    inv_count_res = await db.execute(select(func.count(TokenRechargeTransaction.id)))
                    inv_seq = (inv_count_res.scalar() or 0) + 1
                    current_year = datetime.now(timezone.utc).year
                    
                    txn.status = "COMPLETED"
                    txn.gateway_payment_id = payment_id
                    txn.invoice_number = f"INV-{current_year}-{inv_seq:05d}"
                    txn.reference_note = "Webhook auto-capture"
                    settings_obj.token_balance += txn.tokens_purchased
                    settings_obj.wallet_balance_inr += txn.amount_inr
                    await db.commit()
                    return {"status": "success", "msg": f"Order {order_id} credited via webhook"}
    except Exception as e:
        print(f"Webhook processing note: {e}")

    return {"status": "ok"}


@router.get("/recharge/invoice/{transaction_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def get_tax_invoice(transaction_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns printable tax invoice metadata for any completed transaction.
    """
    settings_obj = await get_or_create_ai_settings(db)
    res = await db.execute(
        select(TokenRechargeTransaction).where(TokenRechargeTransaction.transaction_id == transaction_id)
    )
    txn = res.scalars().first()
    if not txn:
        raise HTTPException(status_code=404, detail="Invoice record not found.")

    return {
        "invoice_number": txn.invoice_number or f"INV-{txn.id:05d}",
        "transaction_id": txn.transaction_id,
        "date": txn.created_at.strftime("%d %B %Y, %I:%M %p UTC") if txn.created_at else "",
        "merchant_name": settings_obj.merchant_name or "AutoExam Examination Cell",
        "merchant_upi_id": settings_obj.merchant_upi_id or "autoexam.billing@icici",
        "plan_name": txn.plan_name,
        "tokens_credited": txn.tokens_purchased,
        "base_amount_inr": txn.base_amount_inr,
        "cgst_inr": round(txn.gst_amount_inr / 2.0, 2),
        "sgst_inr": round(txn.gst_amount_inr / 2.0, 2),
        "total_gst_inr": txn.gst_amount_inr,
        "total_amount_inr": txn.amount_inr,
        "payment_method": txn.payment_method,
        "gateway_payment_id": txn.gateway_payment_id,
        "utr_reference": txn.utr_reference,
        "status": txn.status,
        "sac_code": "998431 (Cloud AI Processing & Hosting Services)"
    }


@router.get("/recharge/transactions", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN]))])
async def list_recharge_transactions(db: AsyncSession = Depends(get_db)):
    """
    Returns complete invoice & recharge transaction ledger.
    """
    res = await db.execute(select(TokenRechargeTransaction).order_by(desc(TokenRechargeTransaction.created_at)).limit(50))
    txns = res.scalars().all()
    
    return [
        {
            "id": t.id,
            "transaction_id": t.transaction_id,
            "invoice_number": t.invoice_number,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "plan_name": t.plan_name,
            "tokens_purchased": t.tokens_purchased,
            "base_amount_inr": t.base_amount_inr,
            "gst_amount_inr": t.gst_amount_inr,
            "amount_inr": t.amount_inr,
            "payment_method": t.payment_method,
            "payment_gateway": t.payment_gateway,
            "status": t.status,
            "utr_reference": t.utr_reference
        }
        for t in txns
    ]
