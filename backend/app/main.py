from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, admin, faculty, viva

app = FastAPI(title="AutoExamGrading API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(faculty.router, prefix="/api/v1/faculty", tags=["faculty"])
app.include_router(viva.router, prefix="/api/v1/viva", tags=["viva"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
