import io
import pandas as pd
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from argon2 import PasswordHasher
import secrets
import httpx
from app.core.config import settings

from app.api.deps import get_db, require_roles, get_current_user
from app.models.user import User, RoleEnum, LoginAlias
from app.models.profile import Department, Class, FacultyProfile, FacultySubject, FacultyAssignment, StudentProfile, StudentSubject

router = APIRouter()
ph = PasswordHasher()

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

@router.post("/faculty/{faculty_id}/assign-classes", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
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

@router.get("/analytics")
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    from app.models.viva import StudentVivaRun, ExamRun
    from app.models.exam import Exam

    # Subject-wise analysis (Average Score)
    subject_stats_res = await db.execute(
        select(
            Exam.subject_name,
            func.avg(StudentVivaRun.total_score).label('avg_score'),
            func.count(StudentVivaRun.id).label('total_students')
        )
        .join(ExamRun, Exam.id == ExamRun.exam_id)
        .join(StudentVivaRun, ExamRun.id == StudentVivaRun.exam_run_id)
        .where(StudentVivaRun.status == "completed")
        .group_by(Exam.subject_name)
    )
    
    subject_stats = []
    for row in subject_stats_res.all():
        subject_stats.append({
            "subject": row.subject_name,
            "avg_score": float(row.avg_score) if row.avg_score else 0,
            "total_students": row.total_students
        })
        
    # Class-wise analysis (Average Score)
    class_stats_res = await db.execute(
        select(
            Class.name.label('class_name'),
            func.avg(StudentVivaRun.total_score).label('avg_score'),
            func.count(StudentVivaRun.id).label('total_students')
        )
        .join(Exam, Class.id == Exam.class_id)
        .join(ExamRun, Exam.id == ExamRun.exam_id)
        .join(StudentVivaRun, ExamRun.id == StudentVivaRun.exam_run_id)
        .where(StudentVivaRun.status == "completed")
        .group_by(Class.name)
    )
    
    class_stats = []
    for row in class_stats_res.all():
        class_stats.append({
            "class_name": row.class_name,
            "avg_score": float(row.avg_score) if row.avg_score else 0,
            "total_students": row.total_students
        })
        
    return {
        "subject_wise": subject_stats,
        "class_wise": class_stats
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

@router.delete("/faculties/{faculty_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def delete_faculty(faculty_id: int, db: AsyncSession = Depends(get_db)):
    prof = await db.get(FacultyProfile, faculty_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Faculty not found")
        
    await db.execute(delete(User).where(User.id == prof.user_id))
    await db.commit()
    return {"msg": "Faculty deleted successfully"}

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
            "class_name": cls_name,
            "semester": sem,
            "subjects": subjects,
            "has_password": student_user.password_hash is not None,
            "email": student_user.email,
            "must_change_password": student_user.must_change_password,
            "password_email_sent": student_user.password_email_sent
        })
    return students

@router.delete("/students/{student_id}", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def delete_student(student_id: int, db: AsyncSession = Depends(get_db)):
    prof = await db.get(StudentProfile, student_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Student not found")
        
    await db.execute(delete(User).where(User.id == prof.user_id))
    await db.commit()
    return {"msg": "Student deleted successfully"}

