from app.models.base import Base
from app.models.user import User, LoginAlias, RefreshToken, PasswordResetRequest
from app.models.settings import SiteSettings
from app.models.audit import AuditLog
from app.models.profile import (
    Department, Class, FacultyProfile, FacultySubject,
    FacultyClass, StudentProfile, StudentSubject
)

# This file imports all models to make sure Alembic detects them
