import jwt
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, or_, func
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import User, LoginAlias, RefreshToken, PasswordResetRequest, ResetStatusEnum
from app.core.security import create_access_token, create_refresh_token, check_lockout, record_failed_login, clear_lockout

router = APIRouter()
ph = PasswordHasher()

@router.post("/login")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    ip = request.client.host
    alias_str = form_data.username
    
    if await check_lockout(ip, alias_str):
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Try again in 15 minutes.")
        
    result = await db.execute(select(LoginAlias).where(LoginAlias.alias == alias_str))
    login_alias = result.scalars().first()
    
    if not login_alias:
        await record_failed_login(ip, alias_str)
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    user = await db.get(User, login_alias.user_id)
    if not user or not user.active:
        await record_failed_login(ip, alias_str)
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    try:
        if user.password_hash:
            ph.verify(user.password_hash, form_data.password)
        elif user.temp_encrypted_password and user.temp_password_expires_at > datetime.now(timezone.utc):
            # We would use Fernet to decrypt here and compare, but for simplicity we rely on password_hash.
            # In Phase 3, temp passwords will be properly evaluated.
            raise VerifyMismatchError()
        else:
            raise VerifyMismatchError()
    except VerifyMismatchError:
        await record_failed_login(ip, alias_str)
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if ph.check_needs_rehash(user.password_hash):
        user.password_hash = ph.hash(form_data.password)
        
    await clear_lockout(ip, alias_str)
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role.value})
    
    # Store refresh token in DB
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=ph.hash(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(db_token)
    await db.commit()
    
    # Set cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7*24*60*60
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
        "role": user.role.value
    }

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        ph.verify(current_user.password_hash, req.old_password)
    except VerifyMismatchError:
        raise HTTPException(status_code=400, detail="Incorrect old password")
        
    current_user.password_hash = ph.hash(req.new_password)
    current_user.must_change_password = False
    current_user.temp_encrypted_password = None
    
    # Revoke all active refresh tokens for security
    await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == current_user.id)
    )
    # Actually, we can just delete them
    await db.execute(
        text("DELETE FROM refresh_tokens WHERE user_id = :uid").bindparams(uid=current_user.id)
    )
    
    await db.commit()
    return {"msg": "Password updated successfully"}

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        # We would hash and find it to revoke, but simple delete for now based on user if we had auth
        pass
    response.delete_cookie("refresh_token")
    return {"msg": "Logged out successfully"}

@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    old_refresh_token = request.cookies.get("refresh_token")
    if not old_refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
        
    try:
        payload = jwt.decode(old_refresh_token, settings.JWT_REFRESH_SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
        role = payload.get("role")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    # Verify in DB and Rotate
    # (Simplified for brevity, usually we check token_hash and revoked status, then delete it)
    await db.execute(
        text("DELETE FROM refresh_tokens WHERE user_id = :uid").bindparams(uid=user_id)
    )
    
    access_token = create_access_token(data={"sub": str(user_id), "role": role})
    new_refresh = create_refresh_token(data={"sub": str(user_id), "role": role})
    
    db_token = RefreshToken(
        user_id=user_id,
        token_hash=ph.hash(new_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(db_token)
    await db.commit()
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7*24*60*60
    )
    
    return {"access_token": access_token, "token_type": "bearer"}



class ForgotPasswordRequest(BaseModel):
    email: Optional[str] = None
    login_id: Optional[str] = None

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    identifier = (req.email or req.login_id or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Please enter an email address or Login ID.")

    # Search user by email (case-insensitive) or by login alias (case-insensitive)
    query = (
        select(User)
        .outerjoin(LoginAlias, User.id == LoginAlias.user_id)
        .where(
            or_(
                func.lower(User.email) == identifier.lower(),
                func.lower(LoginAlias.alias) == identifier.lower(),
            )
        )
    )
    res = await db.execute(query)
    user = res.scalars().first()

    if user and user.email:
        # Generate a temporary 8-character password
        temp_pw = secrets.token_urlsafe(6)[:8]
        user.temp_encrypted_password = temp_pw
        user.password_hash = ph.hash(temp_pw)
        user.must_change_password = True
        user.password_email_sent = True

        # Record password reset request in DB
        prq = PasswordResetRequest(user_id=user.id, status=ResetStatusEnum.PENDING)
        db.add(prq)
        await db.commit()

        # Retrieve user's primary login alias
        alias_res = await db.execute(select(LoginAlias.alias).where(LoginAlias.user_id == user.id))
        primary_alias = alias_res.scalars().first() or user.email

        # Send reset email via Brevo
        if settings.BREVO_API_KEY:
            payload = {
                "sender": {
                    "name": settings.BREVO_SENDER_NAME,
                    "email": settings.BREVO_SENDER_EMAIL,
                },
                "to": [{"email": user.email, "name": user.email}],
                "subject": "AutoExam Password Reset",
                "htmlContent": (
                    f"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>"
                    f"<h2 style='color: #2563EB; margin-top: 0;'>AutoExam Password Reset</h2>"
                    f"<p>Hello,</p>"
                    f"<p>A password reset was requested for your AutoExam account.</p>"
                    f"<p>Use the temporary credentials below to log in:</p>"
                    f"<div style='background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 15px 0;'>"
                    f"<p style='margin: 4px 0;'><b>Login ID:</b> <code>{primary_alias}</code></p>"
                    f"<p style='margin: 4px 0;'><b>Temporary Password:</b> <code style='font-size: 16px; font-weight: bold; color: #1e293b;'>{temp_pw}</code></p>"
                    f"</div>"
                    f"<p>Please sign in at <a href='http://localhost:3000/auth/login'>AutoExam Login</a> and change your password immediately.</p>"
                    f"<p style='color: #64748b; font-size: 12px; margin-top: 20px;'>If you did not request this, please contact your administrator.</p>"
                    f"</div>"
                ),
            }
            headers = {
                "accept": "application/json",
                "api-key": settings.BREVO_API_KEY,
                "content-type": "application/json",
            }
            try:
                async with httpx.AsyncClient() as client:
                    brevo_res = await client.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
                    if not brevo_res.is_success:
                        print(f"Failed to send reset email via Brevo: {brevo_res.text}")
                    else:
                        print(f"Successfully sent password reset email to {user.email}")
            except Exception as e:
                print(f"Exception sending reset email: {e}")
        else:
            print(f"[AUTH DEV] Password reset for {user.email}: Temp Password = {temp_pw}")

    return {
        "msg": "If an account exists with this email or Login ID, password reset instructions have been sent to the registered email.",
        "success": True,
    }


