# Assumptions & Decisions

1. **Temporary Password Handling & Security**: 
   - Generated passwords must be **8 DIGITS** as per specs. Because an 8-digit pin provides extremely low entropy (only 10^8 combinations), strict **login lockout and rate limiting** are mandatory.
   - Lockout rule: **5 failed attempts -> 15 minute lock** (tracked per account and per IP in Redis, returning a generic error).
   - Temporary passwords: The Argon2 hash will be stored in `password_hash`, and a Fernet-encrypted version of the plaintext will be stored in `temp_encrypted_password`. This temporary encrypted field is wiped (set to `NULL`) permanently upon the password **CHANGE** event (not just successful login). It also has a hard expiry of **7 days**.
2. **Login ID Uniqueness & Aliases**: 
   - To prevent identity collisions across roles (e.g. empID colliding with GR number), we use a `login_aliases` table linking a strictly globally unique `alias` to the `user_id`.
   - Imports must **reject any value** that collides with any existing login namespace.
3. **Token Storage**: 
   - The **refresh token** is stored in an `httpOnly Secure SameSite` cookie.
   - The **access token** is returned in JSON and stored in memory.
   - Enforced by strict CSRF and CORS policies.
4. **Roster Rule**: 
   - The students that appear in a viva's roster are determined by the rule: **Students of the exam's class enrolled in the exam's subject with that faculty** (accounting for electives).
5. **Phase 1 Alembic Scope**:
   - The Phase 1 database migration only creates tables required for Foundation: `auth`, `audit`, and `settings`. Later phases add their respective domain tables (exams, results, etc.).
6. **LLM & STT Failure Modes**: If Ollama goes offline during a viva, the viva will not block. Audio and transcript will still be recorded. AI grading will be marked as "pending" or "needs review", and can be re-triggered later or evaluated manually by the faculty.
7. **Timer Synchronization**: The timer is authoritative on the server. The server tracks the question start timestamp and broadcasts tick/sync events. If a client disconnects and reconnects, they receive the absolute elapsed time. If a question timer ends, the UI will **auto-advance** to the next question with a short, configurable warning.
8. **Storage and Downloads Implementation**: We will use a polymorphic `StorageBackend`. For development, it writes to `backend/storage_data/`. Audio streams will be natively compressed (e.g., Opus/WebM) to save space. On-demand downloads (zips with recordings, PDFs) are not pre-generated; they are built asynchronously only when the faculty requests them in the UI.
9. **Live AI Marks display**: Expected AI marks shown during a viva run (Module 3, Step 5) are read-only to prevent workflow interruption. Faculty perform adjustments/overrides later in the Results module (Module 5) where they can view the full transcript and context simultaneously.
10. **Vector Database**: We are strictly forbidden from adding `pgvector` or external vector DBs. Embeddings will be stored as `float8[]` in PostgreSQL. We will perform semantic similarity (cosine similarity) using in-memory **NumPy** operations on the retrieved rows. We will **NOT** use SciPy.
11. **Roster Snapshot Behavior**: When an exam run starts, the current roster is snapshotted into `viva_sessions`. Changes to the master class roster will not affect in-progress or completed sessions. If a student is added dynamically during the live roster verification, they are marked with a `late_added` flag.
12. **Grading Weights**: The grading engine blends semantic similarity and LLM evaluations. Default grading weights will be configurable (e.g., 40% similarity, 60% LLM) but can be adjusted later per exam.
13. **Evaluate-Out-Of Semantics**: Faculty can choose to evaluate a student based on questions *actually asked* (if the viva was cut short) versus questions *planned*. The `results` table will store both the evaluated basis (string) and the explicit denominator used, ensuring accurate grade mappings.
14. **Publish Flags**: Publishing results supports two explicit flags: `send_marks` and `send_recording_transcript`. This allows faculty to release transcripts without revealing final marks if they choose.
