import random
import string
import os
import io
import csv
import re
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

logger = logging.getLogger("uvicorn.error")

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.profile import FacultyProfile, StudentProfile, Class
from app.models.mcq import (
    MCQExam, MCQQuestion, MCQStudentAttempt, MCQStudentAnswer,
    MCQAttemptStatus, MCQReleaseMode
)
from app.core.mcq_template import generate_sample_template, generate_sample_csv, parse_mcq_template
from app.ai.mcq_generator import generate_mcq_from_material
from app.ai.document_parser import extract_text, clean_subject_name, sanitize_exam_text

router = APIRouter()

UPLOAD_DIR = "uploads/mcq_materials"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ----------------- SCHEMAS -----------------

class CreateExamRequest(BaseModel):
    subject_name: str
    class_id: int
    duration_minutes: int = 30
    total_marks: float = 100.0
    questions_per_student: int = 10
    shuffle_options: bool = True
    release_mode: str = MCQReleaseMode.IMMEDIATE.value
    enable_blooms_taxonomy: bool = True
    access_pin: Optional[str] = None

class QuestionItem(BaseModel):
    id: Optional[int] = None
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: Optional[str] = None
    bloom_level: Optional[str] = "Understand"

class BatchQuestionsRequest(BaseModel):
    questions: List[QuestionItem]

class VerifyPinRequest(BaseModel):
    access_pin: str

class StartAttemptRequest(BaseModel):
    access_pin: Optional[str] = None

class LockoutReportRequest(BaseModel):
    reason: Optional[str] = "Window blur or tab switch detected"

class AnswerSubmission(BaseModel):
    question_id: int
    selected_option: Optional[str] = None # 'A', 'B', 'C', 'D' or None

class SaveAnswerRequest(BaseModel):
    question_id: int
    selected_option: Optional[str] = None

class SubmitAttemptRequest(BaseModel):
    answers: List[AnswerSubmission]


def _generate_pin(length: int = 6) -> str:
    """Generate a clean numeric access PIN."""
    return "".join(random.choices(string.digits, k=length))


def _calculate_letter_grade(percentage: float) -> str:
    if percentage >= 90.0: return "A+"
    if percentage >= 80.0: return "A"
    if percentage >= 70.0: return "B"
    if percentage >= 60.0: return "C"
    if percentage >= 50.0: return "D"
    return "F"


# ----------------- EXAM MANAGEMENT (FACULTY) -----------------

@router.post("/exams", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def create_mcq_exam(
    req: CreateExamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    fac_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    fac = fac_res.scalars().first()
    if not fac and current_user.role != RoleEnum.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Faculty profile not found")

    faculty_id = fac.id if fac else 1

    # Check class existence
    cls = await db.get(Class, req.class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Target class not found")

    pin = req.access_pin.strip() if req.access_pin and req.access_pin.strip() else _generate_pin()
    
    # Ensure pin uniqueness among active exams
    existing = await db.execute(select(MCQExam).where(MCQExam.access_pin == pin, MCQExam.is_active == True))
    if existing.scalars().first():
        pin = _generate_pin()

    exam = MCQExam(
        faculty_id=faculty_id,
        class_id=req.class_id,
        subject_name=req.subject_name.strip(),
        access_pin=pin,
        duration_minutes=max(1, req.duration_minutes),
        total_marks=max(1.0, req.total_marks),
        questions_per_student=max(1, req.questions_per_student),
        shuffle_options=req.shuffle_options,
        release_mode=req.release_mode if req.release_mode in [MCQReleaseMode.IMMEDIATE.value, MCQReleaseMode.WITHHELD.value] else MCQReleaseMode.IMMEDIATE.value,
        enable_blooms_taxonomy=req.enable_blooms_taxonomy,
        is_active=True
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)

    return {
        "id": exam.id,
        "access_pin": exam.access_pin,
        "subject_name": exam.subject_name,
        "class_id": exam.class_id,
        "class_name": cls.name,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "questions_per_student": exam.questions_per_student,
        "release_mode": exam.release_mode,
        "enable_blooms_taxonomy": bool(exam.enable_blooms_taxonomy),
        "is_active": exam.is_active,
        "created_at": exam.created_at.isoformat()
    }


@router.get("/exams")
async def list_mcq_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role in [RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]:
        fac_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
        fac = fac_res.scalars().first()
        query = select(MCQExam, Class).join(Class, MCQExam.class_id == Class.id)
        if fac and current_user.role == RoleEnum.FACULTY:
            query = query.where(MCQExam.faculty_id == fac.id)
        query = query.order_by(MCQExam.id.desc())
        results = (await db.execute(query)).all()

        exams_list = []
        for exam, cls in results:
            q_cnt = await db.scalar(select(func.count(MCQQuestion.id)).where(MCQQuestion.mcq_exam_id == exam.id))
            att_cnt = await db.scalar(select(func.count(MCQStudentAttempt.id)).where(MCQStudentAttempt.mcq_exam_id == exam.id))
            locked_cnt = await db.scalar(select(func.count(MCQStudentAttempt.id)).where(
                MCQStudentAttempt.mcq_exam_id == exam.id,
                MCQStudentAttempt.status == MCQAttemptStatus.LOCKED_OUT
            ))
            submitted_cnt = await db.scalar(select(func.count(MCQStudentAttempt.id)).where(
                MCQStudentAttempt.mcq_exam_id == exam.id,
                MCQStudentAttempt.status == MCQAttemptStatus.SUBMITTED
            ))
            exams_list.append({
                "id": exam.id,
                "access_pin": exam.access_pin,
                "subject_name": exam.subject_name,
                "class_id": exam.class_id,
                "class_name": cls.name,
                "duration_minutes": exam.duration_minutes,
                "total_marks": exam.total_marks,
                "questions_per_student": exam.questions_per_student,
                "release_mode": exam.release_mode,
                "enable_blooms_taxonomy": bool(exam.enable_blooms_taxonomy),
                "is_active": exam.is_active,
                "total_questions_in_pool": q_cnt or 0,
                "total_attempts": att_cnt or 0,
                "locked_attempts": locked_cnt or 0,
                "submitted_attempts": submitted_cnt or 0,
                "created_at": exam.created_at.isoformat()
            })
        return exams_list

    elif current_user.role == RoleEnum.STUDENT:
        stud_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
        stud = stud_res.scalars().first()
        if not stud or not stud.class_id:
            return []

        query = (
            select(MCQExam, Class)
            .join(Class, MCQExam.class_id == Class.id)
            .where(MCQExam.class_id == stud.class_id, MCQExam.is_active == True)
            .order_by(MCQExam.id.desc())
        )
        results = (await db.execute(query)).all()

        exams_list = []
        for exam, cls in results:
            att_res = await db.execute(
                select(MCQStudentAttempt).where(
                    MCQStudentAttempt.mcq_exam_id == exam.id,
                    MCQStudentAttempt.student_id == stud.id
                )
            )
            att = att_res.scalars().first()

            exams_list.append({
                "id": exam.id,
                "subject_name": exam.subject_name,
                "class_name": cls.name,
                "duration_minutes": exam.duration_minutes,
                "total_marks": exam.total_marks,
                "questions_count": exam.questions_per_student,
                "attempt_status": att.status.value if att else "not_started",
                "attempt_id": att.id if att else None,
                "score_awarded": att.score_awarded if (att and att.status == MCQAttemptStatus.SUBMITTED and exam.release_mode == MCQReleaseMode.IMMEDIATE.value) else None,
                "grade": att.grade if (att and att.status == MCQAttemptStatus.SUBMITTED and exam.release_mode == MCQReleaseMode.IMMEDIATE.value) else None,
                "percentage": att.percentage if (att and att.status == MCQAttemptStatus.SUBMITTED and exam.release_mode == MCQReleaseMode.IMMEDIATE.value) else None,
                "submitted_at": att.submitted_at.isoformat() if (att and att.submitted_at) else None,
                "is_grade_released": (exam.release_mode == MCQReleaseMode.IMMEDIATE.value) if (att and att.status == MCQAttemptStatus.SUBMITTED) else False,
                "release_mode": exam.release_mode
            })
        return exams_list


@router.get("/exams/{exam_id}")
async def get_exam_details(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    cls = await db.get(Class, exam.class_id)
    q_cnt = await db.scalar(select(func.count(MCQQuestion.id)).where(MCQQuestion.mcq_exam_id == exam.id))

    return {
        "id": exam.id,
        "access_pin": exam.access_pin,
        "subject_name": exam.subject_name,
        "class_id": exam.class_id,
        "class_name": cls.name if cls else "Unknown",
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "questions_per_student": exam.questions_per_student,
        "shuffle_options": exam.shuffle_options,
        "release_mode": exam.release_mode,
        "enable_blooms_taxonomy": bool(exam.enable_blooms_taxonomy),
        "is_active": exam.is_active,
        "total_questions_in_pool": q_cnt or 0,
        "created_at": exam.created_at.isoformat()
    }


@router.get("/template/download")
async def download_excel_template():
    """Download standard Excel template for MCQ question upload."""
    excel_bytes = generate_sample_template()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=MCQ_Questions_Template.xlsx"}
    )


@router.post("/exams/{exam_id}/template-upload", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def upload_mcq_template(
    exam_id: int,
    file: UploadFile = File(...),
    replace_existing: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    try:
        parsed_questions = parse_mcq_template(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse template: {str(e)}")

    if replace_existing:
        await db.execute(delete(MCQQuestion).where(MCQQuestion.mcq_exam_id == exam.id))

    new_questions = []
    for q in parsed_questions:
        q_obj = MCQQuestion(
            mcq_exam_id=exam.id,
            question_text=q["question_text"],
            option_a=q["option_a"],
            option_b=q["option_b"],
            option_c=q["option_c"],
            option_d=q["option_d"],
            correct_option=q["correct_option"],
            explanation=q["explanation"],
            bloom_level=q["bloom_level"]
        )
        db.add(q_obj)
        new_questions.append(q_obj)

    await db.commit()

    total_pool = await db.scalar(select(func.count(MCQQuestion.id)).where(MCQQuestion.mcq_exam_id == exam.id))
    return {
        "success": True,
        "questions_imported": len(new_questions),
        "total_questions_in_pool": total_pool,
        "message": f"Successfully imported {len(new_questions)} questions from template."
    }


@router.post("/exams/{exam_id}/ai-generate", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def generate_mcqs_from_notes(
    exam_id: int,
    num_questions: int = Form(10),
    notes_text: Optional[str] = Form(None),
    replace_existing: bool = Form(False),
    enable_blooms_taxonomy: Optional[bool] = Form(None),
    materials_weightages: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    use_blooms = enable_blooms_taxonomy if enable_blooms_taxonomy is not None else bool(getattr(exam, 'enable_blooms_taxonomy', True))

    # Parse weightage percentages map if supplied
    parsed_weight_map = {}
    if materials_weightages and isinstance(materials_weightages, str) and materials_weightages.strip() not in ["", "undefined", "null"]:
        try:
            w_data = json.loads(materials_weightages)
            if isinstance(w_data, dict):
                parsed_weight_map = {str(k).strip(): float(v) for k, v in w_data.items()}
            elif isinstance(w_data, list):
                for item in w_data:
                    if isinstance(item, dict):
                        k = str(item.get("filename") or item.get("name") or "").strip()
                        v = float(item.get("weightage") or item.get("weight") or 0)
                        if k:
                            parsed_weight_map[k] = v
        except Exception as e:
            logger.warning(f"Could not parse materials_weightages: {e}")

    # Collect all uploaded files (single and multiple)
    uploaded_files: List[UploadFile] = []
    if files:
        uploaded_files.extend([f for f in files if f and f.filename])
    if file and file.filename and file not in uploaded_files:
        uploaded_files.append(file)

    materials_list = []
    for f in uploaded_files:
        file_bytes = await f.read()
        file_ext = os.path.splitext(f.filename)[1].lower().replace(".", "")
        saved_path = os.path.join(UPLOAD_DIR, f"{exam.id}_{f.filename}")
        with open(saved_path, "wb") as out_f:
            out_f.write(file_bytes)
        txt = extract_text(saved_path, file_ext) or ""
        w = parsed_weight_map.get(f.filename) or parsed_weight_map.get(os.path.basename(f.filename)) or 0.0
        materials_list.append({
            "name": f.filename,
            "text": txt.strip(),
            "path": saved_path,
            "weight": w
        })

    # If raw lecture notes text is provided, treat as an additional or sole material
    if (notes_text or "").strip():
        txt = notes_text.strip()
        w = parsed_weight_map.get("Notes") or parsed_weight_map.get("text_notes") or 0.0
        materials_list.append({
            "name": "Lecture Notes",
            "text": txt,
            "path": None,
            "weight": w
        })

    # Default fallback syllabus if nothing provided
    if not materials_list:
        materials_list.append({
            "name": f"{clean_subject_name(exam.subject_name)} Syllabus",
            "text": f"Core principles, key architectural patterns, operational methods, and applied problem solving in {clean_subject_name(exam.subject_name)}.",
            "path": None,
            "weight": 100.0
        })

    # Normalize weights so each material gets a fair or configured percentage share
    total_specified_weight = sum(m["weight"] for m in materials_list)
    if total_specified_weight <= 0:
        equal_weight = 100.0 / len(materials_list)
        for m in materials_list:
            m["weight"] = equal_weight
        total_specified_weight = 100.0

    # Distribute question counts proportionally across materials
    allocated_counts = []
    accumulated_questions = 0
    for idx, mat in enumerate(materials_list):
        if idx == len(materials_list) - 1:
            q_count = max(1, num_questions - accumulated_questions)
        else:
            q_count = max(1, round(num_questions * (mat["weight"] / total_specified_weight)))
            accumulated_questions += q_count
        allocated_counts.append(q_count)

    fac_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    fac = fac_res.scalars().first()
    faculty_id = fac.id if fac else None

    # Generate questions across each material segment
    all_generated = []
    clean_subj = clean_subject_name(exam.subject_name)
    for mat, count in zip(materials_list, allocated_counts):
        mat_text = mat["text"] if mat["text"] else f"Core concepts of {clean_subj}"
        gen = await generate_mcq_from_material(
            content_text=mat_text,
            file_path=mat.get("path"),
            num_questions=count,
            subject=clean_subj,
            faculty_id=faculty_id,
            exam_id=exam.id,
            enable_blooms_taxonomy=use_blooms
        )
        if gen:
            all_generated.extend(gen)

    if not all_generated:
        raise HTTPException(status_code=500, detail="AI generation failed to produce valid questions. Please try again or use template upload.")

    if replace_existing:
        await db.execute(delete(MCQQuestion).where(MCQQuestion.mcq_exam_id == exam.id))

    for item in all_generated:
        q_obj = MCQQuestion(
            mcq_exam_id=exam.id,
            question_text=sanitize_exam_text(item["question_text"]),
            option_a=sanitize_exam_text(item["option_a"]),
            option_b=sanitize_exam_text(item["option_b"]),
            option_c=sanitize_exam_text(item["option_c"]),
            option_d=sanitize_exam_text(item["option_d"]),
            correct_option=item["correct_option"],
            explanation=sanitize_exam_text(item.get("explanation")),
            bloom_level=item.get("bloom_level", "Understand") if use_blooms else "Standard"
        )
        db.add(q_obj)

    await db.commit()

    total_pool = await db.scalar(select(func.count(MCQQuestion.id)).where(MCQQuestion.mcq_exam_id == exam.id))
    return {
        "success": True,
        "questions_generated": len(all_generated),
        "total_questions_in_pool": total_pool,
        "questions": all_generated
    }


@router.get("/exams/{exam_id}/questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def get_exam_questions(
    exam_id: int,
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    q_res = await db.execute(select(MCQQuestion).where(MCQQuestion.mcq_exam_id == exam.id).order_by(MCQQuestion.id.asc()))
    questions = q_res.scalars().all()

    return [
        {
            "id": q.id,
            "question_text": q.question_text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "correct_option": q.correct_option,
            "explanation": q.explanation,
            "bloom_level": q.bloom_level
        }
        for q in questions
    ]


@router.delete("/questions/{question_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db)
):
    q = await db.get(MCQQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(q)
    await db.commit()
    return {"success": True, "message": "Question deleted"}


@router.post("/exams/{exam_id}/questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def add_single_question(
    exam_id: int,
    req: QuestionItem,
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    correct = req.correct_option.strip().upper()
    if correct not in ["A", "B", "C", "D"]:
        raise HTTPException(status_code=400, detail="correct_option must be A, B, C, or D")

    q = MCQQuestion(
        mcq_exam_id=exam.id,
        question_text=req.question_text.strip(),
        option_a=req.option_a.strip(),
        option_b=req.option_b.strip(),
        option_c=req.option_c.strip(),
        option_d=req.option_d.strip(),
        correct_option=correct,
        explanation=req.explanation.strip() if req.explanation else None,
        bloom_level=req.bloom_level.strip() if req.bloom_level else "Understand"
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return {
        "success": True,
        "question": {
            "id": q.id,
            "question_text": q.question_text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "correct_option": q.correct_option,
            "explanation": q.explanation,
            "bloom_level": q.bloom_level
        }
    }


@router.delete("/exams/{exam_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def delete_mcq_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    await db.delete(exam)
    await db.commit()
    return {"success": True, "message": "Exam and associated records deleted"}


@router.patch("/exams/{exam_id}/toggle-release", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def toggle_release_mode(
    exam_id: int,
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    new_mode = MCQReleaseMode.WITHHELD.value if exam.release_mode == MCQReleaseMode.IMMEDIATE.value else MCQReleaseMode.IMMEDIATE.value
    exam.release_mode = new_mode
    await db.commit()
    return {"success": True, "release_mode": new_mode}


@router.patch("/exams/{exam_id}/toggle-active", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def toggle_exam_active(
    exam_id: int,
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam.is_active = not exam.is_active
    await db.commit()
    return {"success": True, "is_active": exam.is_active}


# ----------------- STUDENT TEST EXECUTION & ANTI-CHEAT -----------------

@router.post("/verify-pin", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def verify_exam_pin(
    req: VerifyPinRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    clean_pin = req.access_pin.strip()
    if not clean_pin:
        raise HTTPException(status_code=400, detail="Please enter an access PIN.")

    exam_res = await db.execute(select(MCQExam).where(MCQExam.access_pin == clean_pin, MCQExam.is_active == True))
    exam = exam_res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Invalid exam PIN or exam is not currently active.")

    stud_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    stud = stud_res.scalars().first()
    
    if current_user.role == RoleEnum.STUDENT:
        if not stud:
            raise HTTPException(status_code=403, detail="Student profile not found.")
        if stud.class_id != exam.class_id:
            cls = await db.get(Class, exam.class_id)
            cls_name = cls.name if cls else "Assigned Class"
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: This exam is reserved exclusively for students enrolled in {cls_name}. You are not on this class roster."
            )

    student_id = stud.id if stud else None
    attempt_status = "not_started"
    attempt_id = None
    already_submitted = False
    
    if student_id:
        att_res = await db.execute(
            select(MCQStudentAttempt).where(
                MCQStudentAttempt.mcq_exam_id == exam.id,
                MCQStudentAttempt.student_id == student_id
            )
        )
        att = att_res.scalars().first()
        if att:
            attempt_status = att.status.value
            attempt_id = att.id
            if att.status == MCQAttemptStatus.SUBMITTED:
                already_submitted = True

    cls = await db.get(Class, exam.class_id)
    return {
        "valid": True,
        "exam_id": exam.id,
        "subject_name": exam.subject_name,
        "class_name": cls.name if cls else "Enrolled Class",
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "questions_count": exam.questions_per_student,
        "attempt_status": attempt_status,
        "attempt_id": attempt_id,
        "already_submitted": already_submitted
    }


@router.post("/exams/{exam_id}/start", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def start_student_attempt(
    exam_id: int,
    pin: Optional[str] = Query(None),
    body: Optional[StartAttemptRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(MCQExam, exam_id)
    if not exam or not exam.is_active:
        raise HTTPException(status_code=404, detail="Exam not found or inactive")

    stud_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    stud = stud_res.scalars().first()
    if not stud and current_user.role == RoleEnum.STUDENT:
        raise HTTPException(status_code=403, detail="Student profile not found")

    if current_user.role == RoleEnum.STUDENT and stud.class_id != exam.class_id:
        raise HTTPException(status_code=403, detail="Access denied: You are not enrolled in this exam's class.")

    student_id = stud.id if stud else 1

    # Check for existing attempt
    att_res = await db.execute(
        select(MCQStudentAttempt).where(
            MCQStudentAttempt.mcq_exam_id == exam.id,
            MCQStudentAttempt.student_id == student_id
        )
    )
    attempt = att_res.scalars().first()

    if attempt and attempt.status == MCQAttemptStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="You have already submitted this exam.")

    if attempt and attempt.status == MCQAttemptStatus.LOCKED_OUT:
        # Check if faculty approved re-entry
        if not attempt.faculty_approved:
            return {
                "locked": True,
                "attempt_id": attempt.id,
                "status": "locked_out",
                "lockout_count": attempt.lockout_count,
                "message": "Exam window locked due to leaving the exam. Please wait for faculty approval to resume."
            }
        else:
            # Re-entry approved by faculty! Set back to in_progress
            attempt.status = MCQAttemptStatus.IN_PROGRESS
            await db.commit()

    if not attempt:
        # Direct URL protection: Validate exam access PIN for new attempt
        provided_pin = ((body.access_pin if body else None) or pin or "").strip()
        if not provided_pin or provided_pin != exam.access_pin:
            raise HTTPException(
                status_code=403,
                detail="Invalid exam access PIN. Please enter the valid 6-digit access PIN provided by your faculty."
            )

        # Fetch question IDs for this exam
        q_ids_res = await db.execute(select(MCQQuestion.id).where(MCQQuestion.mcq_exam_id == exam.id))
        all_ids = q_ids_res.scalars().all()
        if not all_ids:
            raise HTTPException(status_code=400, detail="No questions have been configured for this exam yet. Please inform your faculty.")

        sample_size = min(len(all_ids), exam.questions_per_student)
        selected_ids = random.sample(all_ids, sample_size)
        assigned_str = ",".join(map(str, selected_ids))

        attempt = MCQStudentAttempt(
            mcq_exam_id=exam.id,
            student_id=student_id,
            status=MCQAttemptStatus.IN_PROGRESS,
            assigned_question_ids=assigned_str,
            faculty_approved=True,
            started_at=datetime.now(timezone.utc)
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)

    # Load assigned questions
    assigned_id_list = [int(i.strip()) for i in (attempt.assigned_question_ids or "").split(",") if i.strip()]
    questions_res = await db.execute(select(MCQQuestion).where(MCQQuestion.id.in_(assigned_id_list)))
    questions_map = {q.id: q for q in questions_res.scalars().all()}

    # Preserve order of assigned questions
    ordered_questions = []
    for qid in assigned_id_list:
        if qid in questions_map:
            q = questions_map[qid]
            # IMPORTANT: NEVER expose correct_option or explanation to student during the test!
            ordered_questions.append({
                "id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "bloom_level": q.bloom_level
            })

    # Fetch any already saved answers
    ans_res = await db.execute(select(MCQStudentAnswer).where(MCQStudentAnswer.attempt_id == attempt.id))
    saved_answers = {a.question_id: a.selected_option for a in ans_res.scalars().all()}

    # Calculate remaining time (timezone-resilient)
    now_utc = datetime.now(timezone.utc)
    if attempt.started_at:
        started = attempt.started_at if attempt.started_at.tzinfo else attempt.started_at.replace(tzinfo=timezone.utc)
        elapsed_seconds = (now_utc - started).total_seconds()
    else:
        elapsed_seconds = 0
    total_seconds = exam.duration_minutes * 60
    remaining_seconds = max(0, int(total_seconds - elapsed_seconds))

    return {
        "attempt_id": attempt.id,
        "exam_id": exam.id,
        "subject_name": exam.subject_name,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "total_questions": len(ordered_questions),
        "questions": ordered_questions,
        "saved_answers": saved_answers,
        "status": attempt.status.value,
        "lockout_count": attempt.lockout_count,
        "remaining_seconds": remaining_seconds
    }


@router.post("/attempts/{attempt_id}/lockout")
async def report_attempt_lockout(
    attempt_id: int,
    req: LockoutReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Called immediately by the student's client-side anti-cheat listener
    when window blur, visibility change, or fullscreen exit occurs.
    Locks the attempt and requires faculty approval to re-enter.
    """
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status == MCQAttemptStatus.SUBMITTED:
        return {"status": "submitted", "locked": False}

    attempt.status = MCQAttemptStatus.LOCKED_OUT
    attempt.lockout_count = (attempt.lockout_count or 0) + 1
    attempt.last_lockout_reason = req.reason or "Navigated away from exam window"
    attempt.last_lockout_at = datetime.now(timezone.utc)
    attempt.faculty_approved = False

    await db.commit()

    return {
        "locked": True,
        "status": MCQAttemptStatus.LOCKED_OUT.value,
        "lockout_count": attempt.lockout_count,
        "reason": attempt.last_lockout_reason,
        "message": "Exam attempt locked. You must obtain faculty approval to re-enter."
    }


@router.get("/attempts/{attempt_id}/status")
async def get_attempt_status(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lightweight polling endpoint used by the student's locked screen
    to detect when the faculty has clicked 'Approve Re-entry'.
    """
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    return {
        "status": attempt.status.value,
        "faculty_approved": attempt.faculty_approved,
        "lockout_count": attempt.lockout_count,
        "score_awarded": attempt.score_awarded,
        "percentage": attempt.percentage,
        "grade": attempt.grade
    }


@router.post("/attempts/{attempt_id}/approve-reentry", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def approve_student_reentry(
    attempt_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Faculty live monitor action: unlocks the student and allows them to resume the exam.
    """
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status == MCQAttemptStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Student has already submitted this exam.")

    attempt.status = MCQAttemptStatus.IN_PROGRESS
    attempt.faculty_approved = True
    await db.commit()

    return {
        "success": True,
        "status": MCQAttemptStatus.IN_PROGRESS.value,
        "message": "Student re-entry approved successfully."
    }


@router.post("/attempts/{attempt_id}/save-answer", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def save_attempt_answer(
    attempt_id: int,
    req: SaveAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Real-time draft auto-save. Persists student's chosen option per question
    so if they refresh, get locked out, or crash, their work is never lost.
    """
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status == MCQAttemptStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Exam has already been submitted.")

    clean_option = req.selected_option.strip().upper() if req.selected_option else None
    if clean_option and clean_option not in ["A", "B", "C", "D"]:
        clean_option = None

    ans_res = await db.execute(
        select(MCQStudentAnswer).where(
            MCQStudentAnswer.attempt_id == attempt.id,
            MCQStudentAnswer.question_id == req.question_id
        )
    )
    ans = ans_res.scalars().first()
    if ans:
        ans.selected_option = clean_option
        ans.answered_at = datetime.now(timezone.utc)
    else:
        ans = MCQStudentAnswer(
            attempt_id=attempt.id,
            question_id=req.question_id,
            selected_option=clean_option,
            answered_at=datetime.now(timezone.utc)
        )
        db.add(ans)

    await db.commit()
    return {"success": True, "question_id": req.question_id, "selected_option": clean_option}


@router.post("/attempts/{attempt_id}/submit", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def submit_mcq_attempt(
    attempt_id: int,
    req: SubmitAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Instant deterministic grading upon exam submission.
    Calculates marks with 100% precision. Releases results based on release_mode policy.
    """
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.status == MCQAttemptStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="This attempt has already been submitted.")

    exam = await db.get(MCQExam, attempt.mcq_exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam record not found")

    # Load questions assigned to this student
    assigned_ids = [int(i.strip()) for i in (attempt.assigned_question_ids or "").split(",") if i.strip()]
    q_res = await db.execute(select(MCQQuestion).where(MCQQuestion.id.in_(assigned_ids)))
    questions_map = {q.id: q for q in q_res.scalars().all()}

    total_questions = len(assigned_ids)
    if total_questions == 0:
        total_questions = 1

    marks_per_question = exam.total_marks / total_questions
    correct_count = 0

    # Delete any prior draft answers for this attempt
    await db.execute(delete(MCQStudentAnswer).where(MCQStudentAnswer.attempt_id == attempt.id))

    answers_submitted_map = {ans.question_id: (ans.selected_option.strip().upper() if ans.selected_option else None) for ans in req.answers}

    for qid in assigned_ids:
        question = questions_map.get(qid)
        if not question:
            continue

        selected = answers_submitted_map.get(qid)
        is_correct = False
        marks_earned = 0.0

        if selected and selected in ["A", "B", "C", "D"]:
            if selected == question.correct_option.strip().upper():
                is_correct = True
                marks_earned = marks_per_question
                correct_count += 1

        ans_obj = MCQStudentAnswer(
            attempt_id=attempt.id,
            question_id=qid,
            selected_option=selected,
            is_correct=is_correct,
            marks_awarded=marks_earned,
            answered_at=datetime.now(timezone.utc)
        )
        db.add(ans_obj)

    total_score = round(correct_count * marks_per_question, 2)
    percentage = round((correct_count / total_questions) * 100.0, 2)
    letter_grade = _calculate_letter_grade(percentage)

    attempt.score_awarded = total_score
    attempt.percentage = percentage
    attempt.grade = letter_grade
    attempt.status = MCQAttemptStatus.SUBMITTED
    attempt.submitted_at = datetime.now(timezone.utc)

    await db.commit()

    is_released = (exam.release_mode == MCQReleaseMode.IMMEDIATE.value)

    review_sheet = []
    for qid in assigned_ids:
        q = questions_map.get(qid)
        if q:
            selected = answers_submitted_map.get(qid)
            is_corr = (selected == q.correct_option)
            review_sheet.append({
                "question_id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "selected_option": selected,
                "correct_option": q.correct_option if is_released else None,
                "is_correct": is_corr if is_released else None,
                "explanation": q.explanation if is_released else None,
                "bloom_level": q.bloom_level
            })

    return {
        "status": "submitted",
        "attempt_id": attempt.id,
        "is_grade_released": is_released,
        "score_awarded": total_score if is_released else None,
        "total_marks": exam.total_marks if is_released else None,
        "percentage": percentage if is_released else None,
        "grade": letter_grade if is_released else None,
        "correct_count": correct_count if is_released else None,
        "total_questions": total_questions,
        "review_sheet": review_sheet,
        "message": "Exam evaluated and submitted successfully." if is_released else "Exam submitted successfully. Attempted questions and responses recorded. Official answer keys will be released after faculty concludes the session."
    }


@router.get("/attempts/{attempt_id}/result")
async def get_attempt_result(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    exam = await db.get(MCQExam, attempt.mcq_exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    is_faculty_or_admin = current_user.role in [RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]

    # Check student ownership
    if current_user.role == RoleEnum.STUDENT:
        stud_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
        stud = stud_res.scalars().first()
        if not stud or attempt.student_id != stud.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this attempt")

    is_released = (exam.release_mode == MCQReleaseMode.IMMEDIATE.value) or is_faculty_or_admin

    # Fetch questions and student answers
    assigned_ids = [int(i.strip()) for i in (attempt.assigned_question_ids or "").split(",") if i.strip()]
    questions_map = {}
    if assigned_ids:
        q_res = await db.execute(select(MCQQuestion).where(MCQQuestion.id.in_(assigned_ids)))
        questions_map = {q.id: q for q in q_res.scalars().all()}

    ans_res = await db.execute(select(MCQStudentAnswer).where(MCQStudentAnswer.attempt_id == attempt.id))
    answers_map = {a.question_id: a for a in ans_res.scalars().all()}

    review_sheet = []
    correct_count = 0
    for qid in assigned_ids:
        q = questions_map.get(qid)
        if q:
            a = answers_map.get(qid)
            selected = a.selected_option if a else None
            is_corr = a.is_correct if a else False
            if is_corr:
                correct_count += 1
            review_sheet.append({
                "question_id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "selected_option": selected,
                "correct_option": q.correct_option if is_released else None,
                "is_correct": is_corr if is_released else None,
                "explanation": q.explanation if is_released else None,
                "bloom_level": q.bloom_level
            })

    answered_count = len([a for a in answers_map.values() if a.selected_option])

    return {
        "attempt_id": attempt.id,
        "status": attempt.status.value,
        "is_grade_released": is_released,
        "subject_name": exam.subject_name,
        "score_awarded": attempt.score_awarded if is_released else None,
        "total_marks": exam.total_marks,
        "percentage": attempt.percentage if is_released else None,
        "grade": attempt.grade if is_released else None,
        "correct_count": correct_count if is_released else None,
        "total_questions": len(assigned_ids),
        "answered_count": answered_count,
        "lockout_count": attempt.lockout_count,
        "started_at": attempt.started_at.isoformat() if attempt.started_at else None,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "review_sheet": review_sheet,
        "message": "Full evaluation and explanations available." if is_released else "Attempted questions and your submitted responses are displayed. Answer keys and grades are withheld by faculty policy."
    }


# ----------------- FACULTY LIVE MONITOR -----------------

@router.get("/exams/{exam_id}/monitor", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def get_exam_live_monitor(
    exam_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Real-time dashboard for faculty showing all enrolled students,
    PIN code, live lockout warnings, and instant 'Approve Re-entry' action.
    """
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    cls = await db.get(Class, exam.class_id)
    
    # Get all students enrolled in this class
    students_res = await db.execute(select(StudentProfile).where(StudentProfile.class_id == exam.class_id))
    students = students_res.scalars().all()

    # Get all attempts for this exam
    attempts_res = await db.execute(select(MCQStudentAttempt).where(MCQStudentAttempt.mcq_exam_id == exam.id))
    attempts_map = {att.student_id: att for att in attempts_res.scalars().all()}

    student_rows = []
    stats = {
        "total_enrolled": len(students),
        "not_started": 0,
        "in_progress": 0,
        "locked_out": 0,
        "submitted": 0,
        "average_score": 0.0
    }
    
    total_submitted_scores = 0.0
    submitted_students_count = 0

    for s in students:
        att = attempts_map.get(s.id)
        status_val = att.status.value if att else "not_started"
        
        if status_val == "not_started": stats["not_started"] += 1
        elif status_val == "in_progress": stats["in_progress"] += 1
        elif status_val == "locked_out": stats["locked_out"] += 1
        elif status_val == "submitted":
            stats["submitted"] += 1
            if att and att.score_awarded is not None:
                total_submitted_scores += att.score_awarded
                submitted_students_count += 1

        student_rows.append({
            "student_id": s.id,
            "name": s.name,
            "enrollment_number": s.enrollment_number,
            "gr_number": s.gr_number,
            "attempt_id": att.id if att else None,
            "status": status_val,
            "lockout_count": att.lockout_count if att else 0,
            "last_lockout_reason": att.last_lockout_reason if att else None,
            "last_lockout_at": att.last_lockout_at.isoformat() if (att and att.last_lockout_at) else None,
            "faculty_approved": att.faculty_approved if att else True,
            "score_awarded": att.score_awarded if att else None,
            "percentage": att.percentage if att else None,
            "grade": att.grade if att else None,
            "started_at": att.started_at.isoformat() if (att and att.started_at) else None,
            "submitted_at": att.submitted_at.isoformat() if (att and att.submitted_at) else None
        })

    if submitted_students_count > 0:
        stats["average_score"] = round(total_submitted_scores / submitted_students_count, 2)

    return {
        "exam_id": exam.id,
        "subject_name": exam.subject_name,
        "class_name": cls.name if cls else "Enrolled Class",
        "access_pin": exam.access_pin,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "questions_per_student": exam.questions_per_student,
        "release_mode": exam.release_mode,
        "is_active": exam.is_active,
        "stats": stats,
        "students": student_rows
    }


@router.get("/exams/{exam_id}/export-csv", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.ADMIN, RoleEnum.SUPERADMIN]))])
async def export_exam_results_csv(
    exam_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Exports full student roster with marks, percentage, grade, and lockout violations to a standardized CSV.
    """
    exam = await db.get(MCQExam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    cls = await db.get(Class, exam.class_id)
    students_res = await db.execute(select(StudentProfile).where(StudentProfile.class_id == exam.class_id))
    students = students_res.scalars().all()

    attempts_res = await db.execute(select(MCQStudentAttempt).where(MCQStudentAttempt.mcq_exam_id == exam.id))
    attempts_map = {att.student_id: att for att in attempts_res.scalars().all()}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "GR Number",
        "Enrollment Number",
        "Student Name",
        "Status",
        "Lockout Violations",
        "Score Attained",
        "Maximum Marks",
        "Percentage",
        "Letter Grade",
        "Started At",
        "Submitted At"
    ])

    for s in students:
        att = attempts_map.get(s.id)
        status_val = att.status.value if att else "not_started"
        score = att.score_awarded if (att and att.score_awarded is not None) else ""
        percentage = f"{att.percentage}%" if (att and att.percentage is not None) else ""
        grade = att.grade if (att and att.grade) else ""
        lockouts = att.lockout_count if att else 0
        started = att.started_at.strftime("%Y-%m-%d %H:%M:%S") if (att and att.started_at) else ""
        submitted = att.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if (att and att.submitted_at) else ""

        writer.writerow([
            s.gr_number or "",
            s.enrollment_number or "",
            s.name or "",
            status_val,
            lockouts,
            score,
            exam.total_marks,
            percentage,
            grade,
            started,
            submitted
        ])

    csv_data = output.getvalue()
    safe_sub = re.sub(r'[^a-zA-Z0-9_-]', '_', exam.subject_name)
    safe_cls = re.sub(r'[^a-zA-Z0-9_-]', '_', cls.name if cls else 'Class')
    filename = f"{safe_sub}_{safe_cls}_Results.csv"

    return Response(
        content=csv_data.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
