import io
import csv
import time
import pandas as pd
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Response, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, text, or_, desc
from argon2 import PasswordHasher
import secrets
import httpx
import redis.asyncio as aioredis
from app.core.config import settings

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum, LoginAlias
from app.models.profile import Department, Class, FacultyProfile, FacultySubject, FacultyAssignment, StudentProfile, StudentSubject
from app.models.exam import Exam
from app.models.viva import StudentVivaRun, ExamRun, StudentVivaStatus
from app.models.mcq import MCQExam, MCQStudentAttempt, MCQAttemptStatus
from app.models.ai_billing import AISettings

router = APIRouter()
ph = PasswordHasher()

def generate_faculty_template_bytes() -> bytes:
    df = pd.DataFrame([
        {
            "empID": "EMP001",
            "Department": "Computer Engineering",
            "Faculty-Name": "Dr. Sharma",
            "Subject Teaching": "Data Structures",
            "Semester": 3,
            "Class": "EC1"
        },
        {
            "empID": "EMP002",
            "Department": "Computer Engineering",
            "Faculty-Name": "Prof. Patel",
            "Subject Teaching": "Database Management Systems",
            "Semester": 4,
            "Class": "EC2"
        }
    ])
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine='openpyxl')
    buf.seek(0)
    return buf.getvalue()

def generate_student_template_bytes() -> bytes:
    df = pd.DataFrame([
        {
            "Enrollment Number": "ENR2024001",
            "GR Number": "GR1001",
            "Name": "Aarav Sharma",
            "Department": "Computer Engineering",
            "Department ID": "CE",
            "Semester": 3,
            "Class": "EC1",
            "Email": "aarav.sharma@example.edu",
            "Subject 1": "Data Structures",
            "Subject 2": "Discrete Mathematics"
        },
        {
            "Enrollment Number": "ENR2024002",
            "GR Number": "GR1002",
            "Name": "Diya Patel",
            "Department": "Computer Engineering",
            "Department ID": "CE",
            "Semester": 3,
            "Class": "EC1",
            "Email": "diya.patel@example.edu",
            "Subject 1": "Data Structures",
            "Subject 2": "Discrete Mathematics"
        }
    ])
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine='openpyxl')
    buf.seek(0)
    return buf.getvalue()

def generate_class_template_bytes() -> bytes:
    df = pd.DataFrame([
        {
            "Department": "Computer Engineering",
            "Department ID": "CE",
            "Semester": 3,
            "Class": "EC1"
        },
        {
            "Department": "Computer Engineering",
            "Department ID": "CE",
            "Semester": 3,
            "Class": "EC2"
        },
        {
            "Department": "Electrical Engineering",
            "Department ID": "EE",
            "Semester": 1,
            "Class": "EV1"
        }
    ])
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine='openpyxl')
    buf.seek(0)
    return buf.getvalue()

@router.get("/templates/faculty", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def download_faculty_template():
    content = generate_faculty_template_bytes()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Faculty_Import_Template.xlsx"}
    )

@router.get("/templates/students", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def download_student_template():
    content = generate_student_template_bytes()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Student_Import_Template.xlsx"}
    )

@router.get("/templates/classes", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def download_classes_template():
    content = generate_class_template_bytes()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Class_Import_Template.xlsx"}
    )

async def get_or_create_department(db: AsyncSession, dept_name: str, dept_id_code: str = None) -> Department:
    if not dept_name or pd.isna(dept_name):
        return None
    dept_name = str(dept_name).strip()
    result = await db.execute(select(Department).where(Department.name == dept_name))
    dept = result.scalars().first()
    if not dept:
        dept = Department(name=dept_name, department_id=dept_id_code)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
    else:
        if dept_id_code and not dept.department_id:
            dept.department_id = dept_id_code
            await db.commit()
            await db.refresh(dept)
    return dept

async def get_or_create_class(db: AsyncSession, dept_id: int, semester: int, class_name: str) -> Class:
    if pd.isna(semester) or pd.isna(class_name) or not dept_id:
        return None
    class_name = str(class_name).strip()
    semester = int(semester)
    result = await db.execute(select(Class).where(
        Class.department_id == dept_id,
        Class.semester == semester,
        Class.name == class_name
    ))
    cls = result.scalars().first()
    if not cls:
        cls = Class(department_id=dept_id, semester=semester, name=class_name)
        db.add(cls)
        await db.commit()
        await db.refresh(cls)
    return cls

@router.post("/faculty/upload", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def upload_faculty(
    file: UploadFile = File(...),
    update_type: str = Form(...), # "replace" or "add"
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith(('.xls', '.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file format")
        
    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
        
    # Expected: empID, Department, Faculty-Name, Subject Teaching, Semester, Class
    expected_cols = ['empID', 'Department', 'Faculty-Name', 'Subject Teaching', 'Semester', 'Class']
    if not all(col in df.columns for col in expected_cols):
        raise HTTPException(status_code=400, detail="Missing required columns in Excel sheet. Ensure empID, Department, Faculty-Name, Subject Teaching, Semester, and Class exist.")
        
    if update_type == "replace":
        # Delete existing faculties
        await db.execute(delete(User).where(User.role == RoleEnum.FACULTY))
        await db.commit()
        
    for index, row in df.iterrows():
        emp_id = str(row['empID']).strip()
        if not emp_id or pd.isna(row['empID']):
            continue
            
        # check if exists
        res = await db.execute(select(LoginAlias).where(LoginAlias.alias == emp_id))
        alias = res.scalars().first()
        
        prof = None
        user = None
        
        if alias:
            # We already created this faculty (either in a previous row or before this upload)
            user_res = await db.execute(select(User).where(User.id == alias.user_id))
            user = user_res.scalars().first()
            
            prof_res = await db.execute(select(FacultyProfile).where(FacultyProfile.user_id == user.id))
            prof = prof_res.scalars().first()
        else:
            dept_id_code = str(row['Department ID']).strip() if 'Department ID' in df.columns and not pd.isna(row['Department ID']) else None
            dept = await get_or_create_department(db, row['Department'], dept_id_code)
            
            email = str(row['Email']).strip() if 'Email' in df.columns and not pd.isna(row['Email']) else None
            user = User(role=RoleEnum.FACULTY, must_change_password=True, password_hash=None, email=email)
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            new_alias = LoginAlias(alias=emp_id, user_id=user.id)
            db.add(new_alias)
            
            prof = FacultyProfile(user_id=user.id, department_id=dept.id if dept else None, name=str(row['Faculty-Name']).strip())
            db.add(prof)
            await db.commit()
            await db.refresh(prof)
            
        # Now add the Class assignment
        # Let's use the row's department for the class if provided.
        row_dept = await get_or_create_department(db, row['Department'])
        row_dept_id = row_dept.id if row_dept else prof.department_id
        
        cls = await get_or_create_class(db, row_dept_id, row.get('Semester'), row.get('Class'))
        
        subj_str = str(row['Subject Teaching']).strip() if 'Subject Teaching' in row and not pd.isna(row['Subject Teaching']) else ""
        subj_code_str = str(row['Subject Code']).strip() if 'Subject Code' in df.columns and not pd.isna(row['Subject Code']) else ""
        
        if subj_str and cls:
            subjects = [s.strip() for s in subj_str.split(',') if s.strip()]
            subject_codes = [c.strip() for c in subj_code_str.split(',') if c.strip()] if subj_code_str else []
            for idx, s in enumerate(subjects):
                s_code = subject_codes[idx] if idx < len(subject_codes) else None
                
                # Check if assignment already exists
                existing_assignment = await db.execute(select(FacultyAssignment).where(
                    FacultyAssignment.faculty_id == prof.id,
                    FacultyAssignment.class_id == cls.id,
                    FacultyAssignment.subject_name == s
                ))
                if not existing_assignment.scalars().first():
                    db.add(FacultyAssignment(
                        faculty_id=prof.id, 
                        class_id=cls.id, 
                        subject_code=s_code, 
                        subject_name=s
                    ))
                
                # Also add to FacultySubject if not exists
                existing_subject = await db.execute(select(FacultySubject).where(
                    FacultySubject.faculty_id == prof.id,
                    FacultySubject.subject_name == s
                ))
                if not existing_subject.scalars().first():
                    db.add(FacultySubject(
                        faculty_id=prof.id,
                        subject_code=s_code,
                        subject_name=s
                    ))
            await db.commit()

    return {"msg": "Faculty uploaded successfully"}

@router.post("/students/upload", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def upload_students(
    file: UploadFile = File(...),
    update_type: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
        
    # Expected: Sr.No, Enrollment Number, GR Number, Name, Class, Department, Subject1...
    if 'GR Number' not in df.columns or 'Enrollment Number' not in df.columns:
        raise HTTPException(status_code=400, detail="Missing GR Number or Enrollment Number")
        
    if update_type == "replace":
        await db.execute(delete(User).where(User.role == RoleEnum.STUDENT))
        await db.commit()
        
    subject_cols = [c for c in df.columns if c.lower().startswith('subject')]
    
    for index, row in df.iterrows():
        gr_no = str(row['GR Number']).strip()
        enroll = str(row['Enrollment Number']).strip()
        
        if pd.isna(row['GR Number']):
            continue
            
        res = await db.execute(select(LoginAlias).where(LoginAlias.alias == gr_no))
        if res.scalars().first() and update_type == "add":
            continue
            
        dept_id_code = str(row['Department ID']).strip() if 'Department ID' in df.columns and not pd.isna(row['Department ID']) else None
        dept = await get_or_create_department(db, row.get('Department'), dept_id_code)
        # Assuming semester is part of the sheet or we parse it? The prompt says Class and Department. We'll set semester=1 by default if not present
        cls = await get_or_create_class(db, dept.id if dept else None, row.get('Semester', 1), row.get('Class'))
        
        email = str(row['Email']).strip() if 'Email' in df.columns and not pd.isna(row['Email']) else None
        user = User(role=RoleEnum.STUDENT, must_change_password=True, password_hash=None, email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        db.add(LoginAlias(alias=gr_no, user_id=user.id))
        
        prof = StudentProfile(
            user_id=user.id,
            department_id=dept.id if dept else None,
            class_id=cls.id if cls else None,
            name=str(row['Name']).strip(),
            enrollment_number=enroll,
            gr_number=gr_no
        )
        db.add(prof)
        await db.commit()
        await db.refresh(prof)
        
        for sc in subject_cols:
            if sc.lower().startswith('subjectcode'):
                continue
            s_val = row[sc]
            if not pd.isna(s_val):
                code_col = sc.replace('Subject', 'SubjectCode')
                s_code = str(row[code_col]).strip() if code_col in df.columns and not pd.isna(row[code_col]) else None
                db.add(StudentSubject(student_id=prof.id, subject_code=s_code, subject_name=str(s_val).strip()))
                
        await db.commit()
        
    return {"msg": "Students uploaded successfully"}

@router.post("/generate-passwords/{role}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def generate_passwords(role: str, db: AsyncSession = Depends(get_db)):
    if role not in ["faculty", "student"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    r_enum = RoleEnum.FACULTY if role == "faculty" else RoleEnum.STUDENT
    
    # Find all users of this role with no password
    users_res = await db.execute(select(User).where(User.role == r_enum, User.password_hash == None, User.temp_encrypted_password == None))
    users = users_res.scalars().all()
    
    generated = []
    for u in users:
        # Generate 8 char password
        plain_pw = secrets.token_urlsafe(6)[:8]
        u.temp_encrypted_password = plain_pw # Temporarily store plain text to email later
        u.password_hash = ph.hash(plain_pw)
        u.must_change_password = True
        u.password_email_sent = False
        generated.append(u.id)
        
    await db.commit()
    return {"msg": f"Generated passwords for {len(generated)} {role}s"}

@router.post("/send-emails/{role}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def send_password_emails(role: str, db: AsyncSession = Depends(get_db)):
    if role not in ["faculty", "student"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    r_enum = RoleEnum.FACULTY if role == "faculty" else RoleEnum.STUDENT
    
    # Find users who have generated passwords but emails not sent
    users_res = await db.execute(
        select(User, LoginAlias.alias)
        .join(LoginAlias, User.id == LoginAlias.user_id)
        .where(
            User.role == r_enum,
            User.password_hash != None,
            User.must_change_password == True,
            User.password_email_sent == False,
            User.temp_encrypted_password != None
        )
    )
    
    users = users_res.all()
    
    sent_count = 0
    async with httpx.AsyncClient() as client:
        for u, alias in users:
            if not u.email:
                continue

            if settings.BREVO_API_KEY:
                payload = {
                    "sender": {
                        "name": settings.BREVO_SENDER_NAME,
                        "email": settings.BREVO_SENDER_EMAIL
                    },
                    "to": [
                        {
                            "email": u.email,
                            "name": u.email
                        }
                    ],
                    "subject": "Your AutoExam Login Details",
                    "htmlContent": f"<p>Hello!</p><p>Your account has been created.</p><p>Login ID: <b>{alias}</b></p><p>Password: <b>{u.temp_encrypted_password}</b></p><p>Please login and change your password immediately.</p>"
                }
                headers = {
                    "accept": "application/json",
                    "api-key": settings.BREVO_API_KEY,
                    "content-type": "application/json"
                }
                
                try:
                    brevo_res = await client.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
                    if not brevo_res.is_success:
                        print(f"Failed to send email to {u.email} via Brevo: {brevo_res.text}")
                except Exception as e:
                    print(f"Error sending email to {u.email}: {e}")
            else:
                # Dev console dispatch fallback when Brevo is not configured
                email_content = f"""
                SUBJECT: Your AutoExam Login Details
                TO: {u.email}
                
                Hello! Your account has been created.
                Login ID: {alias}
                Password: {u.temp_encrypted_password}
                
                Please login and change your password immediately.
                """
                print(f"--- [Dev] Email Dispatch Notification ---{email_content}\n-----------------------")
            
            u.password_email_sent = True
            u.temp_encrypted_password = None # Wipe it after sending for security
            sent_count += 1
        
    await db.commit()
    return {"msg": f"Sent {sent_count} emails successfully"}

@router.post("/classes/upload", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def upload_classes(
    file: UploadFile = File(...),
    update_type: str = Form(default="add"),
    db: AsyncSession = Depends(get_db)
):
    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
        
    if update_type == "replace":
        await db.execute(delete(Class))
        await db.commit()
        
    for index, row in df.iterrows():
        dept_id_code = str(row.get('Department ID')).strip() if 'Department ID' in df.columns and not pd.isna(row.get('Department ID')) else None
        dept_name = row.get('Department')
        sem = row.get('Semester')
        cls_name = row.get('Class')
        if pd.isna(dept_name) or pd.isna(sem) or pd.isna(cls_name):
            continue
        dept = await get_or_create_department(db, str(dept_name).strip(), dept_id_code)
        await get_or_create_class(db, dept.id, int(sem), str(cls_name).strip())
        
    return {"msg": "Classes uploaded successfully"}

class FacultyAssignmentInput(BaseModel):
    class_id: int
    subject_code: Optional[str] = None
    subject_name: str

class AssignClassesRequest(BaseModel):
    assignments: list[FacultyAssignmentInput]

class SingleAssignmentUpdateSchema(BaseModel):
    old_class_id: int
    old_subject_name: str
    new_class_id: int
    new_subject_name: str
    new_subject_code: Optional[str] = None

class FacultyUpdateSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    emp_id: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    subjects: Optional[list[str]] = None

class StudentUpdateSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    gr_no: Optional[str] = None
    enrollment_no: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    class_id: Optional[int] = None
    subjects: Optional[list[str]] = None

@router.post("/faculty/{faculty_id}/assign-classes", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
@router.put("/faculty/{faculty_id}/assign-classes", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def assign_faculty_classes(
    faculty_id: int,
    req: AssignClassesRequest,
    db: AsyncSession = Depends(get_db)
):
    prof = await db.get(FacultyProfile, faculty_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Faculty not found")
        
    # Delete old assignments
    from app.models.profile import FacultyAssignment
    await db.execute(delete(FacultyAssignment).where(FacultyAssignment.faculty_id == faculty_id))
    
    for assign in req.assignments:
        db.add(FacultyAssignment(
            faculty_id=faculty_id,
            class_id=assign.class_id,
            subject_code=assign.subject_code,
            subject_name=assign.subject_name
        ))
        
    await db.commit()
    return {"msg": "Classes assigned successfully"}

@router.put("/faculty/{faculty_id}/assignment", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_single_faculty_assignment(
    faculty_id: int,
    req: SingleAssignmentUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    prof = await db.get(FacultyProfile, faculty_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Faculty not found")

    target_cls = await db.get(Class, req.new_class_id)
    if not target_cls:
        raise HTTPException(status_code=400, detail=f"Class with ID {req.new_class_id} not found")

    from app.models.profile import FacultyAssignment
    res = await db.execute(select(FacultyAssignment).where(
        FacultyAssignment.faculty_id == faculty_id,
        FacultyAssignment.class_id == req.old_class_id,
        FacultyAssignment.subject_name == req.old_subject_name
    ))
    assign = res.scalars().first()

    # Check if target assignment already exists to avoid duplicate constraint collisions
    dup_res = await db.execute(select(FacultyAssignment).where(
        FacultyAssignment.faculty_id == faculty_id,
        FacultyAssignment.class_id == req.new_class_id,
        FacultyAssignment.subject_name == req.new_subject_name
    ))
    existing_target = dup_res.scalars().first()

    if existing_target and assign and existing_target.id != assign.id:
        await db.delete(assign)
    elif assign:
        assign.class_id = req.new_class_id
        assign.subject_name = req.new_subject_name
        assign.subject_code = req.new_subject_code
    elif not existing_target:
        assign = FacultyAssignment(
            faculty_id=faculty_id,
            class_id=req.new_class_id,
            subject_name=req.new_subject_name,
            subject_code=req.new_subject_code
        )
        db.add(assign)

    await db.commit()
    return {"msg": "Assignment mapping updated successfully"}

@router.get("/analytics")
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func, text
    from app.models.viva import StudentVivaRun, ExamRun, StudentVivaStatus
    from app.models.exam import Exam
    from app.models.mcq import MCQExam, MCQStudentAttempt, MCQAttemptStatus
    from app.models.ai_billing import AISettings
    import time
    import redis.asyncio as aioredis
    from app.core.config import settings

    # 1. KPIs
    students_count = (await db.execute(select(func.count(StudentProfile.id)))).scalar() or 0
    faculty_count = (await db.execute(select(func.count(FacultyProfile.id)))).scalar() or 0
    classes_count = (await db.execute(select(func.count(Class.id)))).scalar() or 0
    viva_exams_count = (await db.execute(select(func.count(Exam.id)))).scalar() or 0
    mcq_exams_count = (await db.execute(select(func.count(MCQExam.id)))).scalar() or 0
    total_exams_count = viva_exams_count + mcq_exams_count
    
    completed_viva_runs = (await db.execute(
        select(func.count(StudentVivaRun.id)).where(StudentVivaRun.status == StudentVivaStatus.COMPLETED)
    )).scalar() or 0
    
    submitted_mcq_attempts = (await db.execute(
        select(func.count(MCQStudentAttempt.id)).where(MCQStudentAttempt.status == MCQAttemptStatus.SUBMITTED)
    )).scalar() or 0
    
    active_lockouts = (await db.execute(
        select(func.count(MCQStudentAttempt.id)).where(MCQStudentAttempt.status == MCQAttemptStatus.LOCKED_OUT)
    )).scalar() or 0

    ai_settings_res = await db.execute(select(AISettings).order_by(AISettings.id.asc()).limit(1))
    ai_settings = ai_settings_res.scalars().first()
    ai_token_balance = ai_settings.token_balance if ai_settings else 0
    ai_wallet_balance = ai_settings.wallet_balance_inr if ai_settings else 0.0

    kpis = {
        "students_count": students_count,
        "faculty_count": faculty_count,
        "classes_count": classes_count,
        "viva_exams_count": viva_exams_count,
        "mcq_exams_count": mcq_exams_count,
        "total_exams_count": total_exams_count,
        "completed_viva_runs": completed_viva_runs,
        "submitted_mcq_attempts": submitted_mcq_attempts,
        "total_completed_assessments": completed_viva_runs + submitted_mcq_attempts,
        "active_lockouts": active_lockouts,
        "ai_token_balance": ai_token_balance,
        "ai_wallet_balance": ai_wallet_balance
    }

    # 2. Subject-wise analysis (Average Score)
    subject_stats_res = await db.execute(
        select(
            Exam.subject_name,
            func.avg(StudentVivaRun.total_score).label('avg_score'),
            func.count(StudentVivaRun.id).label('total_students')
        )
        .join(ExamRun, Exam.id == ExamRun.exam_id)
        .join(StudentVivaRun, ExamRun.id == StudentVivaRun.exam_run_id)
        .where(StudentVivaRun.status == StudentVivaStatus.COMPLETED)
        .group_by(Exam.subject_name)
    )
    
    subject_stats = []
    for row in subject_stats_res.all():
        subject_stats.append({
            "subject": row.subject_name,
            "avg_score": round(float(row.avg_score), 2) if row.avg_score else 0,
            "total_students": row.total_students
        })
        
    # 3. Class-wise analysis (Average Score)
    class_stats_res = await db.execute(
        select(
            Class.name.label('class_name'),
            func.avg(StudentVivaRun.total_score).label('avg_score'),
            func.count(StudentVivaRun.id).label('total_students')
        )
        .join(Exam, Class.id == Exam.class_id)
        .join(ExamRun, Exam.id == ExamRun.exam_id)
        .join(StudentVivaRun, ExamRun.id == StudentVivaRun.exam_run_id)
        .where(StudentVivaRun.status == StudentVivaStatus.COMPLETED)
        .group_by(Class.name)
    )
    
    class_stats = []
    for row in class_stats_res.all():
        class_stats.append({
            "class_name": row.class_name,
            "avg_score": round(float(row.avg_score), 2) if row.avg_score else 0,
            "total_students": row.total_students
        })

    # 4. Recent Activity (Recent 10 events across Viva and MCQ)
    recent_activities = []
    recent_vivas = await db.execute(
        select(StudentVivaRun, StudentProfile.name.label("student_name"), Exam.subject_name)
        .join(StudentProfile, StudentVivaRun.student_id == StudentProfile.id)
        .join(ExamRun, StudentVivaRun.exam_run_id == ExamRun.id)
        .join(Exam, ExamRun.exam_id == Exam.id)
        .where(StudentVivaRun.completed_at.is_not(None))
        .order_by(desc(StudentVivaRun.completed_at))
        .limit(5)
    )
    for v_run, s_name, subj in recent_vivas.all():
        recent_activities.append({
            "type": "viva_completed",
            "title": f"Oral Viva Completed: {subj}",
            "student_name": s_name,
            "detail": f"Scored {v_run.total_score} marks (Grade {v_run.grade or 'N/A'})",
            "timestamp": v_run.completed_at.isoformat() if v_run.completed_at else None
        })

    recent_mcqs = await db.execute(
        select(MCQStudentAttempt, StudentProfile.name.label("student_name"), MCQExam.subject_name)
        .join(StudentProfile, MCQStudentAttempt.student_id == StudentProfile.id)
        .join(MCQExam, MCQStudentAttempt.mcq_exam_id == MCQExam.id)
        .where(MCQStudentAttempt.submitted_at.is_not(None))
        .order_by(desc(MCQStudentAttempt.submitted_at))
        .limit(5)
    )
    for m_att, s_name, subj in recent_mcqs.all():
        recent_activities.append({
            "type": "mcq_submitted",
            "title": f"MCQ Exam Submitted: {subj}",
            "student_name": s_name,
            "detail": f"Scored {m_att.score_awarded} marks ({m_att.percentage or 0}%)",
            "timestamp": m_att.submitted_at.isoformat() if m_att.submitted_at else None
        })

    recent_lockouts = await db.execute(
        select(MCQStudentAttempt, StudentProfile.name.label("student_name"), MCQExam.subject_name)
        .join(StudentProfile, MCQStudentAttempt.student_id == StudentProfile.id)
        .join(MCQExam, MCQStudentAttempt.mcq_exam_id == MCQExam.id)
        .where(MCQStudentAttempt.lockout_count > 0)
        .order_by(desc(MCQStudentAttempt.last_lockout_at))
        .limit(5)
    )
    for l_att, s_name, subj in recent_lockouts.all():
        recent_activities.append({
            "type": "lockout_incident",
            "title": f"Proctoring Alert: {subj}",
            "student_name": s_name,
            "detail": f"Reason: {l_att.last_lockout_reason or 'Security trigger'} (Flagged {l_att.lockout_count}x)",
            "timestamp": l_att.last_lockout_at.isoformat() if l_att.last_lockout_at else None
        })

    # Sort combined activities by timestamp descending
    recent_activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    recent_activities = recent_activities[:10]

    # 5. Live Service Health Latencies
    db_latency_ms = 0.0
    db_healthy = True
    try:
        t0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    except Exception:
        db_healthy = False

    redis_latency_ms = 0.0
    redis_healthy = True
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        t1 = time.perf_counter()
        await r.ping()
        redis_latency_ms = round((time.perf_counter() - t1) * 1000, 2)
        await r.aclose()
    except Exception:
        redis_healthy = False

    system_health = {
        "status": "operational" if (db_healthy and redis_healthy) else "degraded",
        "database": {"healthy": db_healthy, "latency_ms": db_latency_ms, "name": "PostgreSQL 16"},
        "redis": {"healthy": redis_healthy, "latency_ms": redis_latency_ms, "name": "Redis Cache & Queue"},
        "api": {"healthy": True, "name": "FastAPI Core"}
    }
        
    return {
        "kpis": kpis,
        "subject_wise": subject_stats,
        "class_wise": class_stats,
        "recent_activity": recent_activities,
        "system_health": system_health
    }

@router.get("/faculties", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_faculties(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(FacultyProfile, Department.name.label("department_name"), Department.department_id, LoginAlias.alias.label("emp_id"), User)
        .outerjoin(Department, FacultyProfile.department_id == Department.id)
        .join(User, FacultyProfile.user_id == User.id)
        .outerjoin(LoginAlias, User.id == LoginAlias.user_id)
    )
    faculties = []
    from app.models.profile import FacultyAssignment
    for prof, dept_name, dept_id_code, emp_id, prof_user in res.all():
        # Fetch subjects
        subj_res = await db.execute(select(FacultySubject).where(FacultySubject.faculty_id == prof.id))
        subjects = [f"{s.subject_code} - {s.subject_name}" if s.subject_code else s.subject_name for s in subj_res.scalars().all()]
        
        # Fetch assigned classes with names
        cls_res = await db.execute(
            select(Class.id, Department.name, Class.semester, Class.name, FacultyAssignment.subject_name, FacultyAssignment.subject_code)
            .select_from(FacultyAssignment)
            .join(Class, FacultyAssignment.class_id == Class.id)
            .join(Department, Class.department_id == Department.id)
            .where(FacultyAssignment.faculty_id == prof.id)
        )
        
        assigned_class_ids = []
        assigned_classes = []
        assignments_details = []
        for c_id, d, s, c, subj_name, subj_code in cls_res.all():
            assigned_class_ids.append(c_id)
            assigned_classes.append(f"{d} Sem-{s} {c} ({subj_name})")
            assignments_details.append({
                "class_id": c_id,
                "class_name": f"{d} Sem-{s} {c}",
                "subject_name": subj_name,
                "subject_code": subj_code
            })
        
        faculties.append({
            "id": prof.id,
            "emp_id": emp_id,
            "name": prof.name,
            "department": f"{dept_id_code} - {dept_name}" if dept_id_code else dept_name,
            "department_id": prof.department_id,
            "department_name": dept_name,
            "subjects": subjects,
            "assigned_classes": assigned_classes,
            "assigned_class_ids": assigned_class_ids,
            "assignments": assignments_details,
            "has_password": prof_user.password_hash is not None,
            "email": prof_user.email,
            "must_change_password": prof_user.must_change_password,
            "password_email_sent": prof_user.password_email_sent
        })
    return faculties

@router.put("/faculties/{faculty_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_faculty(
    faculty_id: int,
    req: FacultyUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    prof = await db.get(FacultyProfile, faculty_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Faculty not found")

    user = await db.get(User, prof.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    # Update name
    if req.name is not None and req.name.strip():
        prof.name = req.name.strip()

    # Update email
    if req.email is not None and req.email.strip():
        new_email = req.email.strip().lower()
        if new_email != (user.email or "").lower():
            exist_user = await db.execute(select(User).where(User.email == new_email, User.id != user.id))
            if exist_user.scalars().first():
                raise HTTPException(status_code=400, detail="Email is already in use by another user")
            user.email = new_email

    # Update emp_id (login alias)
    if req.emp_id is not None and req.emp_id.strip():
        new_emp = req.emp_id.strip()
        alias_res = await db.execute(select(LoginAlias).where(LoginAlias.user_id == user.id))
        alias = alias_res.scalars().first()
        if alias:
            if alias.alias != new_emp:
                exist_alias = await db.execute(select(LoginAlias).where(LoginAlias.alias == new_emp, LoginAlias.user_id != user.id))
                if exist_alias.scalars().first():
                    raise HTTPException(status_code=400, detail="Employee ID already exists for another user")
                alias.alias = new_emp
        else:
            exist_alias = await db.execute(select(LoginAlias).where(LoginAlias.alias == new_emp))
            if exist_alias.scalars().first():
                raise HTTPException(status_code=400, detail="Employee ID already exists for another user")
            db.add(LoginAlias(user_id=user.id, alias=new_emp))

    # Update Department
    if req.department_id is not None:
        prof.department_id = req.department_id
    elif req.department_name is not None and req.department_name.strip():
        dept_name = req.department_name.strip()
        dept_res = await db.execute(select(Department).where(Department.name == dept_name))
        dept = dept_res.scalars().first()
        if not dept:
            dept = Department(name=dept_name)
            db.add(dept)
            await db.flush()
        prof.department_id = dept.id

    # Update Subjects
    if req.subjects is not None:
        await db.execute(delete(FacultySubject).where(FacultySubject.faculty_id == faculty_id))
        seen_subj = set()
        for subj in req.subjects:
            s_clean = subj.strip()
            if not s_clean:
                continue
            s_code = None
            s_name = s_clean
            if " - " in s_clean:
                parts = s_clean.split(" - ", 1)
                s_code = parts[0].strip()
                s_name = parts[1].strip()
            
            if s_name.lower() not in seen_subj:
                seen_subj.add(s_name.lower())
                db.add(FacultySubject(
                    faculty_id=faculty_id,
                    subject_code=s_code,
                    subject_name=s_name
                ))

    await db.commit()
    await db.refresh(prof)
    return {"msg": "Faculty updated successfully", "id": prof.id}

@router.delete("/faculties/{faculty_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def delete_faculty(faculty_id: int, db: AsyncSession = Depends(get_db)):
    prof = await db.get(FacultyProfile, faculty_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Faculty not found")
        
    await db.execute(delete(User).where(User.id == prof.user_id))
    await db.commit()
    return {"msg": "Faculty deleted successfully"}

@router.get("/departments", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.FACULTY]))])
async def list_departments(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Department).order_by(Department.name))
    depts = res.scalars().all()
    return [{"id": d.id, "name": d.name, "department_id": d.department_id} for d in depts]

@router.get("/classes", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN, RoleEnum.FACULTY]))])
async def list_classes(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Class, Department.name.label("department_name"), Department.department_id)
        .outerjoin(Department, Class.department_id == Department.id)
    )
    classes = []
    for cls, dept_name, dept_id_code in res.all():
        classes.append({
            "id": cls.id,
            "name": cls.name,
            "semester": cls.semester,
            "department_id": cls.department_id,
            "department": f"{dept_id_code} - {dept_name}" if dept_id_code else dept_name
        })
    return classes

@router.get("/students", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_students(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(StudentProfile, Department.name.label("department_name"), Department.department_id, Class.name.label("class_name"), Class.semester, LoginAlias.alias.label("gr_no"), User)
        .outerjoin(Department, StudentProfile.department_id == Department.id)
        .outerjoin(Class, StudentProfile.class_id == Class.id)
        .join(User, StudentProfile.user_id == User.id)
        .outerjoin(LoginAlias, User.id == LoginAlias.user_id)
    )
    students = []
    for prof, dept_name, dept_id_code, cls_name, sem, gr_no, student_user in res.all():
        subj_res = await db.execute(select(StudentSubject).where(StudentSubject.student_id == prof.id))
        subjects = [f"{s.subject_code} - {s.subject_name}" if s.subject_code else s.subject_name for s in subj_res.scalars().all()]
        
        students.append({
            "id": prof.id,
            "gr_no": prof.gr_number,
            "enrollment_no": prof.enrollment_number,
            "name": prof.name,
            "department": f"{dept_id_code} - {dept_name}" if dept_id_code else dept_name,
            "department_id": prof.department_id,
            "department_name": dept_name,
            "class_id": prof.class_id,
            "class_name": cls_name,
            "semester": sem,
            "subjects": subjects,
            "has_password": student_user.password_hash is not None,
            "email": student_user.email,
            "must_change_password": student_user.must_change_password,
            "password_email_sent": student_user.password_email_sent
        })
    return students

@router.put("/students/{student_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def update_student(
    student_id: int,
    req: StudentUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    prof = await db.get(StudentProfile, student_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Student not found")

    user = await db.get(User, prof.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    # Update name
    if req.name is not None and req.name.strip():
        prof.name = req.name.strip()

    # Update email
    if req.email is not None and req.email.strip():
        new_email = req.email.strip().lower()
        if new_email != (user.email or "").lower():
            exist_user = await db.execute(select(User).where(User.email == new_email, User.id != user.id))
            if exist_user.scalars().first():
                raise HTTPException(status_code=400, detail="Email is already in use by another user")
            user.email = new_email

    # Update GR Number
    if req.gr_no is not None and req.gr_no.strip():
        new_gr = req.gr_no.strip()
        if new_gr != prof.gr_number:
            exist_gr = await db.execute(select(StudentProfile).where(StudentProfile.gr_number == new_gr, StudentProfile.id != student_id))
            if exist_gr.scalars().first():
                raise HTTPException(status_code=400, detail="GR Number already in use by another student")
            prof.gr_number = new_gr
            
            alias_res = await db.execute(select(LoginAlias).where(LoginAlias.user_id == user.id))
            alias = alias_res.scalars().first()
            if alias:
                alias.alias = new_gr
            else:
                db.add(LoginAlias(user_id=user.id, alias=new_gr))

    # Update Enrollment Number
    if req.enrollment_no is not None and req.enrollment_no.strip():
        new_enr = req.enrollment_no.strip()
        if new_enr != prof.enrollment_number:
            exist_enr = await db.execute(select(StudentProfile).where(StudentProfile.enrollment_number == new_enr, StudentProfile.id != student_id))
            if exist_enr.scalars().first():
                raise HTTPException(status_code=400, detail="Enrollment number already in use by another student")
            prof.enrollment_number = new_enr

    # Update Department
    if req.department_id is not None:
        prof.department_id = req.department_id
    elif req.department_name is not None and req.department_name.strip():
        dept_name = req.department_name.strip()
        dept_res = await db.execute(select(Department).where(Department.name == dept_name))
        dept = dept_res.scalars().first()
        if not dept:
            dept = Department(name=dept_name)
            db.add(dept)
            await db.flush()
        prof.department_id = dept.id

    # Update Class
    if req.class_id is not None:
        prof.class_id = req.class_id

    # Update Subjects
    if req.subjects is not None:
        await db.execute(delete(StudentSubject).where(StudentSubject.student_id == student_id))
        seen_subj = set()
        for subj in req.subjects:
            s_clean = subj.strip()
            if not s_clean:
                continue
            s_code = None
            s_name = s_clean
            if " - " in s_clean:
                parts = s_clean.split(" - ", 1)
                s_code = parts[0].strip()
                s_name = parts[1].strip()
            
            if s_name.lower() not in seen_subj:
                seen_subj.add(s_name.lower())
                db.add(StudentSubject(
                    student_id=student_id,
                    subject_code=s_code,
                    subject_name=s_name
                ))

    await db.commit()
    await db.refresh(prof)
    return {"msg": "Student updated successfully", "id": prof.id}

@router.delete("/students/{student_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def delete_student(student_id: int, db: AsyncSession = Depends(get_db)):
    prof = await db.get(StudentProfile, student_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Student not found")
        
    await db.execute(delete(User).where(User.id == prof.user_id))
    await db.commit()
    return {"msg": "Student deleted successfully"}

# -------------------------------------------------------------
# System Health Ping
# -------------------------------------------------------------
@router.get("/system-health", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_system_health(db: AsyncSession = Depends(get_db)):
    db_start = time.perf_counter()
    db_healthy = True
    try:
        await db.execute(text("SELECT 1"))
        db_ms = round((time.perf_counter() - db_start) * 1000, 2)
    except Exception:
        db_healthy = False
        db_ms = -1

    redis_start = time.perf_counter()
    redis_healthy = True
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        redis_ms = round((time.perf_counter() - redis_start) * 1000, 2)
        await r.aclose()
    except Exception:
        redis_healthy = False
        redis_ms = -1

    return {
        "status": "operational" if (db_healthy and redis_healthy) else "degraded",
        "timestamp": time.time(),
        "services": [
            {"name": "PostgreSQL Primary", "healthy": db_healthy, "latency_ms": db_ms},
            {"name": "Redis In-Memory Broker", "healthy": redis_healthy, "latency_ms": redis_ms},
            {"name": "FastAPI App Server", "healthy": True, "latency_ms": 1.0}
        ]
    }

# -------------------------------------------------------------
# Master Gradebook & Accreditation Exports
# -------------------------------------------------------------
@router.get("/master-results", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def get_master_results(
    search: Optional[str] = None,
    class_id: Optional[int] = None,
    assessment_type: Optional[str] = None, # "all", "viva", "mcq"
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    results = []
    
    # 1. Fetch Viva Results
    if not assessment_type or assessment_type in ("all", "viva"):
        viva_q = (
            select(
                StudentVivaRun,
                StudentProfile.name.label("student_name"),
                StudentProfile.enrollment_number,
                StudentProfile.gr_number,
                Department.name.label("department_name"),
                Class.name.label("class_name"),
                Class.id.label("class_id"),
                Exam.subject_name,
                Exam.total_marks
            )
            .join(StudentProfile, StudentVivaRun.student_id == StudentProfile.id)
            .join(ExamRun, StudentVivaRun.exam_run_id == ExamRun.id)
            .join(Exam, ExamRun.exam_id == Exam.id)
            .outerjoin(Class, StudentProfile.class_id == Class.id)
            .outerjoin(Department, StudentProfile.department_id == Department.id)
            .where(StudentVivaRun.status == StudentVivaStatus.COMPLETED)
        )
        if class_id:
            viva_q = viva_q.where(Class.id == class_id)
        if search:
            s_clean = f"%{search.strip().lower()}%"
            viva_q = viva_q.where(
                or_(
                    func.lower(StudentProfile.name).like(s_clean),
                    func.lower(StudentProfile.enrollment_number).like(s_clean),
                    func.lower(Exam.subject_name).like(s_clean)
                )
            )
        
        v_res = await db.execute(viva_q)
        for v_run, s_name, enr, gr, dept, cls_name, cls_id, subj, max_m in v_res.all():
            total_m = max_m or 100.0
            score = v_run.total_score or 0.0
            pct = round((score / total_m) * 100, 2) if total_m > 0 else 0.0
            results.append({
                "id": f"viva_{v_run.id}",
                "assessment_type": "Oral Viva",
                "student_name": s_name,
                "enrollment_number": enr,
                "gr_number": gr,
                "department": dept or "General",
                "class_name": cls_name or "N/A",
                "subject": subj,
                "score": score,
                "max_marks": total_m,
                "percentage": pct,
                "grade": v_run.grade or ("A" if pct >= 80 else ("B" if pct >= 60 else "C")),
                "completed_at": v_run.completed_at.isoformat() if v_run.completed_at else None
            })

    # 2. Fetch MCQ Results
    if not assessment_type or assessment_type in ("all", "mcq"):
        mcq_q = (
            select(
                MCQStudentAttempt,
                StudentProfile.name.label("student_name"),
                StudentProfile.enrollment_number,
                StudentProfile.gr_number,
                Department.name.label("department_name"),
                Class.name.label("class_name"),
                Class.id.label("class_id"),
                MCQExam.subject_name,
                MCQExam.total_marks
            )
            .join(StudentProfile, MCQStudentAttempt.student_id == StudentProfile.id)
            .join(MCQExam, MCQStudentAttempt.mcq_exam_id == MCQExam.id)
            .outerjoin(Class, StudentProfile.class_id == Class.id)
            .outerjoin(Department, StudentProfile.department_id == Department.id)
            .where(MCQStudentAttempt.status == MCQAttemptStatus.SUBMITTED)
        )
        if class_id:
            mcq_q = mcq_q.where(Class.id == class_id)
        if search:
            s_clean = f"%{search.strip().lower()}%"
            mcq_q = mcq_q.where(
                or_(
                    func.lower(StudentProfile.name).like(s_clean),
                    func.lower(StudentProfile.enrollment_number).like(s_clean),
                    func.lower(MCQExam.subject_name).like(s_clean)
                )
            )

        m_res = await db.execute(mcq_q)
        for m_att, s_name, enr, gr, dept, cls_name, cls_id, subj, max_m in m_res.all():
            total_m = max_m or 100.0
            score = m_att.score_awarded or 0.0
            pct = m_att.percentage or (round((score / total_m) * 100, 2) if total_m > 0 else 0.0)
            results.append({
                "id": f"mcq_{m_att.id}",
                "assessment_type": "Objective MCQ",
                "student_name": s_name,
                "enrollment_number": enr,
                "gr_number": gr,
                "department": dept or "General",
                "class_name": cls_name or "N/A",
                "subject": subj,
                "score": score,
                "max_marks": total_m,
                "percentage": pct,
                "grade": m_att.grade or ("A" if pct >= 80 else ("B" if pct >= 60 else "C")),
                "completed_at": m_att.submitted_at.isoformat() if m_att.submitted_at else None
            })

    # Sort by completed_at desc
    results.sort(key=lambda r: r.get("completed_at") or "", reverse=True)
    
    total_count = len(results)
    start_idx = (page - 1) * limit
    paged_results = results[start_idx:start_idx + limit]

    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "results": paged_results
    }

@router.get("/master-results/export-csv", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def export_master_results_csv(
    class_id: Optional[int] = None,
    assessment_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    # Fetch all records without pagination
    data_response = await get_master_results(
        class_id=class_id,
        assessment_type=assessment_type,
        page=1,
        limit=5000,
        db=db
    )
    records = data_response.get("results", [])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Student Name",
        "Enrollment Number",
        "GR Number",
        "Department",
        "Class",
        "Assessment Type",
        "Subject / Examination",
        "Score Obtained",
        "Maximum Marks",
        "Percentage (%)",
        "Grade",
        "Completion Date & Time"
    ])

    for r in records:
        writer.writerow([
            r.get("student_name", ""),
            r.get("enrollment_number", ""),
            r.get("gr_number", ""),
            r.get("department", ""),
            r.get("class_name", ""),
            r.get("assessment_type", ""),
            r.get("subject", ""),
            r.get("score", 0),
            r.get("max_marks", 100),
            r.get("percentage", 0),
            r.get("grade", ""),
            r.get("completed_at", "")
        ])

    output.seek(0)
    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Master_Examination_Accreditation_Report.csv"}
    )

# -------------------------------------------------------------
# Anti-Cheat & Lockout Audit Feed
# -------------------------------------------------------------
@router.get("/anti-cheat/incidents", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def list_anti_cheat_incidents(db: AsyncSession = Depends(get_db)):
    q = (
        select(
            MCQStudentAttempt,
            StudentProfile.name.label("student_name"),
            StudentProfile.enrollment_number,
            Class.name.label("class_name"),
            MCQExam.subject_name
        )
        .join(StudentProfile, MCQStudentAttempt.student_id == StudentProfile.id)
        .join(MCQExam, MCQStudentAttempt.mcq_exam_id == MCQExam.id)
        .outerjoin(Class, StudentProfile.class_id == Class.id)
        .where(
            or_(
                MCQStudentAttempt.lockout_count > 0,
                MCQStudentAttempt.status == MCQAttemptStatus.LOCKED_OUT
            )
        )
        .order_by(desc(MCQStudentAttempt.last_lockout_at))
    )
    res = await db.execute(q)
    incidents = []
    for m_att, s_name, enr, cls_name, subj in res.all():
        incidents.append({
            "attempt_id": m_att.id,
            "student_name": s_name,
            "enrollment_number": enr,
            "class_name": cls_name or "N/A",
            "subject": subj,
            "lockout_count": m_att.lockout_count,
            "last_lockout_reason": m_att.last_lockout_reason or "Proctoring threshold exceeded",
            "last_lockout_at": m_att.last_lockout_at.isoformat() if m_att.last_lockout_at else None,
            "status": m_att.status.value if hasattr(m_att.status, "value") else str(m_att.status),
            "faculty_approved": m_att.faculty_approved
        })
    return incidents

@router.post("/anti-cheat/approve-reentry/{attempt_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def approve_student_reentry(attempt_id: int, db: AsyncSession = Depends(get_db)):
    attempt = await db.get(MCQStudentAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")
    
    attempt.status = MCQAttemptStatus.IN_PROGRESS
    attempt.faculty_approved = True
    await db.commit()
    return {"msg": f"Re-entry approved. Student may now resume the exam.", "attempt_id": attempt_id}


