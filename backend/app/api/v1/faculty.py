import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import Class, FacultyProfile, FacultyAssignment
from app.models.exam import Exam, GradingScheme, ExamMaterial, ExamQuestion
from app.ai.document_parser import extract_text, extract_qa_pairs
from app.ai.llm import generate_questions_from_text, generate_answer_for_question, tag_bloom_level

router = APIRouter()


from datetime import datetime
from typing import List, Optional

class GradingSchemeInput(BaseModel):
    grade_label: str
    min_marks: float
    max_marks: float

class ScheduleExamRequest(BaseModel):
    subject_name: str
    class_id: int
    total_marks: float
    timer_per_question_minutes: float
    questions_per_student: int
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = None
    blooms_taxonomy: bool = False
    exam_type: Optional[str] = "ppt_only"
    grading_schemes: List[GradingSchemeInput]

@router.post("/exams", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
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
        select(FacultyAssignment).where(
            FacultyAssignment.faculty_id == prof.id, 
            FacultyAssignment.class_id == req.class_id
        )
    )
    if not assignment_res.scalars().first():
        raise HTTPException(status_code=403, detail="Not assigned to this class")

    # Create exam
    exam = Exam(
        faculty_id=prof.id,
        class_id=req.class_id,
        subject_name=req.subject_name,
        total_marks=req.total_marks,
        timer_per_question_minutes=req.timer_per_question_minutes,
        questions_per_student=req.questions_per_student,
        scheduled_date=req.scheduled_date,
        location=req.location,
        blooms_taxonomy=req.blooms_taxonomy,
        exam_type=req.exam_type or "ppt_only"
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

class UpdateMaterialWeightageRequest(BaseModel):
    weightage: float

@router.post("/exams/{exam_id}/materials", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def upload_exam_material(
    exam_id: int,
    file: UploadFile = File(...),
    material_type: str = Form(...), # e.g. 'ppt', 'pdf_questions', 'pdf_answers'
    weightage: float = Form(100.0), # weightage percentage for viva questions e.g. 20.0 for 20%
    exam_type: Optional[str] = Form(None), # e.g. 'ppt_only', 'both', 'qa_pdf'
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
        material_type=material_type,
        weightage=max(0.0, float(weightage))
    )
    db.add(material)
    if exam_type:
        exam.exam_type = exam_type
    await db.commit()
    await db.refresh(material)
    
    return {"msg": "Material uploaded successfully", "material_id": material.id, "weightage": material.weightage, "exam_type": exam.exam_type}

@router.get("/exams/{exam_id}/materials", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_exam_materials(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    materials_res = await db.execute(select(ExamMaterial).where(ExamMaterial.exam_id == exam.id).order_by(ExamMaterial.id))
    materials = materials_res.scalars().all()
    
    return [
        {
            "id": m.id, 
            "filename": m.filename, 
            "material_type": m.material_type, 
            "weightage": m.weightage if m.weightage is not None else 100.0,
            "uploaded_at": m.uploaded_at
        } 
        for m in materials
    ]

@router.put("/exams/{exam_id}/materials/{material_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_exam_material_weightage(
    exam_id: int,
    material_id: int,
    req: UpdateMaterialWeightageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    material = await db.get(ExamMaterial, material_id)
    if not material or material.exam_id != exam.id:
        raise HTTPException(status_code=404, detail="Material not found")
        
    material.weightage = max(0.0, float(req.weightage))
    await db.commit()
    await db.refresh(material)
    
    return {"msg": "Material weightage updated successfully", "material_id": material.id, "weightage": material.weightage}

@router.delete("/exams/{exam_id}/materials/{material_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def delete_exam_material(
    exam_id: int,
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    material = await db.get(ExamMaterial, material_id)
    if not material or material.exam_id != exam.id:
        raise HTTPException(status_code=404, detail="Material not found")
        
    # Remove file from disk
    if os.path.exists(material.file_path):
        os.remove(material.file_path)
        
    await db.delete(material)
    await db.commit()
    
    return {"msg": "Material deleted successfully"}

@router.get("/exams", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role in [RoleEnum.SUPERADMIN, RoleEnum.ADMIN]:
        res = await db.execute(select(Exam))
        exams = res.scalars().all()
    else:
        prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
        prof = prof_res.scalars().first()
        if not prof:
            return []
        exams_res = await db.execute(select(Exam).where(Exam.faculty_id == prof.id))
        exams = exams_res.scalars().all()
    
    result = []
    for e in exams:
        gs_res = await db.execute(select(GradingScheme).where(GradingScheme.exam_id == e.id))
        schemes = gs_res.scalars().all()
        result.append({
            "id": e.id,
            "subject_name": e.subject_name,
            "class_id": e.class_id,
            "scheduled_date": e.scheduled_date,
            "location": e.location,
            "total_marks": e.total_marks,
            "timer_per_question_minutes": e.timer_per_question_minutes,
            "questions_per_student": e.questions_per_student,
            "blooms_taxonomy": e.blooms_taxonomy,
            "exam_type": e.exam_type or "ppt_only",
            "grading_schemes": [
                {
                    "grade_label": gs.grade_label,
                    "min_marks": gs.min_marks,
                    "max_marks": gs.max_marks
                }
                for gs in schemes
            ]
        })
    return result
    
@router.get("/assignments", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        return []
        
    res = await db.execute(
        select(FacultyAssignment.class_id, FacultyAssignment.subject_name, Class.name)
        .join(Class, FacultyAssignment.class_id == Class.id)
        .where(FacultyAssignment.faculty_id == prof.id)
    )
    
    return [{"class_id": c_id, "subject_name": subj, "class_name": c_name, "name": f"{subj} - {c_name}"} for c_id, subj, c_name in res.all()]
class GenerateQuestionsRequest(BaseModel):
    total_questions: Optional[int] = None
    materials_weightages: Optional[dict[int, float]] = None # material_id -> weightage %
    exam_type: Optional[str] = None

@router.post("/exams/{exam_id}/generate-questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def generate_questions(
    exam_id: int,
    req: Optional[GenerateQuestionsRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    if req and req.exam_type:
        exam.exam_type = req.exam_type
        await db.commit()
        
    # Find all materials for this exam
    materials_res = await db.execute(select(ExamMaterial).where(ExamMaterial.exam_id == exam.id).order_by(ExamMaterial.id))
    materials = materials_res.scalars().all()
    
    if not materials:
        raise HTTPException(status_code=400, detail="No materials uploaded for this exam")

    # Update weightages if provided in request
    if req and req.materials_weightages:
        for m in materials:
            if m.id in req.materials_weightages:
                m.weightage = max(0.0, float(req.materials_weightages[m.id]))
        await db.commit()

    # Determine total questions to generate
    target_total = 10
    if req and req.total_questions and req.total_questions > 0:
        target_total = req.total_questions
    elif exam.questions_per_student and exam.questions_per_student > 0:
        target_total = max(exam.questions_per_student * 2, 10)

    # Calculate weightage distribution
    valid_materials = [m for m in materials if m.weightage is not None and m.weightage > 0]
    if not valid_materials:
        valid_materials = materials
        for m in valid_materials:
            m.weightage = 100.0 / len(valid_materials)

    total_weight = sum(m.weightage for m in valid_materials) or 100.0

    # Allocate target questions to each material
    allocations = {}
    allocated_count = 0
    for idx, mat in enumerate(valid_materials):
        if idx == len(valid_materials) - 1:
            q_cnt = max(1, target_total - allocated_count)
        else:
            share = (mat.weightage or 0) / total_weight
            q_cnt = max(1, round(target_total * share))
            allocated_count += q_cnt
        allocations[mat.id] = q_cnt

    # Generate questions per material based on its allocated count
    saved_questions = []
    # Clean previously generated questions for this exam
    await db.execute(delete(ExamQuestion).where(ExamQuestion.exam_id == exam.id))

    # Identify lecture slides context if available (for answering questions in Mode B)
    ppt_context = ""
    for mat in materials:
        if mat.material_type in ["ppt", "pptx", "lecture_slides"] or (mat.filename and mat.filename.lower().endswith((".ppt", ".pptx"))):
            ppt_context = extract_text(mat.file_path, mat.material_type)
            if ppt_context:
                break

    for mat in valid_materials:
        # First: check if material contains explicit questions and/or answers (e.g. Q&A PDF or Questions list)
        extracted_qa = extract_qa_pairs(mat.file_path, mat.material_type)
        mat_count = allocations.get(mat.id, 1)

        if extracted_qa:
            # We found actual questions (and answers) directly in this document!
            for q_idx, qa in enumerate(extracted_qa):
                q_text = qa["question_text"]
                a_text = (qa.get("expected_answer") or "").strip()

                if exam.blooms_taxonomy:
                    q_text = tag_bloom_level(q_text, len(saved_questions))

                # If answer is missing from the document (e.g. Questions-only PDF Mode B), synthesize it using AI
                if not a_text:
                    context_source = ppt_context or extract_text(mat.file_path, mat.material_type)
                    a_text = await generate_answer_for_question(
                        q_text, 
                        subject_name=exam.subject_name, 
                        context_text=context_source
                    )

                new_q = ExamQuestion(
                    exam_id=exam.id,
                    question_text=q_text,
                    expected_answer=a_text or "Detailed technical explanation and key concepts.",
                    source_material_id=mat.id
                )
                db.add(new_q)
                saved_questions.append(new_q)

            # If user wanted more questions than were in this document and this was not a strict Q&A PDF
            if exam.exam_type != "qa_pdf" and len(extracted_qa) < mat_count:
                needed = mat_count - len(extracted_qa)
                mat_text = extract_text(mat.file_path, mat.material_type)
                if mat_text and len(mat_text.strip()) >= 10:
                    extra_qs = await generate_questions_from_text(
                        mat_text,
                        needed,
                        blooms_taxonomy=bool(exam.blooms_taxonomy),
                        material_title=mat.filename
                    )
                    for q_data in extra_qs:
                        new_q = ExamQuestion(
                            exam_id=exam.id,
                            question_text=q_data.get("question_text", f"Key question on {mat.filename}"),
                            expected_answer=q_data.get("expected_answer", "Key concepts and technical explanation."),
                            source_material_id=mat.id
                        )
                        db.add(new_q)
                        saved_questions.append(new_q)
        else:
            # Material does not have explicit Q&A (e.g., standard lecture notes or PPT slides)
            # Generate questions from concepts using AI
            mat_text = extract_text(mat.file_path, mat.material_type)
            if not mat_text or len(mat_text.strip()) < 10:
                mat_text = f"Subject: {exam.subject_name}. File: {mat.filename}. Overview of essential concepts, operations, and exam definitions."

            q_list = await generate_questions_from_text(
                mat_text, 
                mat_count, 
                blooms_taxonomy=bool(exam.blooms_taxonomy),
                material_title=mat.filename
            )

            for q_data in q_list:
                new_q = ExamQuestion(
                    exam_id=exam.id,
                    question_text=q_data.get("question_text", f"Key question on {mat.filename}"),
                    expected_answer=q_data.get("expected_answer", "Key concepts and technical explanation."),
                    source_material_id=mat.id
                )
                db.add(new_q)
                saved_questions.append(new_q)


    await db.commit()
    for q in saved_questions:
        await db.refresh(q)

    return {
        "msg": f"Generated {len(saved_questions)} questions based on file weightages successfully", 
        "status": "completed", 
        "count": len(saved_questions),
        "target_total": target_total,
        "questions": [
            {
                "id": q.id, 
                "question_text": q.question_text, 
                "expected_answer": q.expected_answer,
                "source_material_id": q.source_material_id
            } 
            for q in saved_questions
        ]
    }

class QuestionItem(BaseModel):
    id: Optional[int] = None
    question_text: str
    expected_answer: Optional[str] = None

class UpdateQuestionsRequest(BaseModel):
    questions: List[QuestionItem]

@router.get("/exams/{exam_id}/questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_exam_questions(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    q_res = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam.id).order_by(ExamQuestion.id))
    questions = q_res.scalars().all()
    return [
        {
            "id": q.id, 
            "question_text": q.question_text, 
            "expected_answer": q.expected_answer,
            "source_material_id": q.source_material_id
        } 
        for q in questions
    ]

@router.put("/exams/{exam_id}/questions", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_exam_questions(
    exam_id: int,
    req: UpdateQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()

    exam = await db.get(Exam, exam_id)
    if not exam or (prof and exam.faculty_id != prof.id):
        raise HTTPException(status_code=403, detail="Exam not found or unauthorized")
        
    # Replace existing questions with provided edited list
    await db.execute(delete(ExamQuestion).where(ExamQuestion.exam_id == exam.id))
    
    saved_questions = []
    for q_item in req.questions:
        if not q_item.question_text.strip():
            continue
        new_q = ExamQuestion(
            exam_id=exam.id,
            question_text=q_item.question_text.strip(),
            expected_answer=q_item.expected_answer.strip() if q_item.expected_answer else ""
        )
        db.add(new_q)
        saved_questions.append(new_q)
        
    await db.commit()
    for q in saved_questions:
        await db.refresh(q)
        
    return [
        {
            "id": q.id, 
            "question_text": q.question_text, 
            "expected_answer": q.expected_answer
        } 
        for q in saved_questions
    ]


class RescheduleExamRequest(BaseModel):
    subject_name: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = None
    timer_per_question_minutes: Optional[float] = None
    questions_per_student: Optional[int] = None
    total_marks: Optional[float] = None
    blooms_taxonomy: Optional[bool] = None
    exam_type: Optional[str] = None
    grading_schemes: Optional[List[GradingSchemeInput]] = None


@router.delete("/exams/{exam_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def delete_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a scheduled exam and all related data (questions, materials, grading schemes)."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Verify ownership (faculty can only delete their own exams)
    if current_user.role == RoleEnum.FACULTY:
        prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
        prof = prof_res.scalars().first()
        if not prof or exam.faculty_id != prof.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this exam")
    
    # Delete associated material files from disk
    materials_res = await db.execute(select(ExamMaterial).where(ExamMaterial.exam_id == exam_id))
    for mat in materials_res.scalars().all():
        if mat.file_path and os.path.exists(mat.file_path):
            try:
                os.remove(mat.file_path)
            except Exception:
                pass
    
    # Also clean up any audio files in runs associated with this exam
    from app.models.viva import ExamRun, StudentVivaRun, StudentVivaAnswer
    runs_res = await db.execute(select(ExamRun).where(ExamRun.exam_id == exam_id))
    for r in runs_res.scalars().all():
        sr_res = await db.execute(select(StudentVivaRun).where(StudentVivaRun.exam_run_id == r.id))
        for sr in sr_res.scalars().all():
            ans_res = await db.execute(select(StudentVivaAnswer).where(StudentVivaAnswer.viva_run_id == sr.id))
            for a in ans_res.scalars().all():
                if a.audio_file_path and os.path.exists(a.audio_file_path):
                    try:
                        os.remove(a.audio_file_path)
                    except Exception:
                        pass
        await db.delete(r)

    await db.delete(exam)
    await db.commit()
    
    return {"msg": "Exam deleted successfully", "exam_id": exam_id}


@router.get("/exams/{exam_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get single exam details including grading schemes."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    gs_res = await db.execute(select(GradingScheme).where(GradingScheme.exam_id == exam.id))
    schemes = gs_res.scalars().all()
    
    return {
        "id": exam.id,
        "subject_name": exam.subject_name,
        "class_id": exam.class_id,
        "scheduled_date": exam.scheduled_date,
        "location": exam.location,
        "total_marks": exam.total_marks,
        "timer_per_question_minutes": exam.timer_per_question_minutes,
        "questions_per_student": exam.questions_per_student,
        "blooms_taxonomy": exam.blooms_taxonomy,
        "exam_type": exam.exam_type or "ppt_only",
        "grading_schemes": [
            {
                "id": gs.id,
                "grade_label": gs.grade_label,
                "min_marks": gs.min_marks,
                "max_marks": gs.max_marks
            }
            for gs in schemes
        ]
    }


class UpdateExamTypeRequest(BaseModel):
    exam_type: str

@router.put("/exams/{exam_id}/exam-type", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_exam_type(
    exam_id: int,
    req: UpdateExamTypeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update exam type (mode) for an exam."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.exam_type = req.exam_type
    await db.commit()
    return {"msg": "Exam type updated", "exam_id": exam.id, "exam_type": exam.exam_type}


@router.put("/exams/{exam_id}", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def reschedule_exam(
    exam_id: int,
    req: RescheduleExamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reschedule or update an existing exam's configuration."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Verify ownership
    if current_user.role == RoleEnum.FACULTY:
        prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
        prof = prof_res.scalars().first()
        if not prof or exam.faculty_id != prof.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this exam")
    
    # Update fields if provided
    if req.subject_name is not None:
        exam.subject_name = req.subject_name
    if req.scheduled_date is not None:
        exam.scheduled_date = req.scheduled_date
    if req.location is not None:
        exam.location = req.location
    if req.timer_per_question_minutes is not None:
        exam.timer_per_question_minutes = req.timer_per_question_minutes
    if req.questions_per_student is not None:
        exam.questions_per_student = req.questions_per_student
    if req.total_marks is not None:
        exam.total_marks = req.total_marks
    if req.blooms_taxonomy is not None:
        exam.blooms_taxonomy = req.blooms_taxonomy
    if req.exam_type is not None:
        exam.exam_type = req.exam_type
    
    # Update grading schemes if provided
    if req.grading_schemes is not None:
        # Delete existing schemes
        await db.execute(delete(GradingScheme).where(GradingScheme.exam_id == exam_id))
        # Add new schemes
        for gs in req.grading_schemes:
            db.add(GradingScheme(
                exam_id=exam.id,
                grade_label=gs.grade_label,
                min_marks=gs.min_marks,
                max_marks=gs.max_marks
            ))
    
    await db.commit()
    await db.refresh(exam)
    
    return {
        "msg": "Exam rescheduled successfully",
        "exam_id": exam.id,
        "subject_name": exam.subject_name,
        "scheduled_date": exam.scheduled_date,
        "location": exam.location,
        "exam_type": exam.exam_type
    }

class UpdateExamTypeRequest(BaseModel):
    exam_type: str

@router.put("/exams/{exam_id}/exam-type", dependencies=[Depends(require_roles([RoleEnum.FACULTY, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_exam_type(
    exam_id: int,
    req: UpdateExamTypeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update only the exam mode (ppt_only, both, qa_pdf) for a scheduled exam."""
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    if current_user.role == RoleEnum.FACULTY:
        prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == current_user.id))
        prof = prof_res.scalars().first()
        if not prof or exam.faculty_id != prof.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this exam")
            
    exam.exam_type = req.exam_type
    await db.commit()
    await db.refresh(exam)
    return {"msg": "Exam type updated", "exam_id": exam.id, "exam_type": exam.exam_type}

