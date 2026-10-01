import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import Class, FacultyProfile, FacultyClass
from app.models.exam import Exam, GradingScheme, ExamMaterial

router = APIRouter()

class GradingSchemeInput(BaseModel):
    grade_label: str
    min_marks: float
    max_marks: float

class ScheduleExamRequest(BaseModel):
    subject_name: str
    class_id: int
    timer_per_question_minutes: float
    questions_per_student: int
    grading_schemes: List[GradingSchemeInput]

@router.post("/exams", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def schedule_exam(
    req: ScheduleExamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify faculty profile exists
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        raise HTTPException(status_code=404, detail="Faculty profile not found")

    # Verify class assignment
    assignment_res = await db.execute(
        select(FacultyClass).where(FacultyClass.faculty_id == prof.id, FacultyClass.class_id == req.class_id)
    )
    if not assignment_res.scalars().first():
        raise HTTPException(status_code=403, detail="Not assigned to this class")

    # Create exam
    exam = Exam(
        faculty_id=prof.id,
        class_id=req.class_id,
        subject_name=req.subject_name,
        timer_per_question_minutes=req.timer_per_question_minutes,
        questions_per_student=req.questions_per_student
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)
    
    # Create Grading Schemes
    for gs in req.grading_schemes:
        db.add(GradingScheme(
            exam_id=exam.id,
            grade_label=gs.grade_label,
            min_marks=gs.min_marks,
            max_marks=gs.max_marks
        ))
    
    await db.commit()
    return {"msg": "Exam scheduled successfully", "exam_id": exam.id}


UPLOAD_DIR = "uploads/materials"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/exams/{exam_id}/materials", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def upload_exam_material(
    exam_id: int,
    file: UploadFile = File(...),
    material_type: str = Form(...), # e.g. 'ppt', 'pdf_questions', 'pdf_answers'
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    if not file.filename.endswith(('.pdf', '.ppt', '.pptx')):
        raise HTTPException(status_code=400, detail="Only PDF and PPT files allowed")
        
    file_path = os.path.join(UPLOAD_DIR, f"{exam_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    material = ExamMaterial(
        exam_id=exam.id,
        filename=file.filename,
        file_path=file_path,
        material_type=material_type
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    
    return {"msg": "Material uploaded successfully", "material_id": material.id}

@router.get("/exams", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def list_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        return []
        
    exams_res = await db.execute(select(Exam).where(Exam.faculty_id == prof.id))
    exams = exams_res.scalars().all()
    
    return [{"id": e.id, "subject_name": e.subject_name, "class_id": e.class_id} for e in exams]

@router.post("/exams/{exam_id}/generate-questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def generate_questions(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    # TODO: Implement AI generation using the uploaded ExamMaterials
    # For now, return a success message.
    return {"msg": "Question generation triggered successfully", "status": "processing"}
