from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Float, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from .base import Base

class ExamTypeEnum(str, enum.Enum):
    PPT_ONLY = "ppt_only"
    PDF_ONLY = "pdf_only"
    BOTH = "both"
    QA_PDF = "qa_pdf"
    NORMAL_PROMPT = "normal_prompt"

class StudentVivaStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABSENT = "absent"

class ExamRun(Base):
    __tablename__ = "exam_runs"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    exam_type = Column(String, nullable=False, default="ppt_only")
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_finished = Column(Boolean, default=False)
    
    exam = relationship("Exam")
    student_runs = relationship("StudentVivaRun", back_populates="exam_run", cascade="all, delete-orphan")


class StudentVivaRun(Base):
    __tablename__ = "student_viva_runs"
    id = Column(Integer, primary_key=True, index=True)
    exam_run_id = Column(Integer, ForeignKey("exam_runs.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(StudentVivaStatus), default=StudentVivaStatus.PENDING)
    
    # Grading results
    total_score = Column(Float, nullable=True)
    grade = Column(String, nullable=True)
    feedback_notes = Column(Text, nullable=True)
    
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_published = Column(Boolean, default=False)
    publish_grades = Column(Boolean, default=True)
    is_absent = Column(Boolean, default=False)
    assigned_question_ids = Column(Text, nullable=True) # Comma-separated question IDs randomly selected for this student
    
    exam_run = relationship("ExamRun", back_populates="student_runs")
    student = relationship("StudentProfile")
    answers = relationship("StudentVivaAnswer", back_populates="viva_run", cascade="all, delete-orphan")


class StudentVivaAnswer(Base):
    __tablename__ = "student_viva_answers"
    id = Column(Integer, primary_key=True, index=True)
    viva_run_id = Column(Integer, ForeignKey("student_viva_runs.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False)
    
    transcript = Column(Text, nullable=True)
    audio_file_path = Column(String, nullable=True)
    score_awarded = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    areas_to_improve = Column(Text, nullable=True)
    
    viva_run = relationship("StudentVivaRun", back_populates="answers")
    question = relationship("ExamQuestion")
