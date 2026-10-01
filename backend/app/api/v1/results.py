from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.viva import ExamRun, StudentVivaRun
from app.models.profile import FacultyProfile

router = APIRouter()

class OverrideScoreRequest(BaseModel):
    new_score: float
    new_grade: str

class PublishResultRequest(BaseModel):
    publish: bool

@router.get("/exams/{exam_run_id}/results", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def get_exam_results(
    exam_run_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    
    # Verify exam run ownership
    run = await db.get(ExamRun, exam_run_id)
    if not run or (prof and run.exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Unauthorized or not found")
        
    student_runs_res = await db.execute(select(StudentVivaRun).where(StudentVivaRun.exam_run_id == exam_run_id))
    student_runs = student_runs_res.scalars().all()
    
    results = []
    for sr in student_runs:
        results.append({
            "viva_run_id": sr.id,
            "student_id": sr.student_id,
            "total_score": sr.total_score,
            "grade": sr.grade,
            "status": sr.status,
            "is_published": sr.is_published
        })
        
    return results

@router.put("/{viva_run_id}/override", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def override_result(
    viva_run_id: int,
    req: OverrideScoreRequest,
    db: AsyncSession = Depends(get_db)
):
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    sr.total_score = req.new_score
    sr.grade = req.new_grade
    await db.commit()
    
    return {"msg": "Result overridden successfully", "total_score": sr.total_score, "grade": sr.grade}

@router.post("/{viva_run_id}/publish", dependencies=[Depends(require_roles([RoleEnum.FACULTY]))])
async def publish_result(
    viva_run_id: int,
    req: PublishResultRequest,
    db: AsyncSession = Depends(get_db)
):
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    sr.is_published = req.publish
    await db.commit()
    
    return {"msg": f"Result {'published' if req.publish else 'unpublished'} successfully"}
