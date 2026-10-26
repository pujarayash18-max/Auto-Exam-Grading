from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import StudentProfile
from app.models.viva import StudentVivaRun, StudentVivaAnswer, ExamRun
from app.models.exam import Exam, ExamQuestion

router = APIRouter()

@router.get("/profile", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    dept_name = prof.department.name if prof.department else "General"
    class_name = prof.student_class.name if prof.student_class else "Unassigned"
    
    return {
        "name": prof.name or current_user.first_name,
        "enrollment_number": prof.enrollment_number,
        "gr_number": prof.gr_number,
        "department": dept_name,
        "class_name": class_name
    }

@router.get("/results", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
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
        .order_by(StudentVivaRun.id.desc())
    )
    
    results = []
    for sr, er, ex in runs_res.all():
        if sr.is_published:
            ans_res = await db.execute(
                select(StudentVivaAnswer, ExamQuestion)
                .join(ExamQuestion, StudentVivaAnswer.question_id == ExamQuestion.id)
                .where(StudentVivaAnswer.viva_run_id == sr.id)
            )
            answers_list = []
            show_grades = sr.publish_grades if sr.publish_grades is not None else True
            for ans, q in ans_res.all():
                answers_list.append({
                    "question_text": q.question_text,
                    "transcript": ans.transcript,
                    "score_awarded": ans.score_awarded if show_grades else None,
                    "feedback": ans.feedback or "",
                    "areas_to_improve": ans.areas_to_improve or ""
                })
                
            results.append({
                "viva_run_id": sr.id,
                "subject": ex.subject_name,
                "publish_grades": show_grades,
                "score": sr.total_score if show_grades else None,
                "grade": sr.grade if show_grades else None,
                "completed_at": sr.completed_at,
                "feedback": sr.feedback_notes or "",
                "remarks": sr.feedback_notes or "",
                "answers": answers_list
            })
            
    return results

@router.get("/scheduled-exams", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_scheduled_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof or not prof.class_id:
        return []

    exams_res = await db.execute(
        select(Exam)
        .where(Exam.class_id == prof.class_id)
        .order_by(Exam.id.desc())
    )
    
    exams = []
    for ex in exams_res.scalars().all():
        exams.append({
            "id": ex.id,
            "subject_name": ex.subject_name,
            "timer_per_question_minutes": ex.timer_per_question_minutes,
            "questions_per_student": ex.questions_per_student,
            "scheduled_date": ex.scheduled_date,
            "location": ex.location
        })
        
    return exams
