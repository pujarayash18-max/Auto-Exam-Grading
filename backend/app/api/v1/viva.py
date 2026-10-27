import os
import uuid
import random
import base64
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import FacultyProfile, StudentProfile, Class
from app.models.exam import Exam, GradingScheme, ExamQuestion
from app.models.viva import ExamTypeEnum, StudentVivaStatus, ExamRun, StudentVivaRun, StudentVivaAnswer
from app.ai.llm import evaluate_answer, generate_questions_from_text, generate_single_question, generate_viva_improvement_report
from app.ai.grader import calculate_final_grade
from app.ai.document_parser import extract_text
from app.models.exam import ExamMaterial

router = APIRouter()

class StartExamRunRequest(BaseModel):
    exam_id: int
    exam_type: Optional[str] = None
    total_questions_to_generate: Optional[int] = None  # Pool size; defaults to exam.questions_per_student if not given

AUDIO_UPLOAD_DIR = "uploads/audio"
os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)

class SubmitAnswerRequest(BaseModel):
    question_id: int
    transcript: str
    audio_data: Optional[str] = None  # base64 encoded audio blob

@router.post("/runs", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def start_exam_run(
    req: StartExamRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, req.exam_id)
    if not exam or (prof and current_user.role == RoleEnum.FACULTY and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    raw_type = req.exam_type or getattr(exam, "exam_type", None) or "ppt_only"
    if hasattr(raw_type, "value"):
        effective_exam_type = str(raw_type.value).lower()
    else:
        effective_exam_type = str(raw_type).lower()

    # Check if an active run already exists for this exam, resume it if found
    existing_run_res = await db.execute(
        select(ExamRun).where(ExamRun.exam_id == req.exam_id, ExamRun.is_finished == False).order_by(ExamRun.id.desc())
    )
    run = existing_run_res.scalars().first()
    
    if not run:
        run = ExamRun(
            exam_id=exam.id,
            exam_type=effective_exam_type
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

    # Initialize / update roster: ensure all students in the assigned class are in StudentVivaRun
    students_res = await db.execute(select(StudentProfile).where(StudentProfile.class_id == exam.class_id))
    students = students_res.scalars().all()
    
    existing_sr_res = await db.execute(select(StudentVivaRun).where(StudentVivaRun.exam_run_id == run.id))
    existing_student_ids = {sr.student_id for sr in existing_sr_res.scalars().all()}
    
    for st in students:
        if st.id not in existing_student_ids:
            db.add(StudentVivaRun(
                exam_run_id=run.id,
                student_id=st.id,
                status=StudentVivaStatus.PENDING
            ))

    # Ensure questions exist for the exam using Ollama if none were generated yet
    q_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam.id))
    existing_questions = q_res.scalars().all()
    
    if not existing_questions:
        # Pool size = total_questions_to_generate (e.g. 20); per-student subset = exam.questions_per_student
        pool_size = req.total_questions_to_generate or (exam.questions_per_student or 5)
        per_student = exam.questions_per_student or 5
        # Always generate at least as many as per_student
        num_q = max(pool_size, per_student)
        
        context_text = f"Subject: {exam.subject_name}. Generate foundational and practical oral viva examination questions for {exam.subject_name}."
        
        if effective_exam_type in ["ppt_only", "pdf_only", "both", "qa_pdf", "ppt_and_questions"]:
            mat_res = await db.execute(select(ExamMaterial).where(ExamMaterial.exam_id == exam.id))
            materials = mat_res.scalars().all()
            extracted_contents = []
            for m in materials:
                if effective_exam_type in ["ppt_only"] and m.material_type.lower() not in ["ppt", "pptx"]:
                    continue
                if effective_exam_type in ["pdf_only"] and m.material_type.lower() != "pdf":
                    continue
                extracted_contents.append(extract_text(m.file_path, m.material_type))
            
            if extracted_contents:
                combined_text = "\n".join(extracted_contents)
                if effective_exam_type == "qa_pdf":
                    context_text = f"The following text contains a set of exact questions and answers. Extract exactly {num_q} of them as-is:\n" + combined_text
                else:
                    context_text = f"Based on the following material for {exam.subject_name}, generate {num_q} viva questions:\n" + combined_text

        generated = await generate_questions_from_text(context_text, num_q, blooms_taxonomy=bool(exam.blooms_taxonomy))
        
        if not generated:
            for _ in range(num_q):
                single_q = await generate_single_question(exam.subject_name, blooms_taxonomy=bool(exam.blooms_taxonomy))
                generated.append(single_q)
                
        for gq in generated:
            db.add(ExamQuestion(
                exam_id=exam.id,
                question_text=gq.get("question_text", f"Key concepts in {exam.subject_name}"),
                expected_answer=gq.get("expected_answer", "Comprehensive explanation.")
            ))

    await db.commit()
    
    exam_data = await db.get(Exam, req.exam_id)
    return {
        "msg": "Exam run active",
        "run_id": run.id,
        "questions_per_student": exam_data.questions_per_student if exam_data else 5,
        "timer_per_question_minutes": exam_data.timer_per_question_minutes if exam_data else 1.0
    }


@router.get("/runs/{run_id}/roster", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_exam_roster(
    run_id: int,
    db: AsyncSession = Depends(get_db)
):
    run = await db.get(ExamRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    student_runs_res = await db.execute(select(StudentVivaRun).where(StudentVivaRun.exam_run_id == run_id))
    student_runs = student_runs_res.scalars().all()
    
    roster = []
    for sr in student_runs:
        student = await db.get(StudentProfile, sr.student_id)
        student_name = student.name if (student and student.name) else f"Student #{sr.student_id}"
        gr_number = student.gr_number if student else "N/A"
        enrollment_no = student.enrollment_number if student else "N/A"
        
        roster.append({
            "run_id": sr.id,
            "student_id": sr.student_id,
            "name": student_name,
            "gr_number": gr_number,
            "enrollment_number": enrollment_no,
            "status": sr.status.value if hasattr(sr.status, "value") else str(sr.status),
            "total_score": sr.total_score,
            "grade": sr.grade
        })
        
    return roster


@router.post("/runs/{run_id}/students/{student_id}/start", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
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
        sr = StudentVivaRun(exam_run_id=run_id, student_id=student_id)
        db.add(sr)
    
    # Randomly assign questions_per_student questions from the full pool if not already assigned
    if not sr.assigned_question_ids:
        run = await db.get(ExamRun, run_id)
        exam = await db.get(Exam, run.exam_id)
        per_student = exam.questions_per_student or 5
        
        all_q_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == run.exam_id))
        all_questions = all_q_res.scalars().all()
        all_ids = [q.id for q in all_questions]
        
        if len(all_ids) <= per_student:
            selected_ids = all_ids
        else:
            selected_ids = random.sample(all_ids, per_student)
        
        sr.assigned_question_ids = ",".join(str(qid) for qid in selected_ids)
        
    sr.status = StudentVivaStatus.IN_PROGRESS
    if not sr.started_at:
        sr.started_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sr)
    
    # Return assigned question IDs so frontend can use them
    assigned_ids = [int(x) for x in sr.assigned_question_ids.split(",") if x.strip()]
    return {"msg": "Student viva started", "viva_run_id": sr.id, "assigned_question_ids": assigned_ids}


@router.post("/runs/{run_id}/students/{student_id}/pause", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def pause_student_viva(
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
        raise HTTPException(status_code=404, detail="Student run not found")
        
    sr.status = StudentVivaStatus.PAUSED
    await db.commit()
    return {"msg": "Student viva paused", "viva_run_id": sr.id}


@router.get("/runs/{run_id}/questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.STUDENT]))])
async def get_exam_questions(
    run_id: int,
    student_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    run = await db.get(ExamRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # If a student_id is given, return only that student's assigned questions
    if student_id is not None:
        sr_res = await db.execute(select(StudentVivaRun).where(
            StudentVivaRun.exam_run_id == run_id,
            StudentVivaRun.student_id == student_id
        ))
        sr = sr_res.scalars().first()
        if sr and sr.assigned_question_ids:
            assigned_ids = [int(x) for x in sr.assigned_question_ids.split(",") if x.strip()]
            questions = []
            for qid in assigned_ids:
                q = await db.get(ExamQuestion, qid)
                if q:
                    questions.append(q)
            return [{"id": q.id, "question_text": q.question_text, "expected_answer": q.expected_answer} for q in questions]
        
    questions_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == run.exam_id))
    questions = questions_res.scalars().all()
    
    # If no questions yet, create one via Ollama
    if not questions:
        exam = await db.get(Exam, run.exam_id)
        single_q = await generate_single_question(exam.subject_name)
        new_q = ExamQuestion(
            exam_id=exam.id,
            question_text=single_q["question_text"],
            expected_answer=single_q["expected_answer"]
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        questions = [new_q]
        
    return [{"id": q.id, "question_text": q.question_text, "expected_answer": q.expected_answer} for q in questions]


@router.post("/runs/{run_id}/generate-question", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def generate_viva_question(
    run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Dynamically generates a fresh viva question with expected answer using Ollama.
    """
    run = await db.get(ExamRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    exam = await db.get(Exam, run.exam_id)
    
    existing_q_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam.id))
    prev_questions = [q.question_text for q in existing_q_res.scalars().all()]
    
    new_q_data = await generate_single_question(exam.subject_name, previous_questions=prev_questions)
    
    eq = ExamQuestion(
        exam_id=exam.id,
        question_text=new_q_data["question_text"],
        expected_answer=new_q_data["expected_answer"]
    )
    db.add(eq)
    await db.commit()
    await db.refresh(eq)
    
    return {"id": eq.id, "question_text": eq.question_text, "expected_answer": eq.expected_answer}


@router.post("/runs/{run_id}/students/{student_id}/answers", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def submit_student_answer(
    run_id: int,
    student_id: int,
    req: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db)
):
    sr_res = await db.execute(select(StudentVivaRun).where(
        StudentVivaRun.exam_run_id == run_id,
        StudentVivaRun.student_id == student_id
    ))
    sr = sr_res.scalars().first()
    if not sr:
        raise HTTPException(status_code=404, detail="Student run not found")
        
    q = await db.get(ExamQuestion, req.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    # Evaluate using configured LLM (Gemini, ChatGPT, Claude, or Ollama)
    eval_result = await evaluate_answer(
        q.question_text,
        q.expected_answer or "",
        req.transcript,
        question_id=req.question_id,
        student_id=student_id
    )
    score_awarded = eval_result.get("score", 0.0)
    feedback = eval_result.get("feedback", "")
    areas_to_improve = eval_result.get("areas_to_improve", "")
    
    # Save audio file if provided
    audio_path = None
    if req.audio_data:
        try:
            b64_data = req.audio_data
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            audio_bytes = base64.b64decode(b64_data)
            audio_filename = f"{sr.id}_{req.question_id}_{uuid.uuid4().hex[:8]}.webm"
            audio_path = os.path.join(AUDIO_UPLOAD_DIR, audio_filename)
            with open(audio_path, "wb") as f:
                f.write(audio_bytes)
        except Exception as e:
            print(f"Audio save error: {e}")
            audio_path = None

    answer = StudentVivaAnswer(
        viva_run_id=sr.id,
        question_id=req.question_id,
        transcript=req.transcript,
        score_awarded=score_awarded,
        audio_file_path=audio_path,
        feedback=feedback,
        areas_to_improve=areas_to_improve
    )
    db.add(answer)
    await db.commit()
    
    return {
        "msg": "Answer evaluated by Ollama",
        "score": score_awarded,
        "feedback": feedback,
        "areas_to_improve": areas_to_improve,
        "strengths": eval_result.get("strengths", "")
    }


@router.post("/viva/{viva_run_id}/finish", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def finish_student_viva(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")
        
    sr.status = StudentVivaStatus.COMPLETED
    sr.completed_at = datetime.now(timezone.utc)
    
    # Calculate grade based on real submitted answers
    answers_res = await db.execute(select(StudentVivaAnswer).where(StudentVivaAnswer.viva_run_id == viva_run_id))
    answers = answers_res.scalars().all()
    
    total_score = sum([a.score_awarded for a in answers if a.score_awarded is not None])
    
    run = await db.get(ExamRun, sr.exam_run_id)
    exam = await db.get(Exam, run.exam_id)
    schemes_res = await db.execute(select(GradingScheme).where(GradingScheme.exam_id == exam.id))
    schemes = schemes_res.scalars().all()
    
    max_possible = max(1.0, len(answers) * 100.0 if answers else 100.0)
    grade = await calculate_final_grade(total_score, max_possible, schemes)
    
    # Normalize score out of 100 for academic reporting
    normalized_score = round((total_score / max_possible) * 100.0, 1) if max_possible > 0 else 0.0
    sr.total_score = normalized_score
    sr.grade = grade
    
    # Generate synthesized AI diagnostic report on areas where student needs to improve
    qa_records = []
    for a in answers:
        q_item = await db.get(ExamQuestion, a.question_id)
        qa_records.append({
            "question_text": q_item.question_text if q_item else "",
            "transcript": a.transcript or "",
            "score": a.score_awarded,
            "areas_to_improve": a.areas_to_improve or a.feedback or ""
        })
    report = await generate_viva_improvement_report(exam.subject_name, qa_records)
    sr.feedback_notes = report
    
    await db.commit()
    return {
        "msg": "Student viva completed", 
        "viva_run_id": sr.id, 
        "total_score": sr.total_score, 
        "grade": sr.grade,
        "improvement_report": sr.feedback_notes
    }


@router.get("/student-session/{exam_id}")
async def get_student_session_status(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Live real-time session polling for the student waiting room & exam view.
    Replaces any simulated mock timers.
    """
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    run_res = await db.execute(
        select(ExamRun).where(ExamRun.exam_id == exam_id).order_by(ExamRun.id.desc())
    )
    run = run_res.scalars().first()
    if not run:
        return {"status": "waiting", "message": "Exam has not been started by faculty yet."}
        
    sr_res = await db.execute(
        select(StudentVivaRun).where(
            StudentVivaRun.exam_run_id == run.id,
            StudentVivaRun.student_id == prof.id
        )
    )
    sr = sr_res.scalars().first()
    if not sr:
        # Student profile exists in class, create pending record
        sr = StudentVivaRun(
            exam_run_id=run.id,
            student_id=prof.id,
            status=StudentVivaStatus.PENDING
        )
        db.add(sr)
        await db.commit()
        await db.refresh(sr)
        
    active_question = None
    
    # Use the student's assigned questions if set, else fallback to all questions
    if sr.assigned_question_ids:
        assigned_ids = [int(x) for x in sr.assigned_question_ids.split(",") if x.strip()]
        questions = []
        for qid in assigned_ids:
            q = await db.get(ExamQuestion, qid)
            if q:
                questions.append(q)
    else:
        questions_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id))
        questions = questions_res.scalars().all()
    
    ans_res = await db.execute(select(StudentVivaAnswer).where(StudentVivaAnswer.viva_run_id == sr.id))
    answers = ans_res.scalars().all()
    ans_count = len(answers)
    
    if questions and ans_count < len(questions):
        curr_q = questions[ans_count]
        active_question = {
            "id": curr_q.id,
            "question_text": curr_q.question_text,
            "question_index": ans_count + 1,
            "total_questions": len(questions)
        }

    status_str = sr.status.value if hasattr(sr.status, "value") else str(sr.status)
    return {
        "status": status_str,
        "run_id": run.id,
        "viva_run_id": sr.id,
        "subject_name": exam.subject_name,
        "timer_per_question_minutes": exam.timer_per_question_minutes,
        "active_question": active_question,
        "total_score": sr.total_score,
        "grade": sr.grade
    }


@router.post("/student-session/{exam_id}/submit-answer")
async def student_submit_answer(
    exam_id: int,
    req: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Allows a student to directly submit an oral transcript from their client.
    Evaluated in real-time with Ollama.
    """
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    run_res = await db.execute(
        select(ExamRun).where(ExamRun.exam_id == exam_id).order_by(ExamRun.id.desc())
    )
    run = run_res.scalars().first()
    if not run:
        raise HTTPException(status_code=400, detail="Active exam run not found")
        
    sr_res = await db.execute(
        select(StudentVivaRun).where(
            StudentVivaRun.exam_run_id == run.id,
            StudentVivaRun.student_id == prof.id
        )
    )
    sr = sr_res.scalars().first()
    if not sr or sr.status != StudentVivaStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Student is not in an active viva session")
        
    q = await db.get(ExamQuestion, req.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    eval_result = await evaluate_answer(
        q.question_text,
        q.expected_answer or "",
        req.transcript,
        question_id=req.question_id,
        student_id=sr.student_id
    )
    score_awarded = eval_result.get("score", 0.0)
    feedback = eval_result.get("feedback", "")
    areas_to_improve = eval_result.get("areas_to_improve", "")
    
    # Save audio file if provided
    audio_path = None
    if req.audio_data:
        try:
            b64_data = req.audio_data
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            audio_bytes = base64.b64decode(b64_data)
            audio_filename = f"{sr.id}_{req.question_id}_{uuid.uuid4().hex[:8]}.webm"
            audio_path = os.path.join(AUDIO_UPLOAD_DIR, audio_filename)
            with open(audio_path, "wb") as f:
                f.write(audio_bytes)
        except Exception as e:
            print(f"Audio save error: {e}")
            audio_path = None

    answer = StudentVivaAnswer(
        viva_run_id=sr.id,
        question_id=req.question_id,
        transcript=req.transcript,
        score_awarded=score_awarded,
        audio_file_path=audio_path,
        feedback=feedback,
        areas_to_improve=areas_to_improve
    )
    db.add(answer)
    await db.commit()
    
    return {
        "msg": "Answer evaluated by Ollama",
        "score": score_awarded,
        "feedback": feedback,
        "areas_to_improve": areas_to_improve,
        "strengths": eval_result.get("strengths", "")
    }


@router.post("/viva/{viva_run_id}/re-viva", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def reset_student_viva_for_reviva(
    viva_run_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Resets a student's viva run so they can take a fresh Re-Viva.
    Clears all previous answers, scores, and assigns a fresh random question subset.
    """
    sr = await db.get(StudentVivaRun, viva_run_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Viva run not found")

    # Delete all previous answers
    old_answers_res = await db.execute(select(StudentVivaAnswer).where(StudentVivaAnswer.viva_run_id == viva_run_id))
    for ans in old_answers_res.scalars().all():
        await db.delete(ans)

    # Reassign a new random subset of questions
    run = await db.get(ExamRun, sr.exam_run_id)
    exam = await db.get(Exam, run.exam_id)
    per_student = exam.questions_per_student or 5

    all_q_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == run.exam_id))
    all_questions = all_q_res.scalars().all()
    all_ids = [q.id for q in all_questions]

    if len(all_ids) <= per_student:
        selected_ids = all_ids
    else:
        selected_ids = random.sample(all_ids, per_student)

    sr.assigned_question_ids = ",".join(str(qid) for qid in selected_ids)
    sr.status = StudentVivaStatus.PENDING
    sr.total_score = None
    sr.grade = None
    sr.feedback_notes = None
    sr.started_at = None
    sr.completed_at = None
    sr.is_published = False

    await db.commit()
    await db.refresh(sr)

    return {"msg": "Re-Viva reset successful", "viva_run_id": sr.id, "assigned_question_ids": selected_ids}
