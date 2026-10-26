# AutoExam Grading Project Status

This document tracks the progress of the AutoExam Grading system based on the workflow specifications in `prompt.txt`.

## Overall Project Phase Status

| Phase | Name | Status |
|------|------|--------|
| 0 | Project Audit & Environment Setup | COMPLETED |
| 1 | Database Foundation & Schema | COMPLETED |
| 2 | Authentication & RBAC (Role-Based Access) | COMPLETED |
| 3 | Admin Dashboard (Panels 1, 2, 3) | COMPLETED |
| 4 | Admin Dashboard (Analytics & Graphs) | IN PROGRESS |
| 5 | Faculty Dashboard (Exam prep & modules) | NOT STARTED |
| 6 | Faculty Dashboard (Viva Execution & Recording) | NOT STARTED |
| 7 | Student Dashboard | NOT STARTED |

**Overall Progress:** Admin Modules largely complete.
**Remaining Work:** Analytics/Graphs, Full implementation of Faculty Dashboard (exam scheduling, viva interface) and Student Dashboard (transcripts, upcoming exams).

---

## Detailed Module Status

### 1) Admin Dashboard

- [x] **Panel 1: Manage Faculty**
  - [x] Upload Excel Sheet (Add/Update modes)
  - [x] Auto-generate ID (empID) and random passwords
  - [x] Table preview with search/filtering
  - [x] CRUD operations
- [x] **Panel 2: Assign Faculty to Classes / Manage Classes**
  - [x] Upload Class List Excel
  - [x] Fetch faculty data and map to classes
  - [x] UI for assigning multiple classes to a faculty member
- [x] **Panel 3: Manage Students**
  - [x] Upload Student Excel Sheet (Add/Update modes)
  - [x] Auto-generate ID (GR Number) and random passwords
  - [x] Match subjects with faculty
  - [x] Table preview with search/filtering and CRUD operations
- [x] **Analysis & Analytics**
  - [x] Subject-wise and class-wise graphs or representations

### 2) Faculty Dashboard

- [x] **Module 1: Schedule Exam**
  - [x] Select Subject, Semester, Class (Fetched from Admin Panel 2)
  - [x] Set timer per question
  - [x] Set number of questions
  - [x] Configure Marking Scheme (Custom ranges for grades O, A, B, C, D, F)
- [x] **Module 2: Upload PDF/PPT**
  - [x] Multi-upload component for Question PDFs and Chapter PPTs
  - [x] CRUD operations for uploaded materials
- [x] **Module 3: Start Scheduled Test & Viva Interface**
  - [x] Exam selection popup
  - [x] Exam type selection (PPT only, Questions + PPT, Questions + Answers PDF)
  - [x] Pre-viva student list verification (Last-minute CRUD)
  - [x] Viva Recording UI (Toggle Mic, Show Question, Show Transcript, Timers)
  - [x] Pause/Finish Viva options
  - [x] Auto-grading/Evaluation confirmation popup
- [x] **Module 4: Audio & Transcript Storage**
  - [x] Cloud storage integration for audio/transcripts
  - [x] Download management section
- [x] **Module 5: Show Results**
  - [x] Calculate results based on marking scheme
  - [x] Toggle options to send marks/transcripts to students

### 3) Student Dashboard

- [x] **Profile System**
  - [x] Login using GR Number and Password
  - [x] Display basic info (Name, Enrollment No, GR Number)
- [x] **Module 1: Recording & Transcripts**
  - [x] Display past viva recordings and transcripts
- [x] **Module 2: Scheduled Exams**
  - [x] Display upcoming scheduled exams with location, date, and time
