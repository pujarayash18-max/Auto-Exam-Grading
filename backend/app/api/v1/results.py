import os
import io
import math
import struct
import wave
import json
import zipfile
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.viva import ExamRun, StudentVivaRun, StudentVivaAnswer
from app.models.profile import FacultyProfile, StudentProfile
from app.models.exam import Exam, ExamQuestion

router = APIRouter()

class OverrideScoreRequest(BaseModel):
    new_score: float
    new_grade: str
    faculty_remarks: Optional[str] = None

class PublishResultRequest(BaseModel):
    publish: bool
    publish_grades: Optional[bool] = True

@router.get("/exams/{exam_id}/results", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_exam_results(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    
    exam = await db.get(Exam, exam_id)
    if not exam:
        return []
        
    run_res = await db.execute(select(ExamRun).where(ExamRun.exam_id == exam_id).order_by(ExamRun.id.desc()))
    run = run_res.scalars().first()
    
    if not run:
        return []
        
    student_runs_res = await db.execute(select(StudentVivaRun).where(StudentVivaRun.exam_run_id == run.id))
    student_runs = student_runs_res.scalars().all()
    
    results = []
    for sr in student_runs:
        student = await db.get(StudentProfile, sr.student_id)
        student_name = student.name if (student and student.name) else f"Student #{sr.student_id}"
        gr_number = student.gr_number if student else "N/A"
        enrollment_no = student.enrollment_number if student else "N/A"
        
        # Fetch real answers and questions evaluated for this student run
        answers_res = await db.execute(
            select(StudentVivaAnswer, ExamQuestion)
            .join(ExamQuestion, StudentVivaAnswer.question_id == ExamQuestion.id)
            .where(StudentVivaAnswer.viva_run_id == sr.id)
        )
        answers_data = []
        for ans, q in answers_res.all():
            has_audio = bool(ans.audio_file_path and os.path.exists(ans.audio_file_path))
            answers_data.append({
                "id": ans.id,
                "question_id": q.id,
                "question_text": q.question_text,
                "expected_answer": q.expected_answer,
                "transcript": ans.transcript or "",
                "score_awarded": ans.score_awarded,
                "feedback": ans.feedback or "",
                "areas_to_improve": ans.areas_to_improve or "",
                "has_audio": has_audio,
                "audio_url": f"/api/v1/results/answers/{ans.id}/audio" if has_audio else None,
                "audio_file_path": ans.audio_file_path
            })
            
        results.append({
            "viva_run_id": sr.id,
            "student_id": sr.student_id,
            "name": student_name,
            "gr_number": gr_number,
            "enrollment_number": enrollment_no,
            "total_score": sr.total_score if sr.total_score is not None else 0.0,
            "max_score": 100,
            "grade": sr.grade or "Pending",
            "status": sr.status.value if hasattr(sr.status, "value") else str(sr.status),
            "is_published": sr.is_published,
            "publish_grades": sr.publish_grades if sr.publish_grades is not None else True,
            "feedback_notes": sr.feedback_notes or "",
            "answers_count": len(answers_data),
            "answers": answers_data
        })
        
    return results

@router.put("/{viva_run_id}/override", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
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
    if req.faculty_remarks:
        sr.feedback_notes = req.faculty_remarks
    await db.commit()
    
    return {"msg": "Result overridden successfully", "total_score": sr.total_score, "grade": sr.grade}

@router.post("/{viva_run_id}/publish", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def publish_result(
    viva_run_id: int,
    req: PublishResultRequest,
    db: AsyncSession = Depends(get_db)
):
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    sr.is_published = req.publish
    if req.publish_grades is not None:
        sr.publish_grades = req.publish_grades
    await db.commit()
    
    return {
        "msg": f"Result {'published' if req.publish else 'unpublished'} successfully",
        "is_published": sr.is_published,
        "publish_grades": sr.publish_grades
    }


@router.post("/{viva_run_id}/generate-report", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def generate_report_endpoint(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Generate or refresh the AI diagnostic improvement report for a student viva run."""
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    run = await db.get(ExamRun, sr.exam_run_id)
    exam = await db.get(Exam, run.exam_id)
    
    answers_res = await db.execute(
        select(StudentVivaAnswer, ExamQuestion)
        .join(ExamQuestion, StudentVivaAnswer.question_id == ExamQuestion.id)
        .where(StudentVivaAnswer.viva_run_id == sr.id)
    )
    qa_records = []
    for ans, q in answers_res.all():
        qa_records.append({
            "question_text": q.question_text,
            "transcript": ans.transcript or "",
            "score": ans.score_awarded,
            "areas_to_improve": ans.areas_to_improve or ans.feedback or ""
        })
        
    from app.ai.llm import generate_viva_improvement_report
    report = await generate_viva_improvement_report(exam.subject_name, qa_records)
    sr.feedback_notes = report
    await db.commit()
    return {"msg": "Improvement report generated successfully", "report": report}


@router.get("/{viva_run_id}/transcript/download", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.STUDENT]))])
async def download_transcript(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    student = await db.get(StudentProfile, sr.student_id)
    student_name = student.name if student else f"Student_{sr.student_id}"
    
    answers_res = await db.execute(
        select(StudentVivaAnswer, ExamQuestion)
        .join(ExamQuestion, StudentVivaAnswer.question_id == ExamQuestion.id)
        .where(StudentVivaAnswer.viva_run_id == sr.id)
    )
    
    content_lines = []
    content_lines.append("=" * 60)
    content_lines.append("       AUTOEXAMGRADING - OFFICIAL VIVA EVALUATION REPORT")
    content_lines.append("=" * 60)
    content_lines.append(f"Student Name:      {student_name}")
    content_lines.append(f"Enrollment Number: {student.enrollment_number if student else 'N/A'}")
    content_lines.append(f"GR Number:         {student.gr_number if student else 'N/A'}")
    if sr.publish_grades:
        content_lines.append(f"Total Score:       {sr.total_score if sr.total_score is not None else 'N/A'}%")
        content_lines.append(f"Final Grade:       {sr.grade if sr.grade else 'N/A'}")
    else:
        content_lines.append("Grades:            [Withheld / Not Released by Faculty]")
    content_lines.append("-" * 60)
    
    if sr.feedback_notes:
        content_lines.append("DIAGNOSTIC REPORT & AREAS TO IMPROVE:")
        content_lines.append(sr.feedback_notes)
        content_lines.append("-" * 60)
        
    content_lines.append("QUESTION-BY-QUESTION BREAKDOWN:")
    content_lines.append("")
    
    for idx, (ans, q) in enumerate(answers_res.all(), 1):
        content_lines.append(f"[{idx}] Question: {q.question_text}")
        if q.expected_answer:
            content_lines.append(f"    Expected Answer Reference: {q.expected_answer}")
        content_lines.append(f"    Student Spoken Answer:     \"{ans.transcript or 'No speech recorded.'}\"")
        if sr.publish_grades:
            content_lines.append(f"    Ollama AI Score:           {ans.score_awarded}/100")
        if ans.feedback:
            content_lines.append(f"    AI Evaluation Judgment:    {ans.feedback}")
        if ans.areas_to_improve:
            content_lines.append(f"    Areas Needing Improvement: {ans.areas_to_improve}")
        content_lines.append("-" * 60)
        
    text_content = "\n".join(content_lines)
    
    return Response(
        content=text_content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=transcript_{student_name.replace(' ', '_')}_{sr.id}.txt"
        }
    )


@router.get("/{viva_run_id}/audio/download", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.STUDENT]))])
async def download_audio(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Download all recorded audio files for a viva run as a zip."""
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
    
    student = await db.get(StudentProfile, sr.student_id)
    student_name = student.name if student else f"Student_{sr.student_id}"
    
    answers_res = await db.execute(
        select(StudentVivaAnswer, ExamQuestion)
        .join(ExamQuestion, StudentVivaAnswer.question_id == ExamQuestion.id)
        .where(StudentVivaAnswer.viva_run_id == sr.id)
    )
    
    audio_files = []
    for idx, (ans, q) in enumerate(answers_res.all(), 1):
        if ans.audio_file_path and os.path.exists(ans.audio_file_path):
            audio_files.append({
                "path": ans.audio_file_path,
                "name": f"Q{idx}_{q.question_text[:30].replace(' ', '_').replace('?', '')}.webm"
            })
    
    if not audio_files:
        raise HTTPException(status_code=404, detail="No audio recordings found for this viva")
    
    # If only one audio file, return it directly
    if len(audio_files) == 1:
        return FileResponse(
            audio_files[0]["path"],
            media_type="audio/webm",
            filename=f"audio_{student_name.replace(' ', '_')}_{sr.id}.webm"
        )
    
    # Multiple files: create a zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for af in audio_files:
            zf.write(af["path"], af["name"])
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=audio_{student_name.replace(' ', '_')}_{sr.id}.zip"
        }
    )


@router.get("/{viva_run_id}/audio/check", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.STUDENT]))])
async def check_audio_available(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Check if audio recordings exist for a viva run."""
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        return {"has_audio": False}
    
    answers_res = await db.execute(
        select(StudentVivaAnswer)
        .where(StudentVivaAnswer.viva_run_id == sr.id)
    )
    
    for ans in answers_res.scalars().all():
        if ans.audio_file_path and os.path.exists(ans.audio_file_path):
            return {"has_audio": True}
    
    return {"has_audio": False}


@router.get("/answers/{answer_id}/audio", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.STUDENT]))])
async def stream_answer_audio(
    answer_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Streams an individual student viva answer audio file."""
    ans = await db.get(StudentVivaAnswer, answer_id)
    if not ans or not ans.audio_file_path or not os.path.exists(ans.audio_file_path):
        raise HTTPException(status_code=404, detail="Audio recording not found")
        
    return FileResponse(
        ans.audio_file_path,
        media_type="audio/webm",
        filename=os.path.basename(ans.audio_file_path)
    )
