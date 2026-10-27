from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, admin, faculty, viva, results, student, ai_billing
from app.api.deps import engine
from app.models.base import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Gracefully create any new database tables (e.g. ai_billing) if DB is reachable
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Database table verification deferred: {e}")
    yield

from fastapi.responses import JSONResponse
from fastapi import Request
import logging

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="AutoExamGrading API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"}
    )

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(ai_billing.router, prefix="/api/v1/admin/ai", tags=["ai-billing"])
app.include_router(faculty.router, prefix="/api/v1/faculty", tags=["faculty"])
app.include_router(viva.router, prefix="/api/v1/viva", tags=["viva"])
app.include_router(results.router, prefix="/api/v1/results", tags=["results"])
app.include_router(student.router, prefix="/api/v1/student", tags=["student"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
