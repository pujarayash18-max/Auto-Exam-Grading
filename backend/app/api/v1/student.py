from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import StudentProfile
from app.models.viva import StudentVivaRun, ExamRun
from app.models.exam import Exam

router = APIRouter()

@router.get("/profile", dependencies=[Depends(require_roles([RoleEnum.STUDENT]))])
async def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    return {
        "name": current_user.first_name,
        "enrollment_number": prof.enrollment_number,
        "gr_number": prof.gr_number,
        "department": prof.department
    }

@router.get("/results", dependencies=[Depends(require_roles([RoleEnum.STUDENT]))])
async def get_student_results(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        return []
        
    runs_res = await db.execute(
        select(StudentVivaRun, ExamRun, Exam)
        .join(ExamRun, StudentVivaRun.exam_run_id == ExamRun.id)
        .join(Exam, ExamRun.exam_id == Exam.id)
        .where(StudentVivaRun.student_id == prof.id)
    )
    
    results = []
    for sr, er, ex in runs_res.all():
        if sr.is_published:
            results.append({
                "subject": ex.subject_name,
                "score": sr.total_score,
                "grade": sr.grade,
                "completed_at": sr.completed_at
            })
            
    return results

@router.get("/scheduled-exams", dependencies=[Depends(require_roles([RoleEnum.STUDENT]))])
async def get_scheduled_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Just returning a placeholder array for scheduled exams
    return [
        {"subject": "Data Structures", "date": "2026-10-15 10:00 AM", "location": "Lab 3"},
        {"subject": "Operating Systems", "date": "2026-10-18 02:00 PM", "location": "Lab 1"}
    ]
