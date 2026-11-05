from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.profile import StudentProfile
from app.models.viva import StudentVivaRun, StudentVivaAnswer, ExamRun
from app.models.exam import Exam, ExamQuestion
from app.models.mcq import MCQStudentAttempt, MCQStudentAnswer, MCQQuestion, MCQExam, MCQAttemptStatus
from app.api.v1.results import resolve_audio_path

router = APIRouter()

@router.get("/profile", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prof_res = await db.execute(
        select(StudentProfile)
        .options(selectinload(StudentProfile.department), selectinload(StudentProfile.student_class))
        .where(StudentProfile.user_id == current_user.id)
    )
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
                real_audio = resolve_audio_path(ans.audio_file_path)
                has_audio = bool(real_audio)
                answers_list.append({
                    "id": ans.id,
                    "question_text": q.question_text,
                    "transcript": ans.transcript,
                    "score_awarded": ans.score_awarded if show_grades else None,
                    "feedback": ans.feedback or "",
                    "areas_to_improve": ans.areas_to_improve or "",
                    "has_audio": has_audio,
                    "audio_url": f"/api/v1/results/answers/{ans.id}/audio" if has_audio else None
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


@router.get("/analytics", dependencies=[Depends(require_roles([RoleEnum.STUDENT, RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_student_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Computes unified academic analytics across Oral Viva Voce runs and Objective MCQ assessments.
    Breaks down cognitive mastery across Bloom's Taxonomy, identifies subject proficiencies,
    and pinpoints specific knowledge gaps for revision.
    """
    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    prof = prof_res.scalars().first()
    if not prof:
        return {
            "total_assessments": 0,
            "overall_average": 0.0,
            "overall_grade": "N/A",
            "viva_assessments_count": 0,
            "mcq_assessments_count": 0,
            "total_questions_attempted": 0,
            "blooms_mastery": [],
            "subject_mastery": [],
            "key_areas_to_improve": [],
            "recent_missed_concepts": []
        }

    # 1. Fetch Viva Runs
    viva_runs_res = await db.execute(
        select(StudentVivaRun, ExamRun, Exam)
        .join(ExamRun, StudentVivaRun.exam_run_id == ExamRun.id)
        .join(Exam, ExamRun.exam_id == Exam.id)
        .where(StudentVivaRun.student_id == prof.id, StudentVivaRun.is_published == True)
        .order_by(StudentVivaRun.id.desc())
    )
    viva_runs = viva_runs_res.all()

    viva_scores = []
    subject_map = {}
    areas_to_improve = []

    for sr, er, ex in viva_runs:
        subj = ex.subject_name or "General"
        if subj not in subject_map:
            subject_map[subj] = {"viva_scores": [], "mcq_scores": [], "total_questions": 0}

        if sr.total_score is not None:
            viva_scores.append(float(sr.total_score))
            subject_map[subj]["viva_scores"].append(float(sr.total_score))

        # Collect feedback and areas to improve from viva answers
        ans_res = await db.execute(
            select(StudentVivaAnswer)
            .where(StudentVivaAnswer.viva_run_id == sr.id)
        )
        for a in ans_res.scalars().all():
            subject_map[subj]["total_questions"] += 1
            if a.areas_to_improve and a.areas_to_improve.strip():
                clean_area = a.areas_to_improve.strip()
                if clean_area not in areas_to_improve:
                    areas_to_improve.append(clean_area)

    # 2. Fetch MCQ Attempts
    mcq_attempts_res = await db.execute(
        select(MCQStudentAttempt, MCQExam)
        .join(MCQExam, MCQStudentAttempt.mcq_exam_id == MCQExam.id)
        .where(
            MCQStudentAttempt.student_id == prof.id,
            MCQStudentAttempt.status == MCQAttemptStatus.SUBMITTED
        )
        .order_by(MCQStudentAttempt.id.desc())
    )
    mcq_attempts = mcq_attempts_res.all()

    mcq_scores = []
    blooms_stats = {
        "Remember": {"total": 0, "correct": 0, "description": "Recall facts, formulas, and basic concepts"},
        "Understand": {"total": 0, "correct": 0, "description": "Explain concepts, interpret logic, and translate problems"},
        "Apply": {"total": 0, "correct": 0, "description": "Execute algorithms and apply formulas to solve problems"},
        "Analyze": {"total": 0, "correct": 0, "description": "Deconstruct systems, analyze complexity, and trace edge cases"},
        "Evaluate": {"total": 0, "correct": 0, "description": "Critique trade-offs, benchmark efficiency, and assess validity"},
        "Create": {"total": 0, "correct": 0, "description": "Synthesize design architectures and assemble novel structures"}
    }
    missed_concepts = []

    for att, exam in mcq_attempts:
        subj = exam.subject_name or "General"
        if subj not in subject_map:
            subject_map[subj] = {"viva_scores": [], "mcq_scores": [], "total_questions": 0}

        if att.percentage is not None:
            mcq_scores.append(float(att.percentage))
            subject_map[subj]["mcq_scores"].append(float(att.percentage))

        # Assigned questions and student answers
        assigned_ids = [int(i.strip()) for i in (att.assigned_question_ids or "").split(",") if i.strip()]
        if assigned_ids:
            subject_map[subj]["total_questions"] += len(assigned_ids)
            q_res = await db.execute(select(MCQQuestion).where(MCQQuestion.id.in_(assigned_ids)))
            q_map = {q.id: q for q in q_res.scalars().all()}

            ans_res = await db.execute(select(MCQStudentAnswer).where(MCQStudentAnswer.attempt_id == att.id))
            ans_map = {a.question_id: a for a in ans_res.scalars().all()}

            for qid in assigned_ids:
                q = q_map.get(qid)
                if not q:
                    continue
                ans = ans_map.get(qid)
                is_correct = ans.is_correct if ans else False

                level = (q.bloom_level or "Understand").strip()
                matched_key = "Understand"
                for k in blooms_stats.keys():
                    if k.lower() in level.lower():
                        matched_key = k
                        break

                blooms_stats[matched_key]["total"] += 1
                if is_correct:
                    blooms_stats[matched_key]["correct"] += 1
                elif len(missed_concepts) < 8:
                    missed_concepts.append({
                        "subject": subj,
                        "question": q.question_text[:140] + "..." if len(q.question_text) > 140 else q.question_text,
                        "bloom_level": matched_key,
                        "explanation": q.explanation or "Focus revision on underlying definitions and edge cases."
                    })

    # 3. Aggregate blooms breakdown
    blooms_mastery = []
    for level, data in blooms_stats.items():
        total = data["total"]
        correct = data["correct"]
        pct = round((correct / total) * 100, 1) if total > 0 else None
        blooms_mastery.append({
            "level": level,
            "description": data["description"],
            "total_questions": total,
            "correct_questions": correct,
            "accuracy_percentage": pct
        })

    # 4. Aggregate subject mastery
    subject_mastery = []
    for subj, data in subject_map.items():
        all_s = data["viva_scores"] + data["mcq_scores"]
        avg_score = round(sum(all_s) / len(all_s), 1) if all_s else 0.0
        viva_avg = round(sum(data["viva_scores"]) / len(data["viva_scores"]), 1) if data["viva_scores"] else None
        mcq_avg = round(sum(data["mcq_scores"]) / len(data["mcq_scores"]), 1) if data["mcq_scores"] else None

        rating = "Proficient" if avg_score >= 80 else "Competent" if avg_score >= 60 else "Developing"
        subject_mastery.append({
            "subject": subj,
            "average_score": avg_score,
            "viva_average": viva_avg,
            "mcq_average": mcq_avg,
            "assessments_count": len(all_s),
            "mastery_rating": rating
        })

    # 5. Overall metrics
    all_scores = viva_scores + mcq_scores
    overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0
    from app.api.v1.mcq import _calculate_letter_grade
    overall_grade = _calculate_letter_grade(overall_avg) if all_scores else "N/A"
    total_questions = sum(s["total_questions"] for s in subject_map.values())

    return {
        "total_assessments": len(all_scores),
        "overall_average": overall_avg,
        "overall_grade": overall_grade,
        "viva_assessments_count": len(viva_scores),
        "mcq_assessments_count": len(mcq_scores),
        "total_questions_attempted": total_questions,
        "blooms_mastery": blooms_mastery,
        "subject_mastery": subject_mastery,
        "key_areas_to_improve": areas_to_improve[:6],
        "recent_missed_concepts": missed_concepts
    }
