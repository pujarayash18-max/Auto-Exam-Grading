from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(String, unique=True, nullable=True)
    name = Column(String, unique=True, nullable=False)

    classes = relationship("Class", back_populates="department")
    faculties = relationship("FacultyProfile", back_populates="department")
    students = relationship("StudentProfile", back_populates="department")


class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    semester = Column(Integer, nullable=False)
    name = Column(String, nullable=False)

    department = relationship("Department", back_populates="classes")
    students = relationship("StudentProfile", back_populates="student_class")
    faculty_assignments = relationship("FacultyAssignment", back_populates="assigned_class")

    __table_args__ = (
        UniqueConstraint('department_id', 'semester', 'name', name='uq_class_dept_sem_name'),
    )


class FacultyProfile(Base):
    __tablename__ = "faculty_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)

    user = relationship("User")
    department = relationship("Department", back_populates="faculties")
    subjects = relationship("FacultySubject", back_populates="faculty", cascade="all, delete-orphan")
    class_assignments = relationship("FacultyAssignment", back_populates="faculty", cascade="all, delete-orphan")


class FacultySubject(Base):
    __tablename__ = "faculty_subjects"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty_profiles.id", ondelete="CASCADE"), nullable=False)
    subject_code = Column(String, nullable=True)
    subject_name = Column(String, nullable=False)

    faculty = relationship("FacultyProfile", back_populates="subjects")

    __table_args__ = (
        UniqueConstraint('faculty_id', 'subject_name', name='uq_faculty_subject'),
    )


class FacultyAssignment(Base):
    __tablename__ = "faculty_assignments"
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty_profiles.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_code = Column(String, nullable=True)
    subject_name = Column(String, nullable=False)

    faculty = relationship("FacultyProfile", back_populates="class_assignments")
    assigned_class = relationship("Class", back_populates="faculty_assignments")

    __table_args__ = (
        UniqueConstraint('faculty_id', 'class_id', 'subject_name', name='uq_faculty_assignment_subject'),
    )


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    enrollment_number = Column(String, unique=True, nullable=False)
    gr_number = Column(String, unique=True, nullable=False)

    user = relationship("User")
    department = relationship("Department", back_populates="students")
    student_class = relationship("Class", back_populates="students")
    subjects = relationship("StudentSubject", back_populates="student", cascade="all, delete-orphan")


class StudentSubject(Base):
    __tablename__ = "student_subjects"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    subject_code = Column(String, nullable=True)
    subject_name = Column(String, nullable=False)

    student = relationship("StudentProfile", back_populates="subjects")

    __table_args__ = (
        UniqueConstraint('student_id', 'subject_name', name='uq_student_subject'),
    )
