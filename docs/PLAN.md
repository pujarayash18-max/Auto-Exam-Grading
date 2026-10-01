# Phase 0: Project Plan

## Phased Task List

1. **Phase 1: Foundation**
   - **Lead**: 🏗️ Backend Architect & ⚙️ DevOps Automator
   - **Supporting**: 🔐 Identity & Access Engineer, 🖥️ Frontend Developer, 🌿 Git Workflow Master, 🗄️ Database Optimizer
   - **Tasks**: Docker Compose, config, Alembic baseline (auth/audit/settings only), auth, login UI, role-based layouts, seed script.

2. **Phase 2: Super Admin and settings**
   - **Lead**: 🖥️ Frontend Developer
   - **Supporting**: 🏗️ Backend Architect, 🔌 API Platform Engineer, 🛡️ SRE
   - **Tasks**: Branding, CRUD screens, audit log, system health.

3. **Phase 3: Admin panels**
   - **Lead**: 🔧 Data Engineer
   - **Supporting**: 🔧 AI Data Remediation Engineer, 🔐 Identity & Access Engineer, 🖥️ Frontend Developer, 🛟 Database Reliability Engineer, 🗄️ Database Optimizer
   - **Tasks**: Excel upload/preview/commit, dedup/diff, idempotent password generation, forgot-password request queue and approval.

4. **Phase 4: Faculty scheduling and material**
   - **Lead**: 🖥️ Frontend Developer & 🔍 RAG Pipeline Engineer
   - **Supporting**: 🤖 AI Engineer, 🧬 Prompt Engineer, 🏗️ Backend Architect
   - **Tasks**: Schedule Exam, Upload PDF/PPT, AI question generation, question CRUD.

5. **Phase 5: Live viva**
   - **Lead**: 🤝 Realtime Collaboration Engineer & 🎙️ Voice AI Integration Engineer
   - **Supporting**: 🖥️ Frontend Developer, 🤖 AI Engineer, ⚡ Rapid Prototyper, 🛡️ SRE
   - **Tasks**: Exam run start, type selection, roster verification, live screen with mic, streaming STT, timers, pause/finish, storage confirmation.

6. **Phase 6: Grading, results, recordings**
   - **Lead**: 🤖 AI Engineer
   - **Supporting**: 🧬 Prompt Engineer, 🖥️ Frontend Developer, 🏗️ Backend Architect, 🔐 Identity & Access Engineer, 🛟 Database Reliability Engineer, 🤝 Realtime Collaboration Engineer
   - **Tasks**: Grading engine, expected marks view, on-demand downloads, override, publish toggles.

7. **Phase 7: Analytics and hardening**
   - **Lead**: 🛡️ SRE & 🏛️ Software Architect
   - **Supporting**: 🗄️ Database Optimizer, 🖥️ Frontend Developer, ⚡ Autonomous Optimization Architect, ♿ Section 508 Accessibility Specialist, 🔐 Identity & Access Engineer, 📚 Technical Writer, 🧭 Codebase Onboarding Engineer, 👁️ Code Reviewer
   - **Tasks**: Graphs, performance pass, security review, accessibility fixes, docs.

## Agent Assignments
- **Software Architect**: Phase 0 plan, architecture decision records, ER diagram sign-off.
- **Backend Architect**: FastAPI layering, transactions, Celery background jobs.
- **API Platform Engineer**: REST contract design, OpenAPI quality, `docs/API.md`.
- **Frontend Developer**: Next.js/React/Tailwind UI, tables, upload flows, dashboards.
- **Identity & Access Engineer**: Auth, JWT, Argon2, RBAC, temp credentials, forgot-password flow.
- **Data Engineer**: Excel import pipelines, validation, diff summaries.
- **Database Optimizer**: Schema review, indexes, constraints, query performance, Alembic.
- **AI Engineer**: Grading engine, embeddings pipeline, `LLMProvider` with Ollama.
- **Prompt Engineer**: Versioned Ollama prompts, strict JSON schemas.
- **Voice AI Integration Engineer**: Browser audio capture, live STT latency, full-pass transcription, compression.
- **Realtime Collaboration Engineer**: WebSocket design, reconnect/resume, server-authoritative viva state.
- **DevOps Automator**: Docker, CI pipeline, Windows/Docker Desktop environments.
- **Code Reviewer**: Mandatory review gate after every phase.
- **Technical Writer**: Documentation updates.
- **Git Workflow Master**: Branching strategy, `.gitattributes`.

## Approved Libraries
- **Python Backend**:
  - `fastapi`, `uvicorn[standard]`: Async web framework and ASGI server.
  - `sqlalchemy[asyncio]`, `alembic`, `asyncpg`, `greenlet`: Async ORM, DB migrations, async PostgreSQL driver, and the greenlet lib required for SQLAlchemy async.
  - `pydantic`, `pydantic-settings`: Data validation and environment settings management.
  - `python-multipart`: To support OAuth2 `application/x-www-form-urlencoded` form data for login.
  - `argon2-cffi`: The recommended hashing algorithm for passwords.
  - `pyjwt`: For generating and verifying JWT access and refresh tokens.
  - `redis`: Async driver to interact with Redis for IP/User lockouts and refresh token blocklists.
- **Frontend**:
  - `next`, `react`, `react-dom`, `tailwindcss`, `typescript`: Next.js 14 stack for SSR, API routes, and standard styling with TypeScript support.
- **python-multipart**: FastAPI file uploads.
- **cryptography**: Fernet encryption of temporary generated credentials.
- **pypdf** or **pdfplumber**: PDF text extraction.
- **python-pptx**: PPT/PPTX text extraction.
- **httpx**: Async client for Ollama.
- **recharts**: Frontend analytics charts.
- **ffmpeg**: System dependency in Docker image for audio conversion to Opus/WebM (approved for smaller storage and on-demand zip generation).

## Repository Folder Structure

```text
AutoExamGrading/
  .gitattributes             # Ensure LF line endings on Windows
  frontend/                  # Next.js app
    src/
      app/
        (auth)/
          login/
        (superadmin)/
        (admin)/
        (faculty)/
        (student)/
  backend/
    app/
      api/v1/                
      core/                  
      models/                
      schemas/               
      services/              
      repositories/          
      ai/                    
      storage/               
      tasks/                 
      ws/                    
    alembic/
    tests/
  nginx/
  docker-compose.yml
  docs/                      # PLAN.md, ARCHITECTURE.md, ASSUMPTIONS.md, API.md, AGENT_LOG.md, BACKLOG.md
    adr/                     # Architecture Decision Records
```

## Risks and Mitigations

- **Windows/Docker Desktop limits**: File I/O performance can be slow on Windows mounts. 
  - *Mitigation*: Keep DB data volumes inside Docker (not host-mounted), except for development source code. Set LF line endings in `.gitattributes`.
- **Reaching Ollama on the host**: Docker containers need to reach Ollama running on the Windows host. 
  - *Mitigation*: Use `http://host.docker.internal:11434` for Ollama API endpoint in Docker Compose.
- **Ollama Model Size vs RAM/VRAM**: Running local LLMs can exhaust laptop resources.
  - *Mitigation*: Configure models via environment variables. Start with quantized models (e.g., Llama 3 8B 4-bit) that fit inside typical 8-16GB RAM setups. 
- **Whisper CPU Load and Language Support**: Live STT can max out the CPU. English-only models will fail on mixed languages (e.g., Hindi, Gujarati).
  - *Mitigation*: Use `faster-whisper` with `int8` quantization. Use **multilingual** models (e.g., `small` instead of `small.en`) and make the STT language configurable in `.env`.
