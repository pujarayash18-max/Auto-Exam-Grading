'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ListChecks, Plus, Copy, Check, Eye, Trash2, Download, Upload,
  Sparkles, AlertTriangle, AlertCircle, ShieldAlert, Users, Clock, Award,
  CheckCircle2, Lock, ToggleLeft, ToggleRight, X, FileSpreadsheet, RefreshCw,
  Sliders, Percent, FileText
} from 'lucide-react';

interface MaterialFileItem {
  id: string;
  file: File;
  weightage: number;
}

interface MCQExamItem {
  id: number;
  access_pin: string;
  subject_name: string;
  class_id: number;
  class_name: string;
  duration_minutes: number;
  total_marks: number;
  questions_per_student: number;
  release_mode: 'immediate' | 'withheld';
  enable_blooms_taxonomy?: boolean;
  is_active: boolean;
  total_questions_in_pool: number;
  total_attempts: number;
  locked_attempts: number;
  submitted_attempts: number;
  created_at: string;
}

interface QuestionItem {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
  bloom_level?: string;
}

interface Assignment {
  id: number;
  class_id: number;
  class_name: string;
  subject_name: string;
}

export default function FacultyMCQPage() {
  const router = useRouter();
  const [exams, setExams] = useState<MCQExamItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedPin, setCopiedPin] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalMarks, setTotalMarks] = useState(100);
  const [questionsPerStudent, setQuestionsPerStudent] = useState(10);
  const [releaseMode, setReleaseMode] = useState<'immediate' | 'withheld'>('immediate');
  const [enableBloomsTaxonomy, setEnableBloomsTaxonomy] = useState(true);
  const [customPin, setCustomPin] = useState('');
  const [autoGenPin, setAutoGenPin] = useState(true);

  // Question Creation Options
  const [creationMethod, setCreationMethod] = useState<'template' | 'ai'>('template');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiFiles, setAiFiles] = useState<MaterialFileItem[]>([]);
  const [aiNotesText, setAiNotesText] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Multi-material weightage handlers
  const handleAddAiFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming: MaterialFileItem[] = Array.from(fileList).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      weightage: 20
    }));
    setAiFiles(prev => {
      const merged = [...prev, ...incoming];
      const equalShare = Math.floor(100 / merged.length);
      const remainder = 100 - equalShare * merged.length;
      return merged.map((item, idx) => ({
        ...item,
        weightage: idx === 0 ? equalShare + remainder : equalShare
      }));
    });
  };

  const handleUpdateAiFileWeightage = (id: string, weight: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(weight)));
    setAiFiles(prev => prev.map(f => f.id === id ? { ...f, weightage: clamped } : f));
  };

  const handleEqualizeAiWeightages = () => {
    if (aiFiles.length === 0) return;
    const equalShare = Math.floor(100 / aiFiles.length);
    const remainder = 100 - equalShare * aiFiles.length;
    setAiFiles(prev => prev.map((f, idx) => ({
      ...f,
      weightage: idx === 0 ? equalShare + remainder : equalShare
    })));
  };

  const handleRemoveAiFile = (id: string) => {
    setAiFiles(prev => {
      const remaining = prev.filter(f => f.id !== id);
      if (remaining.length === 0) return [];
      const equalShare = Math.floor(100 / remaining.length);
      const remainder = 100 - equalShare * remaining.length;
      return remaining.map((f, idx) => ({
        ...f,
        weightage: idx === 0 ? equalShare + remainder : equalShare
      }));
    });
  };

  // Questions Drawer State
  const [viewingQuestionsExam, setViewingQuestionsExam] = useState<MCQExamItem | null>(null);
  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Manual Add Question State
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQText, setNewQText] = useState('');
  const [newOptA, setNewOptA] = useState('');
  const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState('');
  const [newOptD, setNewOptD] = useState('');
  const [newCorrect, setNewCorrect] = useState('A');
  const [newExplanation, setNewExplanation] = useState('');
  const [newBloom, setNewBloom] = useState('Understand');
  const [savingNewQ, setSavingNewQ] = useState(false);

  const fetchExams = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExams(data);
      }
    } catch (err) {
      console.error('Failed to load MCQ exams', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/v1/faculty/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].class_id);
          setSubjectName(data[0].subject_name || '');
        }
      }
    } catch (err) {
      console.error('Failed to load assignments', err);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchAssignments();
  }, []);

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2000);
  };

  const handleToggleRelease = async (examId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/toggle-release`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExams(prev => prev.map(e => e.id === examId ? { ...e, release_mode: data.release_mode } : e));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (examId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/toggle-active`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExams(prev => prev.map(e => e.id === examId ? { ...e, is_active: data.is_active } : e));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = `${API_BASE_URL}/api/v1/mcq/template/download`;
  };

  const handleCreateExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!subjectName.trim()) {
      setSubmitError('Please enter a subject name');
      return;
    }
    if (!selectedClassId) {
      setSubmitError('Please select a target class');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Your session has expired. Please log in again.');
      }
      const payload = {
        subject_name: subjectName.trim(),
        class_id: Number(selectedClassId),
        duration_minutes: Number(durationMinutes),
        total_marks: Number(totalMarks),
        questions_per_student: Number(questionsPerStudent),
        release_mode: releaseMode,
        enable_blooms_taxonomy: enableBloomsTaxonomy,
        access_pin: autoGenPin ? null : customPin.trim() || null
      };

      // Helper to safely extract error message from API response without crashing on HTML (e.g. 413/502/504)
      const parseResponseError = async (res: Response, fallback: string): Promise<string> => {
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const err = await res.json();
            return err.detail || (typeof err === 'string' ? err : JSON.stringify(err)) || fallback;
          }
          const text = await res.text();
          if (res.status === 413 || text.includes('413') || text.includes('Too Large')) {
            return 'Uploaded file exceeds server size limit. Please upload a file smaller than 100MB.';
          }
          if (res.status === 504 || res.status === 502) {
            return 'Server processing timed out (504/502). Please try with fewer questions or shorter lecture notes.';
          }
          return `${fallback} (Status ${res.status})`;
        } catch {
          return fallback;
        }
      };

      // 1. Create Exam record
      const createRes = await fetch(`${API_BASE_URL}/api/v1/mcq/exams`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!createRes.ok) {
        const errMsg = await parseResponseError(createRes, 'Failed to create exam record.');
        throw new Error(errMsg);
      }

      const newExam = await createRes.json().catch(() => null);
      if (!newExam || !newExam.id) {
        throw new Error('Server returned an invalid response format when creating exam.');
      }
      const examId = newExam.id;

      // 2. Attach questions based on selected option
      if (creationMethod === 'template' && templateFile) {
        const formData = new FormData();
        formData.append('file', templateFile);
        formData.append('replace_existing', 'true');
        const uploadRes = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/template-upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (!uploadRes.ok) {
          const errMsg = await parseResponseError(uploadRes, 'Exam created, but template upload failed.');
          throw new Error(errMsg);
        }
      } else if (creationMethod === 'ai') {
        const formData = new FormData();
        formData.append('num_questions', String(aiNumQuestions));
        formData.append('replace_existing', 'true');
        formData.append('enable_blooms_taxonomy', String(enableBloomsTaxonomy));
        if (aiNotesText.trim()) formData.append('notes_text', aiNotesText.trim());
        
        // Multi-file materials with percentage weightages
        if (aiFiles.length > 0) {
          aiFiles.forEach(item => {
            formData.append('files', item.file);
          });
          const weightMap = aiFiles.map(item => ({
            filename: item.file.name,
            weightage: item.weightage
          }));
          formData.append('materials_weightages', JSON.stringify(weightMap));
        } else if (aiFile) {
          formData.append('file', aiFile);
        }

        const aiRes = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/ai-generate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (!aiRes.ok) {
          const errMsg = await parseResponseError(aiRes, 'Exam created, but AI question generation failed.');
          throw new Error(errMsg);
        }
      }

      setIsCreateModalOpen(false);
      setTemplateFile(null);
      setAiFile(null);
      setAiFiles([]);
      setAiNotesText('');
      fetchExams();
    } catch (err: any) {
      const msg = err?.message || 'Failed to complete exam setup';
      if (msg === 'Failed to fetch') {
        setSubmitError('Connection error: Unable to reach the backend server. Please verify your connection or refresh the page.');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenQuestionsDrawer = async (exam: MCQExamItem) => {
    setViewingQuestionsExam(exam);
    setLoadingQuestions(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${exam.id}/questions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExamQuestions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleDeleteExam = async (examId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the exam "${name}" and all its questions and student attempts?`)) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setExams(prev => prev.filter(e => e.id !== examId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingQuestionsExam) return;
    if (!newQText.trim() || !newOptA.trim() || !newOptB.trim() || !newOptC.trim() || !newOptD.trim()) {
      alert('All 4 options and question text are required.');
      return;
    }
    setSavingNewQ(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${viewingQuestionsExam.id}/questions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_text: newQText.trim(),
          option_a: newOptA.trim(),
          option_b: newOptB.trim(),
          option_c: newOptC.trim(),
          option_d: newOptD.trim(),
          correct_option: newCorrect,
          explanation: newExplanation.trim() || null,
          bloom_level: newBloom
        })
      });
      if (res.ok) {
        const json = await res.json();
        setExamQuestions(prev => [...prev, json.question]);
        setIsAddingQuestion(false);
        setNewQText('');
        setNewOptA('');
        setNewOptB('');
        setNewOptC('');
        setNewOptD('');
        setNewExplanation('');
        fetchExams();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNewQ(false);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/questions/${questionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setExamQuestions(prev => prev.filter(q => q.id !== questionId));
        fetchExams();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Objective MCQ Examination</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-medium border border-blue-500/20">
              0-Credit & Standard Assessments
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Conduct secure multiple choice tests with PIN authentication, anti-cheat lockout tracking, and instantaneous grading.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors text-foreground"
          >
            <Download className="w-4 h-4 text-primary" />
            Download Excel Template
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create MCQ Exam
          </button>
        </div>
      </div>

      {/* Main Content: Exam Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Loading examination records...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/50 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
            <ListChecks className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-semibold text-foreground">No MCQ exams configured yet</h3>
            <p className="text-xs text-muted-foreground">
              Create an objective exam using a spreadsheet template or let AI extract questions from your course lecture slides and notes.
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create First MCQ Exam
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map(exam => (
            <div
              key={exam.id}
              className={`rounded-2xl border bg-card p-6 flex flex-col justify-between transition-all duration-150 ${exam.locked_attempts > 0 ? 'border-red-500/40 ring-1 ring-red-500/20' : 'border-border'
                }`}
            >
              <div className="space-y-4">
                {/* Header row: Class & Active toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
                    {exam.class_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(exam.id)}
                      className={`text-xs px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${exam.is_active
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                        }`}
                      title={exam.is_active ? 'Exam is Live' : 'Exam is Closed'}
                    >
                      {exam.is_active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                </div>

                {/* Subject Title */}
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight leading-snug">{exam.subject_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Duration: {exam.duration_minutes} mins | Total: {exam.total_marks} marks</p>
                </div>

                {/* Prominent Access PIN Box */}
                <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Access PIN</span>
                    <span className="text-xl font-black font-mono tracking-widest text-primary">{exam.access_pin}</span>
                  </div>
                  <button
                    onClick={() => handleCopyPin(exam.access_pin)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy PIN to share with students"
                  >
                    {copiedPin === exam.access_pin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-background border border-border">
                    <span className="text-muted-foreground block text-[11px]">Question Pool</span>
                    <span className="font-bold text-foreground font-mono">{exam.total_questions_in_pool} in bank</span>
                    <span className="text-[10px] text-muted-foreground block">({exam.questions_per_student} per student)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border border-border">
                    <span className="text-muted-foreground block text-[11px]">Submissions</span>
                    <span className="font-bold text-foreground font-mono">{exam.submitted_attempts} completed</span>
                    <span className="text-[10px] text-muted-foreground block">of {exam.total_attempts} attempts</span>
                  </div>
                </div>

                {/* Pool Insufficiency Alert */}
                {exam.total_questions_in_pool < exam.questions_per_student && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-2 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Question pool insufficient ({exam.total_questions_in_pool}/{exam.questions_per_student} required). Add more questions.</span>
                  </div>
                )}

                {/* Lockout Warning Banner if any student locked */}
                {exam.locked_attempts > 0 && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-between text-xs animate-pulse">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span className="font-semibold">{exam.locked_attempts} Student(s) Locked Out</span>
                    </div>
                  </div>
                )}

                {/* Grade Release Policy */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                  <span className="text-muted-foreground">Grade Release:</span>
                  <button
                    onClick={() => handleToggleRelease(exam.id)}
                    className={`px-2 py-0.5 rounded-md font-medium text-[11px] border ${exam.release_mode === 'immediate'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                  >
                    {exam.release_mode === 'immediate' ? 'Immediate Release' : 'Grades Withheld'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 mt-4 border-t border-border flex items-center gap-2">
                <Link
                  href={`/faculty/mcq/${exam.id}/monitor`}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg text-center transition-colors flex items-center justify-center gap-1.5 ${exam.locked_attempts > 0
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                >
                  <Users className="w-4 h-4" />
                  Live Monitor
                  {exam.locked_attempts > 0 && (
                    <span className="w-2 h-2 rounded-full bg-white ml-1"></span>
                  )}
                </Link>
                <button
                  onClick={() => handleOpenQuestionsDrawer(exam)}
                  className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="View Question Bank"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteExam(exam.id, exam.subject_name)}
                  className="p-2 rounded-lg border border-border hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Delete Exam"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE EXAM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Create Objective MCQ Exam</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure access credentials, randomized question pool, and grading policy.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExamSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {submitError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">Subject / Course Name *</label>
                  <input
                    type="text"
                    required
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    placeholder="e.g. Environmental Studies / Data Structures"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">Target Enrolled Class *</label>
                  <select
                    required
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Target Class</option>
                    {assignments.map(a => (
                      <option key={a.id} value={a.class_id}>
                        {a.class_name} ({a.subject_name || 'Assigned'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assessment Parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">Duration (Mins)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">Total Marks</label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={totalMarks}
                    onChange={e => setTotalMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">Questions / Student</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={questionsPerStudent}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setQuestionsPerStudent(val);
                      if (aiNumQuestions < val) {
                        setAiNumQuestions(val);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              {/* Access PIN Setup */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-foreground block">Exam Security PIN</label>
                    <p className="text-[11px] text-muted-foreground">Students must enter this 6-digit code to enter the examination.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoGen"
                      checked={autoGenPin}
                      onChange={e => setAutoGenPin(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    <label htmlFor="autoGen" className="text-xs text-foreground cursor-pointer">Auto-generate PIN</label>
                  </div>
                </div>
                {!autoGenPin && (
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Enter custom 6-digit code"
                    value={customPin}
                    onChange={e => setCustomPin(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground font-mono"
                  />
                )}
              </div>

              {/* Grade Release Policy */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground block">Evaluation & Result Release Policy</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setReleaseMode('immediate')}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${releaseMode === 'immediate'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Immediate Release</span>
                    </div>
                    <p className="text-[11px] mt-1 leading-relaxed">
                      Instant evaluation. Score, letter grade, and full response sheet with explanations are shown upon submission.
                    </p>
                  </div>

                  <div
                    onClick={() => setReleaseMode('withheld')}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${releaseMode === 'withheld'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-foreground">Withhold Grades</span>
                    </div>
                    <p className="text-[11px] mt-1 leading-relaxed">
                      Evaluated immediately, but scores and answers remain hidden from students until faculty explicitly releases them.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloom's Taxonomy Cognitive Distribution Toggle */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Bloom&apos;s Taxonomy Cognitive Levels</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-medium">Optional</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableBloomsTaxonomy(!enableBloomsTaxonomy)}
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                      enableBloomsTaxonomy
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {enableBloomsTaxonomy ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {enableBloomsTaxonomy
                    ? "Balances generated questions across Remember, Understand, Apply, and Analyze levels for institutional compliance."
                    : "Standard conceptual questions without taxonomy distribution constraints."}
                </p>
              </div>

              {/* Question Creation Methodology (Tabs) */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="text-xs font-semibold text-foreground block">Question Pool Creation Method</label>
                <div className="flex border-b border-border text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setCreationMethod('template')}
                    className={`pb-2 px-3 border-b-2 flex items-center gap-2 ${creationMethod === 'template'
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Option 1: Upload Excel/CSV Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMethod('ai')}
                    className={`pb-2 px-3 border-b-2 flex items-center gap-2 ${creationMethod === 'ai'
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Option 2: AI Multi-PPT / Notes Generation
                  </button>
                </div>

                {creationMethod === 'template' ? (
                  <div className="p-4 rounded-xl border border-dashed border-border bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Upload Spreadsheet (.xlsx, .csv)</span>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Sample Template
                      </button>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={e => setTemplateFile(e.target.files ? e.target.files[0] : null)}
                      className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The template includes columns for question text, 4 choices (A, B, C, D), correct option, and rationale. Questions will be randomized automatically per student.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Select Lecture Slides & Study Notes</span>
                        <span className="text-[11px] text-muted-foreground">Select multiple PPTX, PPT, PDF, or TXT files</span>
                      </div>
                      {aiFiles.length > 1 && (
                        <button
                          type="button"
                          onClick={handleEqualizeAiWeightages}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors flex items-center gap-1"
                        >
                          <Percent className="w-3 h-3 text-primary" />
                          Auto-distribute evenly
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      multiple
                      accept=".pptx,.ppt,.pdf,.txt"
                      onChange={e => handleAddAiFiles(e.target.files)}
                      className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />

                    {/* Multi-Files Weightage List */}
                    {aiFiles.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">Configured Files ({aiFiles.length}):</span>
                          <span className={`font-mono font-bold ${
                            aiFiles.reduce((s, f) => s + f.weightage, 0) === 100
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            Total: {aiFiles.reduce((s, f) => s + f.weightage, 0)}%
                          </span>
                        </div>

                        {/* Visual Proportional Distribution Bar */}
                        <div className="w-full h-2 rounded-md bg-muted overflow-hidden flex">
                          {aiFiles.map((item, idx) => {
                            const totalW = aiFiles.reduce((s, f) => s + f.weightage, 0) || 100;
                            const pct = (item.weightage / totalW) * 100;
                            const colors = ['bg-primary', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
                            return (
                              <div
                                key={item.id}
                                style={{ width: `${Math.max(2, pct)}%` }}
                                className={`h-full ${colors[idx % colors.length]}`}
                                title={`${item.file.name}: ${item.weightage}%`}
                              />
                            );
                          })}
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {aiFiles.map(item => {
                            const totalW = aiFiles.reduce((s, f) => s + f.weightage, 0) || 100;
                            const estCount = Math.max(1, Math.round(aiNumQuestions * (item.weightage / totalW)));
                            return (
                              <div key={item.id} className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-foreground block truncate">{item.file.name}</span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    {(item.file.size / 1024).toFixed(0)} KB • Allocation: ~{estCount} questions
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-muted-foreground font-medium">Weight:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={item.weightage}
                                    onChange={e => handleUpdateAiFileWeightage(item.id, Number(e.target.value))}
                                    className="w-14 px-2 py-1 text-xs rounded-md border border-border bg-background font-mono text-center font-bold"
                                  />
                                  <span className="font-mono text-xs">%</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAiFile(item.id)}
                                    className="p-1 rounded text-muted-foreground hover:text-red-500 transition-colors"
                                    title="Remove file"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Or paste lecture transcript/notes (Optional supplement):
                      </label>
                      <textarea
                        rows={2}
                        value={aiNotesText}
                        onChange={e => setAiNotesText(e.target.value)}
                        placeholder="Paste additional notes or textbook sections..."
                        className="w-full p-2 text-xs rounded-lg border border-border bg-background text-foreground"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-foreground font-medium">Total Questions to Generate:</label>
                        <input
                          type="number"
                          min={5}
                          max={50}
                          value={aiNumQuestions}
                          onChange={e => setAiNumQuestions(Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs rounded-md border border-border bg-background font-mono font-bold"
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Allocated across {aiFiles.length || 1} material(s)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? 'Creating Exam & Pool...' : 'Launch MCQ Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW QUESTIONS DRAWER */}
      {viewingQuestionsExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-xl h-[92vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Question Pool: {viewingQuestionsExam.subject_name}</h3>
                <p className="text-xs text-muted-foreground">{examQuestions.length} Total Questions Configured</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddingQuestion(!isAddingQuestion)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingQuestion ? 'Hide Form' : 'Add Question'}
                </button>
                <button
                  onClick={() => setViewingQuestionsExam(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              {isAddingQuestion && (
                <form onSubmit={handleSaveManualQuestion} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 mb-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Add Single Question</h4>
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">Question Stem *</label>
                    <textarea
                      required
                      rows={2}
                      value={newQText}
                      onChange={e => setNewQText(e.target.value)}
                      placeholder="e.g. Which of the following is an idempotent HTTP method?"
                      className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Option A *</label>
                      <input
                        type="text"
                        required
                        value={newOptA}
                        onChange={e => setNewOptA(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Option B *</label>
                      <input
                        type="text"
                        required
                        value={newOptB}
                        onChange={e => setNewOptB(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Option C *</label>
                      <input
                        type="text"
                        required
                        value={newOptC}
                        onChange={e => setNewOptC(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Option D *</label>
                      <input
                        type="text"
                        required
                        value={newOptD}
                        onChange={e => setNewOptD(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-foreground block mb-0.5">Correct Option *</label>
                      <select
                        value={newCorrect}
                        onChange={e => setNewCorrect(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background font-mono font-bold"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-0.5">Bloom Taxonomy</label>
                      <select
                        value={newBloom}
                        onChange={e => setNewBloom(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
                      >
                        <option value="Remember">Remember</option>
                        <option value="Understand">Understand</option>
                        <option value="Apply">Apply</option>
                        <option value="Analyze">Analyze</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">Explanation / Rationale (Optional)</label>
                    <input
                      type="text"
                      value={newExplanation}
                      onChange={e => setNewExplanation(e.target.value)}
                      placeholder="Brief rationale for the answer key..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingQuestion(false)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingNewQ}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                    >
                      {savingNewQ && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {savingNewQ ? 'Saving...' : 'Save Question'}
                    </button>
                  </div>
                </form>
              )}
              {loadingQuestions ? (
                <div className="py-20 flex justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : examQuestions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No questions found in this exam pool.</p>
              ) : (
                examQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl border border-border bg-background space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-foreground block">
                          Q{idx + 1}. {q.question_text}
                        </span>
                        {q.bloom_level && q.bloom_level !== 'Standard' && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-medium border border-primary/20">
                            Bloom: {q.bloom_level}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-1 shrink-0"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`p-2 rounded-lg border ${q.correct_option === 'A' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold' : 'border-border text-muted-foreground'}`}>
                        A) {q.option_a}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correct_option === 'B' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold' : 'border-border text-muted-foreground'}`}>
                        B) {q.option_b}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correct_option === 'C' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold' : 'border-border text-muted-foreground'}`}>
                        C) {q.option_c}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correct_option === 'D' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold' : 'border-border text-muted-foreground'}`}>
                        D) {q.option_d}
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                        <span className="font-semibold text-foreground">Rationale: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

