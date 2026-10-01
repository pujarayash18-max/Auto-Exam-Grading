# Agent Invocation Log

## Phase 1 Review Gate

**Review Date**: 2026-10-01
**Agents Invoked**: 
- Code Reviewer (Simulated via skill execution)
- Database Optimizer (Simulated via skill execution)
- Identity & Access Engineer (Simulated via skill execution)

### Code Reviewer Findings
- Checked the `seed.py` logic and confirmed it securely handles production passwords, falling back to cryptographically secure `secrets.token_urlsafe(12)`.
- Verified CORS middleware is configured correctly in `main.py` but noted that production deployment should use dynamic or strict origin matching from environment variables rather than hardcoded `http://localhost:3000`.
- Ensured JWT secrets are loaded via environment variables rather than hardcoded.
- Confirmed use of `asyncio` across the stack without blocking calls in the async routes.

### Database Optimizer Findings
- Verified `alembic` setup uses `asyncpg`.
- Ensured global unique constraints exist on `LoginAlias.alias`.
- Enforced single-row integrity on `site_settings` via `CheckConstraint('id = 1')`.
- All foreign keys correctly define `ondelete="CASCADE"` for proper parent-child relationship handling (e.g. cascading user deletion to aliases and refresh tokens).

### Identity & Access Engineer Findings
- Verified password hashing uses `argon2-cffi` per OWASP recommendations.
- Validated Redis implementation for brute-force protection (5 failed attempts trigger a 15-minute IP/User lockout).
- Verified `refresh_token` implementation uses HTTP-Only, Secure, SameSite=Strict cookies to mitigate XSS and CSRF risks.
- Confirmed `access_token` lifetime is kept short (15 minutes), mitigating the impact of token leakage in memory.
- Enforced RBAC at the edge via Next.js middleware by parsing the JWT payload to isolate role dashboards.

### Known Gaps & Next Steps
- Refresh token rotation needs to be added (currently only generates token and issues cookie, does not revoke old token during refresh endpoint logic because the `/refresh` endpoint hasn't been implemented yet).
- Change password logic does not yet invalidate active refresh tokens, which is a best practice.

## Phase 2 Review Gate

**Review Date**: 2026-10-01
**Agents Invoked**: 
- Data Engineer (Simulated via skill execution)
- Frontend Developer (Simulated via skill execution)
- Database Optimizer (Simulated via skill execution)

### Data Engineer Findings
- Excel uploads for Faculty, Classes, and Students are routed correctly using `pandas` for multi-format (CSV/XLSX) support.
- Configured idempotent parsing that safely updates or adds (append mode vs replace mode).
- Verified `generate-passwords` endpoint logic assigns random 8-character passwords using `secrets` to newly ingested users cleanly.

### Frontend Developer Findings
- Built `AdminDashboard` in `frontend/src/app/(admin)/dashboard/page.tsx`.
- Ensured a tabbed layout is correctly implemented for `Faculty`, `Classes`, and `Students`.
- Bound API calls seamlessly to backend using standard HTML5 `FormData`.
- Noted that a data table to view, edit, and filter existing records is required per `prompt.txt` specifications (CRUD Operations needed for Panel 1, 2, and 3). 

### Database Optimizer Findings
- Verified `profile.py` correctly defines `Department`, `Class`, `FacultyProfile`, `FacultySubject`, `FacultyClass`, `StudentProfile`, and `StudentSubject` tables.
- Proper constraints `UniqueConstraint` on junction tables (`FacultySubject`, `StudentSubject`) enforced.
- Alembic models properly exposed via `backend/app/models/__init__.py`.

### Known Gaps & Next Steps
- The data tables (CRUD for uploaded faculties/students/classes) need to be visualized in the frontend instead of just standard upload forms.
- Need to finalize the migration execution since the `backend` docker image is still building.

## Phase 4 Review Gate

**Review Date**: 2026-10-01
**Agents Invoked**: 
- Backend Architect
- UI Designer
- Prompt Engineer (Preparing AI Question context)

### Backend Architect Findings
- Implemented `/api/v1/faculty/exams` and `materials` endpoints.
- DB relationships map correctly to Faculty constraints: A faculty can only create exams for classes they are assigned to.
- Added `ExamQuestion` and `GradingScheme` schemas mapped directly to exams to calculate scores out-of-the-box.
- Added stub `POST` endpoint for AI Generation.

### UI Designer Findings
- Implemented standard, clean 3-tab layout for Faculty Dashboard: Schedule Exam, Upload Material, and Generate Questions.
- Grading schemas inputs support dynamic add rows (A, B, O grades with flexible ranges).
- Handled File upload component specifically targeting `.ppt`, `.pptx`, and `.pdf` files as requested by Phase 4.

### Known Gaps & Next Steps
- The AI Generation `generate-questions` endpoint is a stub that needs actual prompt integration with LLM models.
- "Manage Scheduled Exams" requires CRUD endpoints to delete or edit timings before start.

## Phase 5 Review Gate

**Review Date**: 2026-10-01
**Agents Invoked**: 
- Backend Architect
- Realtime Collaboration Engineer (Simulated)
- UI Designer

### Backend Architect Findings
- Implemented `/api/v1/viva/runs` to initialize an exam instance.
- Verified roster endpoint `/api/v1/viva/runs/{run_id}/roster` properly fetches student profile and tracks the `StudentVivaStatus` (Pending, In Progress, Completed).
- Integrated `StudentVivaRun` and `StudentVivaAnswer` schemas to track individual questions, expected vs actual answers, and STT transcripts.

### Realtime Collaboration Engineer & UI Designer Findings
- Designed `(faculty)/viva/page.tsx` as a unified controller for managing the Live Viva.
- Included "Start Scheduled Test" pre-flight screen with Exam Type selection.
- Roster table acts as a dispatch center to start/resume viva for each student.
- Created "Live Viva Session" dark-mode interface with a pseudo-timer, live transcript visualizer, and "Pause Mic" / "End Viva" action buttons to fulfill `prompt.txt` requirements.

### Known Gaps & Next Steps
- Actual WebSockets or Audio Stream chunking needs to be wired to the `Pause Mic`/`Resume Mic` buttons for Speech-To-Text pipeline.
- Grading calculations need to process the resulting transcript using the Grading Schema set in Phase 4.

## Phase 6 Review Gate

**Review Date**: 2026-10-01
**Agents Invoked**: 
- AI Engineer
- Frontend Developer

### AI Engineer Findings
- Stubbed `backend/app/ai/grader.py` to evaluate student transcripts against expected answers and apply the grading schemas defined in Phase 4.
- Implemented `/api/v1/results` API for Faculty to view grading output, manually override the grade or total score, and selectively publish results.
- `StudentVivaRun` model was updated to include the `is_published` field to control visibility.

### Frontend Developer Findings
- Created `(faculty)/results/page.tsx` to handle the Results view. Faculty can search by Exam Run ID to see student scores, override marks, and toggle Publish status.
- Implemented `(student)/dashboard/page.tsx` as per the Student Module requirement. It contains three functional tabs:
  - Profile (Basic Info: Enrollment, GR, Dept).
  - Recording & Transcripts (Displays only `is_published=True` results from the faculty, showing Grade, Score, and generic download action buttons).
  - Scheduled Exams (Currently mocked list).

### Known Gaps & Next Steps
- Implement file serving endpoint for the Download Audio / Transcript buttons.
- Wire actual LLM (Ollama) into `grader.py`.
