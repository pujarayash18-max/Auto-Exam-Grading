# Architecture

## Overview
- **Frontend**: Next.js (App Router), React, Tailwind CSS, shadcn/ui.
- **Backend**: Python 3.12, FastAPI, Uvicorn.
- **Database**: PostgreSQL 18.6 with SQLAlchemy 2.x and Alembic. Embeddings stored as float arrays (no pgvector).
- **Cache/Queue**: Redis (caching, celery broker, websockets).
- **AI/ML**: `faster-whisper` (STT), Sentence Transformers (embeddings), Ollama (local LLM for generation/grading).
- **Storage**: Local filesystem via a `StorageBackend` interface (planned MinIO for prod).
- **Communication**: REST API (unary calls) + WebSockets (real-time viva state).

## Mermaid ER Diagram

```mermaid
erDiagram
    users {
        int id PK
        string role
        string password_hash
        string temp_encrypted_password
        datetime temp_password_expires_at
        boolean must_change_password
        boolean active
    }
    login_aliases {
        int id PK
        string alias UK
        int user_id FK
    }
    faculty_profiles {
        int id PK
        int user_id FK
        string empID UK
        int department_id FK
        string name
        datetime archived_at
    }
    student_profiles {
        int id PK
        int user_id FK
        string enrollment_number UK
        string gr_number UK
        string name
        int class_id FK
        int department_id FK
        datetime archived_at
    }
    departments {
        int id PK
        string name
    }
    classes {
        int id PK
        string name
        string semester
        int department_id FK
    }
    subjects {
        int id PK
        string name
        int department_id FK
    }
    faculty_subjects {
        int id PK
        int faculty_id FK
        int subject_id FK
    }
    faculty_class_assignments {
        int id PK
        int faculty_id FK
        int class_id FK
    }
    student_subject_enrollments {
        int id PK
        int student_id FK
        int subject_id FK
        int faculty_id FK
    }
    exams {
        int id PK
        int subject_id FK
        int class_id FK
        int faculty_id FK
        string default_exam_type
        string status
        datetime scheduled_at
        string location
        int timer_per_question
        int total_questions
        int total_marks
    }
    grade_ranges {
        int id PK
        int exam_id FK
        string grade
        float min_marks
        float max_marks
    }
    exam_materials {
        int id PK
        int exam_id FK
        string file_path
        string file_role
        string status
    }
    material_chunks {
        int id PK
        int exam_material_id FK
        text text_content
        string source_file
        string page_or_slide
        float8[] embedding
    }
    question_bank {
        int id PK
        int faculty_id FK
        int exam_id FK
        string source_reference
        text question
        text expected_answer
        float8[] expected_answer_embedding
        jsonb rubric_key_points
        string difficulty
    }
    exam_runs {
        int id PK
        int exam_id FK
        string exam_type
        string status
        datetime roster_confirmed_at
        datetime ended_at
    }
    viva_sessions {
        int id PK
        int exam_run_id FK
        int student_id FK
        string status
        boolean late_added
        int current_question_index
        datetime started_at
        datetime ended_at
    }
    session_questions {
        int id PK
        int session_id FK
        int question_id FK
        int order_index
    }
    question_attempts {
        int id PK
        int session_question_id FK
        text transcript
        string evaluation_status
        boolean confidence_flag
        jsonb weights_used
        boolean asked
        float ai_similarity_score
        float ai_llm_score
        text ai_feedback
        float faculty_override_score
        text faculty_override_reason
        float final_score
        string model_name
        string prompt_version
        datetime started_at
        datetime ended_at
    }
    recordings {
        int id PK
        int session_id FK
        int sequence_no
        string file_path
        string format
        int size_bytes
        int duration_seconds
        string status
    }
    results {
        int id PK
        int session_id FK
        float total_marks
        string grade
        string evaluated_basis
        int evaluated_denominator
        boolean send_marks
        boolean send_recording_transcript
        datetime published_at
        int published_by_faculty_id FK
    }
    site_settings {
        int id PK
        string logo_path
        text terms_and_conditions
        string contact_number
        string contact_email
    }
    audit_log {
        int id PK
        int user_id FK
        string action
        string entity_type
        int entity_id
        jsonb details
        datetime created_at
    }
    refresh_tokens {
        int id PK
        int user_id FK
        string token_hash
        boolean revoked
        datetime expires_at
    }
    password_reset_requests {
        int id PK
        int user_id FK
        string status
        datetime requested_at
        datetime resolved_at
        int resolved_by_admin_id FK
    }
    import_batches {
        int id PK
        int admin_id FK
        string entity_type
        string mode
        int success_count
        int error_count
        jsonb errors
        datetime imported_at
    }
    downloads {
        int id PK
        int faculty_id FK
        string file_path
        string format
        int size_bytes
        string status
        datetime expires_at
        datetime generated_at
    }

    users ||--o{ login_aliases : identifies_by
    users ||--o| faculty_profiles : has
    users ||--o| student_profiles : has
    users ||--o{ refresh_tokens : owns
    users ||--o{ audit_log : performs
    users ||--o{ password_reset_requests : makes
    faculty_profiles ||--o{ faculty_subjects : teaches
    subjects ||--o{ faculty_subjects : taught_by
    faculty_profiles ||--o{ faculty_class_assignments : assigned
    classes ||--o{ faculty_class_assignments : includes
    departments ||--o{ classes : owns
    departments ||--o{ subjects : offers
    departments ||--o{ faculty_profiles : works_in
    departments ||--o{ student_profiles : studies_in
    student_profiles ||--o{ student_subject_enrollments : takes
    subjects ||--o{ student_subject_enrollments : involves
    faculty_profiles ||--o{ student_subject_enrollments : teaches
    faculty_profiles ||--o{ exams : schedules
    classes ||--o{ exams : takes
    subjects ||--o{ exams : covers
    exams ||--o{ exam_runs : executes
    exams ||--o{ grade_ranges : defines
    exams ||--o{ exam_materials : utilizes
    exam_materials ||--o{ material_chunks : split_into
    exams ||--o{ question_bank : contains
    faculty_profiles ||--o{ question_bank : owns
    exam_runs ||--o{ viva_sessions : executes
    student_profiles ||--o{ viva_sessions : participates
    viva_sessions ||--o{ session_questions : asks
    question_bank ||--o{ session_questions : links
    session_questions ||--o| question_attempts : records
    viva_sessions ||--o{ recordings : stores
    viva_sessions ||--o| results : yields
    faculty_profiles ||--o{ results : publishes
    users ||--o{ import_batches : executes
    faculty_profiles ||--o{ downloads : generates
```

## Constraints & Indexes
1. `login_aliases.alias` is strictly unique. This prevents GR number, enrollment number, empID, or username collisions.
2. Unique Constraint `(exam_run_id, student_id)` on `viva_sessions`.
3. Unique Constraint `(faculty_id, class_id)` on `faculty_class_assignments`.
4. Unique Constraint `(student_id, subject_id)` on `student_subject_enrollments`.
5. Partial Unique Index for **one active run per exam** on `exam_runs`.
6. `role` and all `status` columns are strictly controlled via PostgreSQL Enums or `CHECK` constraints.
7. `site_settings` enforced to a single row globally.
