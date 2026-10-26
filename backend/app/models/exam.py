from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from .base import Base

class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty_profiles.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_name = Column(String, nullable=False)
    
    # Configuration
    total_marks = Column(Float, nullable=False, default=100.0)
    timer_per_question_minutes = Column(Float, nullable=False, default=1.0)
    questions_per_student = Column(Integer, nullable=False, default=5)
    blooms_taxonomy = Column(Boolean, nullable=False, default=False)
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    location = Column(String, nullable=True)
    exam_type = Column(String, nullable=True, default="ppt_only")
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    faculty = relationship("FacultyProfile")
    exam_class = relationship("Class")
    grading_schemes = relationship("GradingScheme", back_populates="exam", cascade="all, delete-orphan")
    materials = relationship("ExamMaterial", back_populates="exam", cascade="all, delete-orphan")
    questions = relationship("ExamQuestion", back_populates="exam", cascade="all, delete-orphan")


class GradingScheme(Base):
    __tablename__ = "grading_schemes"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    grade_label = Column(String, nullable=False) # e.g. "O", "A", "B"
    min_marks = Column(Float, nullable=False)
    max_marks = Column(Float, nullable=False)
    
    exam = relationship("Exam", back_populates="grading_schemes")


class ExamMaterial(Base):
    __tablename__ = "exam_materials"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    material_type = Column(String, nullable=False) # "ppt", "pdf_questions", "pdf_answers"
    weightage = Column(Float, nullable=False, default=100.0)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    exam = relationship("Exam", back_populates="materials")


class ExamQuestion(Base):
    __tablename__ = "exam_questions"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(String, nullable=False)
    expected_answer = Column(String, nullable=True) # Optional if only PPT is given
    source_material_id = Column(Integer, ForeignKey("exam_materials.id", ondelete="SET NULL"), nullable=True)
    
    exam = relationship("Exam", back_populates="questions")
    source_material = relationship("ExamMaterial")
