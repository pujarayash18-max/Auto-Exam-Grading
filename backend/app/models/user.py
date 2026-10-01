from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .base import Base

class RoleEnum(str, enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(Enum(RoleEnum), nullable=False)
    password_hash = Column(String, nullable=True)
    temp_encrypted_password = Column(String, nullable=True)
    temp_password_expires_at = Column(DateTime(timezone=True), nullable=True)
    must_change_password = Column(Boolean, default=False, nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    aliases = relationship("LoginAlias", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    password_reset_requests = relationship("PasswordResetRequest", back_populates="user", foreign_keys="[PasswordResetRequest.user_id]")


class LoginAlias(Base):
    __tablename__ = "login_aliases"

    id = Column(Integer, primary_key=True, index=True)
    alias = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    user = relationship("User", back_populates="aliases")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


class ResetStatusEnum(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(ResetStatusEnum), default=ResetStatusEnum.PENDING, nullable=False)
    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="password_reset_requests", foreign_keys=[user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_admin_id])
