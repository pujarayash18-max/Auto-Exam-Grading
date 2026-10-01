# REST API and WebSocket Events

## REST API Endpoints

### Auth
- `POST /api/v1/auth/login`: Accepts credentials. Refresh token is returned in an `httpOnly Secure SameSite` cookie. Access token is returned in JSON (stored in memory). Enforces CSRF + strict CORS.
- `POST /api/v1/auth/refresh`: Accepts refresh token cookie, returns new access token.
- `POST /api/v1/auth/logout`: Revokes refresh token and clears cookie.
- `POST /api/v1/auth/forgot-password`: Requests a password reset.
- `POST /api/v1/auth/change-password`: For first-time login users forced to change passwords.

### Super Admin
*Note: Super Admin inherits all Admin permissions. Any `/api/v1/admin/*` route is also accessible by Super Admin.*
- `GET /api/v1/superadmin/analytics`: Retrieves cross-department/class/faculty analytics.
- `GET/POST/PUT/DELETE /api/v1/superadmin/users`: CRUD for all users.
- `GET/PUT /api/v1/superadmin/settings`: Manage `site_settings`.
- `GET /api/v1/superadmin/audit`: View audit logs.
- `GET /api/v1/superadmin/health`: Returns system health (Redis, Celery, DB, Ollama, Whisper).

### Admin
- `GET /api/v1/admin/analytics`: Retrieves scoped analytics for the admin.
- `GET/POST/PUT/DELETE /api/v1/admin/departments`: Paginated/filterable CRUD.
- `GET/POST/PUT/DELETE /api/v1/admin/classes`: Paginated/filterable CRUD.
- `GET/POST/PUT/DELETE /api/v1/admin/subjects`: Paginated/filterable CRUD.
- `GET/POST/PUT/DELETE /api/v1/admin/faculty`: Paginated/filterable CRUD for faculty.
- `GET/POST/PUT/DELETE /api/v1/admin/students`: Paginated/filterable CRUD for students.
- `GET/POST/PUT/DELETE /api/v1/admin/assignments`: Paginated/filterable CRUD for faculty-class assignments (multi-select).
- `POST /api/v1/admin/import/faculty`: Excel upload for faculty (returns preview).
- `POST /api/v1/admin/import/faculty/commit`: Commits faculty import.
- `POST /api/v1/admin/import/assignments`: Excel upload for class assignments.
- `POST /api/v1/admin/import/assignments/commit`: Commits class assignments.
- `POST /api/v1/admin/import/students`: Excel upload for students.
- `POST /api/v1/admin/import/students/commit`: Commits student import.
- `POST /api/v1/admin/credentials/generate`: Idempotent password generation for faculty/students.
- `GET /api/v1/admin/credentials/export`: Export generated credentials to a secure file.
- `GET /api/v1/admin/templates/{entity}`: Retrieve Excel templates for imports.
- `GET /api/v1/admin/password-resets`: List pending password reset requests.
- `POST /api/v1/admin/users/{id}/reset-password`: Approves a forgot password request, generates a new password.

### Faculty
- `GET/POST/PUT/DELETE /api/v1/faculty/exams`: CRUD for scheduled exams.
- `GET/POST/PUT/DELETE /api/v1/faculty/exams/{id}/materials`: CRUD for PDF/PPT materials.
- `GET/POST/PUT/DELETE /api/v1/faculty/exams/{id}/questions`: AI generated question bank CRUD.
- `POST /api/v1/faculty/exams/{id}/generate-questions`: Trigger AI to parse materials and generate questions (async task).
- `GET /api/v1/faculty/exams/{id}/generate-questions/status`: Check progress of generation.
- `POST /api/v1/faculty/exams/{id}/start-run`: Start an exam run, returning an `exam_run_id`.

**Exam Runs & Vivas**
- `POST /api/v1/faculty/exam-runs/{id}/roster`: Verify, add, or remove students before starting.
- `POST /api/v1/faculty/exam-runs/{id}/set-type`: Set the exam type (a, b, or c).
- `POST /api/v1/faculty/exam-runs/{id}/finish`: Complete the entire class's viva.
- `POST /api/v1/faculty/sessions/start`: Initializes a specific student's viva session.
- `GET /api/v1/faculty/sessions/{id}/state`: Fetch the current session state (current question, elapsed time) to recover from a browser refresh.
- `POST /api/v1/faculty/sessions/{id}/pause`: REST fallback for pausing the viva.
- `POST /api/v1/faculty/sessions/{id}/resume`: REST fallback for resuming the viva.

**Results & Media**
- `GET /api/v1/faculty/results`: Retrieve evaluated results for vivas.
- `PUT /api/v1/faculty/results/{id}/override`: Override AI marks with a reason.
- `POST /api/v1/faculty/results/{id}/re-evaluate`: Re-run pending or failed evaluation.
- `POST /api/v1/faculty/results/publish`: Publish results to students.
- `POST /api/v1/faculty/results/{id}/unpublish`: Unpublish previously published results.
- `GET /api/v1/faculty/results/export`: Export results to Excel/PDF.
- `GET /api/v1/faculty/downloads`: Retrieve list of download bundles.
- `POST /api/v1/faculty/downloads`: Request a new download bundle generation.
- `DELETE /api/v1/faculty/downloads/{id}`: Delete generated download package.

### Student
- `GET /api/v1/student/profile`: Retrieves student profile and subjects.
- `GET /api/v1/student/exams`: Upcoming scheduled exams.
- `GET /api/v1/student/results`: Published viva results.

### Media & Playback (Authorized)
- `GET /api/v1/media/recordings/{id}`: Stream audio playback (verified ownership for student/faculty).

## WebSocket Events

Auth: Sent as an initial `auth` frame containing the JWT. No JWT in the URL query string.
Channels: 
1. **Exam Run Channel**: `wss://<host>/api/v1/ws/exam-runs/{exam_run_id}`
2. **Session Channel**: `wss://<host>/api/v1/ws/sessions/{session_id}`

### Exam Run Channel
**Server-to-Client**
- `roster.updated`: `{"student_id": int, "status": string, "late_added": boolean}`

### Session Channel
**Client-to-Server**
- `auth`: `{"token": string}`
- `viva.start_question`: `{"question_index": int}`
- `audio.chunk`: Sent as **binary frames** containing Opus/WebM audio data. The first 4 bytes indicate the `sequence_no` (integer) for reassembly, followed by the raw media buffer.
- `viva.pause`: `{"reason": string}`
- `viva.resume`: `{}`
- `viva.finish`: `{}`

**Server-to-Client**
- `viva.started`: `{"session_id": int, "started_at": datetime}`
- `viva.question_changed`: `{"index": int, "question_text": string, "timer_seconds": int}`
- `viva.timer_tick`: `{"elapsed_seconds": int, "remaining_seconds": int}`
- `transcript.partial`: `{"text": string}`
- `transcript.final`: `{"text": string, "sequence_no": int}`
- `viva.paused`: `{"paused_at": datetime}`
- `viva.resumed`: `{"resumed_at": datetime}`
- `viva.finished`: `{"ended_at": datetime, "total_duration": int}`
- `storage.confirmed`: `{"recording_id": int, "status": "saved"}`
- `evaluation.ready`: `{"question_index": int, "status": string}`
- `result.published`: `{"session_id": int, "published_at": datetime}`
- `file.processing_status`: `{"file_id": int, "status": string, "progress": int}`
- `error`: `{"code": string, "message": string}`
