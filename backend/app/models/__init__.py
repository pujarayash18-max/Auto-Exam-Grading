from app.models.base import Base
from app.models.user import User, LoginAlias, RefreshToken, PasswordResetRequest
from app.models.settings import SiteSettings
from app.models.audit import AuditLog
from app.models.profile import (
    Department, Class, FacultyProfile, FacultySubject,
    FacultyAssignment, StudentProfile, StudentSubject
)
from app.models.exam import Exam, GradingScheme, ExamMaterial, ExamQuestion
from app.models.viva import ExamRun, StudentVivaRun, StudentVivaAnswer, ExamTypeEnum, StudentVivaStatus
from app.models.ai_billing import AISettings, PrepaidPlan, AITokenUsageLog, TokenRechargeTransaction, ExamTokenReservation
from app.models.mcq import MCQExam, MCQQuestion, MCQStudentAttempt, MCQStudentAnswer, MCQAttemptStatus, MCQReleaseMode

# This file imports all models to make sure Alembic detects them
