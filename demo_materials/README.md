# AutoExam Sample Materials for All Three Exam Modes

This directory contains ready-to-upload sample files demonstrating the three examination modes supported by AutoExam:

---

### 1. Mode 1: Only PPT (`ppt_only`)
- **Sample File**: [`demo_lecture_slides.pptx`](file:///c:/Users/Yash%20Pujara/Desktop/New%20folder/AutoExamGrading/demo_materials/demo_lecture_slides.pptx)
- **Description**: Standard PowerPoint presentation slides containing lecture topics (Units on Stacks & Queues, QuickSort, Binary Search Trees, Hash Tables, and Graph BFS/DFS).
- **How AutoExam processes it**:
  1. AutoExam extracts text from all slides.
  2. The AI automatically formulates oral viva questions and generates expected benchmark answers directly from the slides.
  3. No pre-written question list is needed from the faculty.

---

### 2. Mode 2: Questions + PPT (`questions_ppt`)
- **Sample Files**:
  1. [`demo_lecture_slides.pptx`](file:///c:/Users/Yash%20Pujara/Desktop/New%20folder/AutoExamGrading/demo_materials/demo_lecture_slides.pptx) (Slide Deck)
  2. [`demo_questions_only_viva.pdf`](file:///c:/Users/Yash%20Pujara/Desktop/New%20folder/AutoExamGrading/demo_materials/demo_questions_only_viva.pdf) (Question List PDF)
- **Description**: Faculty provides the exact list of questions they want asked, along with their lecture slides. The answers are left empty or generated from the slides.
- **How AutoExam processes it**:
  1. AutoExam reads the exact questions from the question list.
  2. The AI uses the uploaded PPT slides as context to construct authoritative model answer benchmarks for grading.

---

### 3. Mode 3: Q&A PDF (`qa_pdf`)
- **Sample File**: [`demo_qa_viva.pdf`](file:///c:/Users/Yash%20Pujara/Desktop/New%20folder/AutoExamGrading/demo_materials/demo_qa_viva.pdf)
- **Description**: Fully prepared Question & Answer benchmark document in tabular format.
- **How AutoExam processes it**:
  1. AutoExam ingests the exact questions and faculty-defined model answers.
  2. The viva engine directly uses these pairs as the ground truth benchmark when evaluating students' spoken responses.
