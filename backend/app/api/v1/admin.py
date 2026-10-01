import io
import pandas as pd
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from argon2 import PasswordHasher
import secrets

from app.api.deps import get_db, require_roles
from app.models.user import User, RoleEnum, LoginAlias
from app.models.profile import Department, Class, FacultyProfile, FacultySubject, StudentProfile, StudentSubject

router = APIRouter()
ph = PasswordHasher()

async def get_or_create_department(db: AsyncSession, dept_name: str) -> Department:
    if not dept_name or pd.isna(dept_name):
        return None
    dept_name = str(dept_name).strip()
    result = await db.execute(select(Department).where(Department.name == dept_name))
    dept = result.scalars().first()
    if not dept:
        dept = Department(name=dept_name)
        db.add(dept)
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
        
    # Expected: Sr.No, empID, Department, Faculty-Name, Subject Teaching
    expected_cols = ['empID', 'Department', 'Faculty-Name', 'Subject Teaching']
    if not all(col in df.columns for col in expected_cols):
        raise HTTPException(status_code=400, detail="Missing required columns in Excel sheet.")
        
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
        if res.scalars().first() and update_type == "add":
            continue # skip duplicate
            
        dept = await get_or_create_department(db, row['Department'])
        
        # Create User
        user = User(role=RoleEnum.FACULTY, must_change_password=True, password_hash=None) # Password generated later
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Create Login Alias
        alias = LoginAlias(alias=emp_id, user_id=user.id)
        db.add(alias)
        
        # Create Profile
        prof = FacultyProfile(user_id=user.id, department_id=dept.id if dept else None, name=str(row['Faculty-Name']).strip())
        db.add(prof)
        await db.commit()
        await db.refresh(prof)
        
        # Subjects
        subj = str(row['Subject Teaching']).strip()
        if subj and not pd.isna(row['Subject Teaching']):
            db.add(FacultySubject(faculty_id=prof.id, subject_name=subj))
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
            
        dept = await get_or_create_department(db, row.get('Department'))
        # Assuming semester is part of the sheet or we parse it? The prompt says Class and Department. We'll set semester=1 by default if not present
        cls = await get_or_create_class(db, dept.id if dept else None, row.get('Semester', 1), row.get('Class'))
        
        user = User(role=RoleEnum.STUDENT, must_change_password=True, password_hash=None)
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
            s_val = row[sc]
            if not pd.isna(s_val):
                db.add(StudentSubject(student_id=prof.id, subject_name=str(s_val).strip()))
                
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
        u.temp_encrypted_password = plain_pw # In production, store encrypted with Fernet
        u.password_hash = ph.hash(plain_pw)
        generated.append(u.id)
        
    await db.commit()
    return {"msg": f"Generated passwords for {len(generated)} {role}s"}

@router.post("/classes/upload", dependencies=[Depends(require_roles([RoleEnum.SUPERADMIN, RoleEnum.ADMIN]))])
async def upload_classes(
    file: UploadFile = File(...),
    department_name: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
        
    dept = await get_or_create_department(db, department_name)
    
    for index, row in df.iterrows():
        sem = row.get('Semester')
        cls_name = row.get('Class')
        if pd.isna(sem) or pd.isna(cls_name):
            continue
        await get_or_create_class(db, dept.id, int(sem), str(cls_name).strip())
        
    return {"msg": "Classes uploaded successfully"}

from pydantic import BaseModel
class AssignClassesRequest(BaseModel):
    class_ids: list[int]

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
    from app.models.profile import FacultyClass
    await db.execute(delete(FacultyClass).where(FacultyClass.faculty_id == faculty_id))
    
    for cid in req.class_ids:
        db.add(FacultyClass(faculty_id=faculty_id, class_id=cid))
        
    await db.commit()
    return {"msg": "Classes assigned successfully"}
