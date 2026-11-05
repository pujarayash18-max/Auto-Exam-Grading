from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Float, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .base import Base

class MCQAttemptStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    LOCKED_OUT = "locked_out"
    SUBMITTED = "submitted"

class MCQReleaseMode(str, enum.Enum):
    IMMEDIATE = "immediate"  # Release numerical score, letter grade & full answer sheet upon submission
    WITHHELD = "withheld"    # Keep grades & answers private until faculty explicitly toggles release

class MCQExam(Base):
    __tablename__ = "mcq_exams"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty_profiles.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_name = Column(String, nullable=False)
    
    access_pin = Column(String(12), nullable=False, index=True)  # 6-digit numeric or alphanumeric PIN
    duration_minutes = Column(Integer, nullable=False, default=30)
    total_marks = Column(Float, nullable=False, default=100.0)
    questions_per_student = Column(Integer, nullable=False, default=10)
    shuffle_options = Column(Boolean, default=True)
    release_mode = Column(String(20), default=MCQReleaseMode.IMMEDIATE.value)
    enable_blooms_taxonomy = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    faculty = relationship("FacultyProfile")
    exam_class = relationship("Class")
    questions = relationship("MCQQuestion", back_populates="exam", cascade="all, delete-orphan")
    attempts = relationship("MCQStudentAttempt", back_populates="exam", cascade="all, delete-orphan")

class MCQQuestion(Base):
    __tablename__ = "mcq_questions"
    id = Column(Integer, primary_key=True, index=True)
    mcq_exam_id = Column(Integer, ForeignKey("mcq_exams.id", ondelete="CASCADE"), nullable=False)
    
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_option = Column(String(2), nullable=False) # 'A', 'B', 'C', 'D'
    explanation = Column(Text, nullable=True)
    bloom_level = Column(String(50), nullable=True, default="Understand")
    
    exam = relationship("MCQExam", back_populates="questions")

class MCQStudentAttempt(Base):
    __tablename__ = "mcq_student_attempts"
    id = Column(Integer, primary_key=True, index=True)
    mcq_exam_id = Column(Integer, ForeignKey("mcq_exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(Enum(MCQAttemptStatus, name="mcqattemptstatus", values_callable=lambda obj: [e.value for e in obj]), default=MCQAttemptStatus.NOT_STARTED, nullable=False)
    lockout_count = Column(Integer, default=0)
    last_lockout_reason = Column(String(255), nullable=True)
    last_lockout_at = Column(DateTime(timezone=True), nullable=True)
    faculty_approved = Column(Boolean, default=False)
    
    assigned_question_ids = Column(Text, nullable=True) # Comma-separated question IDs randomly chosen for this student
    score_awarded = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True)
    grade = Column(String(10), nullable=True)
    
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    exam = relationship("MCQExam", back_populates="attempts")
    student = relationship("StudentProfile")
    answers = relationship("MCQStudentAnswer", back_populates="attempt", cascade="all, delete-orphan")

class MCQStudentAnswer(Base):
    __tablename__ = "mcq_student_answers"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("mcq_student_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("mcq_questions.id", ondelete="CASCADE"), nullable=False)
    
    selected_option = Column(String(2), nullable=True) # 'A', 'B', 'C', 'D' or None if unanswered
    is_correct = Column(Boolean, nullable=True)
    marks_awarded = Column(Float, default=0.0)
    answered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    attempt = relationship("MCQStudentAttempt", back_populates="answers")
    question = relationship("MCQQuestion")
