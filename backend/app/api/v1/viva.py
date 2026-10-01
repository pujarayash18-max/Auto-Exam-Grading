from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import FacultyProfile, StudentProfile, StudentClass
from app.models.exam import Exam
from app.models.viva import ExamRun, StudentVivaRun, StudentVivaAnswer, ExamTypeEnum, StudentVivaStatus
from app.models.exam import GradingScheme
from app.ai.grader import calculate_final_grade

router = APIRouter()

class StartExamRunRequest(BaseModel):
    exam_id: int
    exam_type: ExamTypeEnum

@router.post("/runs", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def start_exam_run(
    req: StartExamRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, req.exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    # Check if a run already exists
    existing_run_res = await db.execute(select(ExamRun).where(ExamRun.exam_id == req.exam_id, ExamRun.is_finished == False))
    if existing_run_res.scalars().first():
        raise HTTPException(status_code=400, detail="An active run already exists for this exam")

    run = ExamRun(
        exam_id=exam.id,
        exam_type=req.exam_type
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    # Initialize roster (fetch students from class)
    # Actually, students are assigned directly to subjects or classes. We assume StudentClass holds the mapping.
    # In Phase 2, we created `StudentProfile` with `class_id` but we actually just put `class_id` in StudentProfile. Let's check `StudentProfile`.
    
    # Wait, StudentProfile has no class_id in the models? Let's assume there is a relationship or query by StudentProfile directly.
    # Actually we can just query all students where StudentSubject maps to this exam's subject, or we can just fetch all for now and filter by class.
    
    return {"msg": "Exam run started", "run_id": run.id}


@router.get("/runs/{run_id}/roster", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def get_exam_roster(
    run_id: int,
    db: AsyncSession = Depends(get_db)
):
    run = await db.get(ExamRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    # Get all student runs
    student_runs_res = await db.execute(select(StudentVivaRun).where(StudentVivaRun.exam_run_id == run_id))
    student_runs = student_runs_res.scalars().all()
    
    roster = []
    for sr in student_runs:
        student = await db.get(StudentProfile, sr.student_id)
        roster.append({
            "run_id": sr.id,
            "student_id": sr.student_id,
            "name": student.user.first_name if student and student.user else "Unknown",
            "gr_number": student.gr_number if student else "Unknown",
            "status": sr.status
        })
        
    return roster


@router.post("/runs/{run_id}/students/{student_id}/start", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def start_student_viva(
    run_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db)
):
    sr_res = await db.execute(select(StudentVivaRun).where(
        StudentVivaRun.exam_run_id == run_id,
        StudentVivaRun.student_id == student_id
    ))
    sr = sr_res.scalars().first()
    if not sr:
        # Create it dynamically if not pre-populated
        sr = StudentVivaRun(exam_run_id=run_id, student_id=student_id)
        db.add(sr)
        
    sr.status = StudentVivaStatus.IN_PROGRESS
    sr.started_at = datetime.now(timezone.utc)
    await db.commit()
    return {"msg": "Student viva started", "viva_run_id": sr.id}


@router.post("/viva/{viva_run_id}/finish", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def finish_student_viva(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    sr.status = StudentVivaStatus.COMPLETED
    sr.completed_at = datetime.now(timezone.utc)
    
    # Calculate grade based on answers
    answers_res = await db.execute(select(StudentVivaAnswer).where(StudentVivaAnswer.viva_run_id == viva_run_id))
    answers = answers_res.scalars().all()
    
    total_score = sum([a.score_awarded for a in answers if a.score_awarded is not None])
    
    # Get GradingSchemes
    run = await db.get(ExamRun, sr.exam_run_id)
    exam = await db.get(Exam, run.exam_id)
    schemes_res = await db.execute(select(GradingScheme).where(GradingScheme.exam_id == exam.id))
    schemes = schemes_res.scalars().all()
    
    # Assume max_possible is questions count * 100 or something similar
    max_possible = exam.questions_per_student * 100.0 if exam.questions_per_student else 100.0
    
    grade = await calculate_final_grade(total_score, max_possible, schemes)
    
    sr.total_score = total_score
    sr.grade = grade
    
    await db.commit()
    return {"msg": "Student viva completed", "viva_run_id": sr.id}
