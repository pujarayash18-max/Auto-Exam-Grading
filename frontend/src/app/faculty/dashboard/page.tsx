'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface GradingSchemeTier {
  grade_label: string;
  min_marks: number;
  max_marks: number;
  min_pct: number;
  max_pct: number;
}

const DEFAULT_GRADING_TIERS: GradingSchemeTier[] = [
  { grade_label: "O", min_marks: 90, max_marks: 100, min_pct: 90, max_pct: 100 },
  { grade_label: "A", min_marks: 80, max_marks: 90, min_pct: 80, max_pct: 90 },
  { grade_label: "B", min_marks: 70, max_marks: 80, min_pct: 70, max_pct: 80 },
  { grade_label: "C", min_marks: 60, max_marks: 70, min_pct: 60, max_pct: 70 },
  { grade_label: "F", min_marks: 0, max_marks: 60, min_pct: 0, max_pct: 60 },
];

const computeScaledGradingSchemes = (schemes: GradingSchemeTier[], newTotal: number): GradingSchemeTier[] => {
  if (isNaN(newTotal) || newTotal <= 0) return schemes;

  return schemes.map((g, idx) => {
    let minPct = typeof g.min_pct === 'number' ? g.min_pct : 0;
    let maxPct = typeof g.max_pct === 'number' ? g.max_pct : 100;

    let calculatedMax: number;
    if (idx === 0 || maxPct >= 100) {
      calculatedMax = newTotal;
      maxPct = 100;
    } else {
      calculatedMax = Math.round((maxPct / 100) * newTotal * 10) / 10;
      if (calculatedMax > newTotal) calculatedMax = newTotal;
    }

    let calculatedMin: number;
    if (idx === schemes.length - 1 || minPct <= 0) {
      calculatedMin = 0;
      minPct = 0;
    } else {
      calculatedMin = Math.round((minPct / 100) * newTotal * 10) / 10;
      if (calculatedMin > calculatedMax) calculatedMin = calculatedMax;
    }

    return {
      grade_label: g.grade_label,
      min_marks: calculatedMin,
      max_marks: calculatedMax,
      min_pct: minPct,
      max_pct: maxPct
    };
  });
};

const PALETTE_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-slate-600',
  'bg-teal-500'
];

export default function FacultyDashboard() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [newlyScheduledExamId, setNewlyScheduledExamId] = useState<number | null>(null);

  // Form states for Schedule
  const [vivaTitle, setVivaTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [timer, setTimer] = useState('2.0');
  const [questionsCount, setQuestionsCount] = useState('5');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [location, setLocation] = useState('');
  const [totalMarks, setTotalMarks] = useState('100');
  const [bloomsTaxonomy, setBloomsTaxonomy] = useState(false);
  const [examModeSchedule, setExamModeSchedule] = useState('ppt_only');
  const [gradingSchemes, setGradingSchemes] = useState<GradingSchemeTier[]>(DEFAULT_GRADING_TIERS.map(t => ({ ...t })));
  const [scheduleError, setScheduleError] = useState('');
  const scheduleFormRef = useRef<HTMLFormElement>(null);

  // Reschedule Modal States
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleExamId, setRescheduleExamId] = useState<number | null>(null);
  const [rescheduleTitle, setRescheduleTitle] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleLocation, setRescheduleLocation] = useState('');
  const [rescheduleQuestionsCount, setRescheduleQuestionsCount] = useState('5');
  const [rescheduleTimer, setRescheduleTimer] = useState('2.0');
  const [rescheduleTotalMarks, setRescheduleTotalMarks] = useState('100');
  const [rescheduleBloomsTaxonomy, setRescheduleBloomsTaxonomy] = useState(false);
  const [rescheduleExamMode, setRescheduleExamMode] = useState('ppt_only');
  const [rescheduleGradingSchemes, setRescheduleGradingSchemes] = useState<GradingSchemeTier[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<number | null>(null);

  // Upload & Question Generation states
  const [uploadExamMode, setUploadExamMode] = useState('ppt_only');
  const [file, setFile] = useState<File | null>(null);
  const [fileWeightage, setFileWeightage] = useState('20');
  const [totalQuestionsToGen, setTotalQuestionsToGen] = useState('10');
  const [generating, setGenerating] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

  // Preview Questions states
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [previewExamId, setPreviewExamId] = useState<number | null>(null);
  const [previewExamSubject, setPreviewExamSubject] = useState('');
  const [savingQuestions, setSavingQuestions] = useState(false);

  // Proportional Grade Scaling when Total Marks changes (Deterministic percentage based)
  const handleTotalMarksChange = (val: string) => {
    setTotalMarks(val);
    const newTotal = parseFloat(val);
    if (!isNaN(newTotal) && newTotal > 0) {
      setGradingSchemes(prevSchemes => computeScaledGradingSchemes(prevSchemes, newTotal));
    }
  };

  const handleGradeChange = (index: number, field: 'grade_label' | 'min_marks' | 'max_marks', val: any) => {
    const tot = parseFloat(totalMarks) || 100;
    const updated = [...gradingSchemes];
    if (field === 'grade_label') {
      updated[index].grade_label = val;
    } else {
      const num = parseFloat(val) || 0;
      updated[index][field] = num;
      if (field === 'min_marks') {
        updated[index].min_pct = tot > 0 ? (num / tot) * 100 : 0;
      } else if (field === 'max_marks') {
        updated[index].max_pct = tot > 0 ? (num / tot) * 100 : 100;
      }
    }
    setGradingSchemes(updated);
  };

  const resetGradingSchemesToStandard = () => {
    const tot = parseFloat(totalMarks) || 100;
    setGradingSchemes(computeScaledGradingSchemes(DEFAULT_GRADING_TIERS, tot));
  };

  const fetchMaterials = async (examId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${examId}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
        // Compute smart next default weightage
        const totalW = data.reduce((sum: number, m: any) => sum + (Number(m.weightage) || 0), 0);
        const rem = Math.max(5, 100 - totalW);
        setFileWeightage(rem > 0 ? String(Math.round(rem)) : '20');
      }
    } catch (err) {
      console.error("Failed to fetch materials", err);
    }
  };

  const handleExamModeChangeInUploadModal = async (newMode: string) => {
    setUploadExamMode(newMode);
    if (!newlyScheduledExamId) return;
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`http://localhost:8000/api/v1/faculty/exams/${newlyScheduledExamId}/exam-type`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exam_type: newMode })
      });
      setExams(prev => prev.map(e => e.id === newlyScheduledExamId ? { ...e, exam_type: newMode } : e));
    } catch (err) {
      console.error("Failed to update exam type", err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      const [examsRes, assignmentsRes] = await Promise.all([
        fetch('http://localhost:8000/api/v1/faculty/exams', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:8000/api/v1/faculty/assignments', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (examsRes.ok) setExams(await examsRes.json());
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const openScheduleModal = (class_id: number, subjectName: string) => {
    setSelectedClassId(class_id);
    setSubject(subjectName);
    setVivaTitle(`${subjectName} Oral Viva`);
    
    // Auto-fill sensible default dates and times so form never fails on empty fields
    const todayStr = new Date().toISOString().split('T')[0];
    setExamDate(todayStr);
    setExamTime('10:00');
    setLocation('Room 402 / Online');
    setQuestionsCount('5');
    setTimer('2.0');
    setTotalMarks('100');
    setBloomsTaxonomy(false);
    setExamModeSchedule('ppt_only');
    setGradingSchemes(DEFAULT_GRADING_TIERS.map(t => ({ ...t })));
    setScheduleError('');
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError('');
    
    const finalTitle = vivaTitle.trim() || `${subject || 'Oral Viva'} Exam`;
    
    // Fallback date and time if empty
    let effectiveDate = examDate;
    if (!effectiveDate) {
      effectiveDate = new Date().toISOString().split('T')[0];
      setExamDate(effectiveDate);
    }
    let effectiveTime = examTime || '10:00';
    if (!examTime) {
      setExamTime(effectiveTime);
    }
    
    const effectiveLocation = location.trim() || 'Room 402 / Online';

    let classIdToUse = selectedClassId;
    if (!classIdToUse && assignments && assignments.length > 0) {
      classIdToUse = assignments[0].class_id;
      setSelectedClassId(classIdToUse);
    }

    if (!classIdToUse) {
      setScheduleError("Please select a class assignment before continuing.");
      return;
    }

    let isoDate: string | null = null;
    try {
      const d = new Date(`${effectiveDate}T${effectiveTime}`);
      if (!isNaN(d.getTime())) {
        isoDate = d.toISOString();
      }
    } catch (_) {}

    const payload = {
      subject_name: finalTitle,
      class_id: classIdToUse,
      scheduled_date: isoDate,
      location: effectiveLocation,
      questions_per_student: parseInt(questionsCount) || 5,
      total_marks: parseFloat(totalMarks) || 100,
      timer_per_question_minutes: parseFloat(timer) || 2.0,
      blooms_taxonomy: bloomsTaxonomy,
      exam_type: examModeSchedule,
      grading_schemes: gradingSchemes.map(g => ({
        grade_label: g.grade_label,
        min_marks: parseFloat(g.min_marks as any) || 0,
        max_marks: parseFloat(g.max_marks as any) || 0
      }))
    };

    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert("Session expired. Please log in again.");
        router.push('/auth/login');
        return;
      }

      const res = await fetch('http://localhost:8000/api/v1/faculty/exams', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to schedule exam");
      }
      const data = await res.json();
      
      setNewlyScheduledExamId(data.exam_id);
      setUploadExamMode(examModeSchedule);
      setIsScheduleModalOpen(false);
      setMaterials([]); // reset materials
      setFile(null);
      setTotalQuestionsToGen(String(Math.max((parseInt(questionsCount) || 5) * 2, 10)));
      setFileWeightage('20');
      setIsUploadModalOpen(true);
      fetchDashboardData();
      fetchMaterials(data.exam_id);
    } catch (err: any) {
      console.error("Schedule error:", err);
      setScheduleError(err.message || "Failed to schedule exam");
      scheduleFormRef.current?.scrollTo({ top: scheduleFormRef.current.scrollHeight, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !newlyScheduledExamId) return;
    setGenerating(true);
    
    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const materialType = isPdf 
        ? (uploadExamMode === 'qa_pdf' ? 'pdf_answers' : 'pdf_questions') 
        : 'ppt';
      formData.append('material_type', materialType);
      formData.append('weightage', fileWeightage || '20');
      formData.append('exam_type', uploadExamMode);
      
      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${newlyScheduledExamId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      await fetchMaterials(newlyScheduledExamId);
      setFile(null);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateMaterialWeightage = async (materialId: number, newWeight: number) => {
    const clamped = Math.max(0, Math.min(100, newWeight));
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, weightage: clamped } : m));
    if (!newlyScheduledExamId) return;
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`http://localhost:8000/api/v1/faculty/exams/${newlyScheduledExamId}/materials/${materialId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ weightage: clamped })
      });
    } catch (err) {
      console.error("Failed to update weightage", err);
    }
  };

  const handleEqualizeWeightages = async () => {
    if (!materials.length || !newlyScheduledExamId) return;
    const count = materials.length;
    const equalShare = Math.round((100 / count) * 10) / 10;
    
    const updated = materials.map(m => ({ ...m, weightage: equalShare }));
    setMaterials(updated);

    try {
      const token = localStorage.getItem('access_token');
      await Promise.all(
        updated.map(m => 
          fetch(`http://localhost:8000/api/v1/faculty/exams/${newlyScheduledExamId}/materials/${m.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ weightage: equalShare })
          })
        )
      );
    } catch (err) {
      console.error("Failed to equalize weightages", err);
    }
  };

  const handleDeleteMaterial = async (materialId: number) => {
    if (!newlyScheduledExamId) return;
    if (!confirm("Are you sure you want to delete this material?")) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${newlyScheduledExamId}/materials/${materialId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Delete failed");
      
      fetchMaterials(newlyScheduledExamId);
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  // Helper to compute question allocation for preview
  const getMaterialQuestionAllocations = () => {
    if (!materials.length) return [];
    const target = parseInt(totalQuestionsToGen) || 10;
    const validMaterials = materials.filter(m => Number(m.weightage) > 0);
    const matsToUse = validMaterials.length > 0 ? validMaterials : materials;
    const totalW = matsToUse.reduce((s, m) => s + (Number(m.weightage) || 0), 0) || 100;
    
    let allocated = 0;
    return matsToUse.map((m, idx) => {
      let count = 0;
      if (idx === matsToUse.length - 1) {
        count = Math.max(1, target - allocated);
      } else {
        const share = (Number(m.weightage) || 0) / totalW;
        count = Math.max(1, Math.round(target * share));
        allocated += count;
      }
      return {
        ...m,
        allocatedCount: count,
        sharePct: Math.round(((Number(m.weightage) || 0) / totalW) * 100)
      };
    });
  };

  const handleGenerateQuestions = async () => {
    if (!newlyScheduledExamId) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem('access_token');
      const numQuestions = parseInt(totalQuestionsToGen) || 10;
      const weightageMap: Record<number, number> = {};
      materials.forEach(m => {
        weightageMap[m.id] = parseFloat(m.weightage) || 0;
      });

      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${newlyScheduledExamId}/generate-questions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          total_questions: numQuestions,
          materials_weightages: weightageMap,
          exam_type: uploadExamMode
        })
      });
      if (!res.ok) throw new Error("Failed to generate questions");
      const data = await res.json();
      
      // Open Question Bank Preview modal for faculty to review & edit
      setPreviewExamId(newlyScheduledExamId);
      const currentExam = exams.find(e => e.id === newlyScheduledExamId);
      setPreviewExamSubject(currentExam ? currentExam.subject_name : (vivaTitle || subject || 'Viva Exam'));
      setPreviewQuestions(data.questions || []);
      setIsUploadModalOpen(false);
      setIsPreviewModalOpen(true);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert("Question generation failed. Check if materials have enough content.");
    } finally {
      setGenerating(false);
    }
  };

  const openQuestionsPreview = async (examId: number, subjectName: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${examId}/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewExamId(examId);
        setPreviewExamSubject(subjectName);
        setPreviewQuestions(data);
        setIsPreviewModalOpen(true);
      } else {
        alert("Could not load questions for this viva.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load questions");
    }
  };

  const handleSaveQuestions = async () => {
    if (!previewExamId) return;
    setSavingQuestions(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${previewExamId}/questions`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questions: previewQuestions
        })
      });
      if (!res.ok) throw new Error("Failed to save questions");
      alert("Question bank saved successfully!");
      setIsPreviewModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert("Failed to save questions");
    } finally {
      setSavingQuestions(false);
    }
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...previewQuestions];
    updated[index].question_text = text;
    setPreviewQuestions(updated);
  };

  const updateExpectedAnswer = (index: number, answer: string) => {
    const updated = [...previewQuestions];
    updated[index].expected_answer = answer;
    setPreviewQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    setPreviewQuestions(previewQuestions.filter((_, i) => i !== index));
  };

  const addCustomQuestion = () => {
    setPreviewQuestions([
      ...previewQuestions,
      {
        question_text: bloomsTaxonomy ? "[Analyze] " : "",
        expected_answer: ""
      }
    ]);
  };

  const getBloomTag = (text: string) => {
    if (!text) return null;
    const match = text.match(/^\[(Remember|Understand|Apply|Analyze|Evaluate|Create)\]/i);
    if (!match) return null;
    const level = match[1].toLowerCase();
    const colors: Record<string, string> = {
      remember: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      understand: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      apply: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      analyze: "bg-teal-500/20 text-teal-300 border-teal-500/40",
      evaluate: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      create: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    };
    return {
      level: match[1],
      colorClass: colors[level] || "bg-blue-500/20 text-blue-300 border-blue-500/40"
    };
  };

  const openRescheduleModal = (e: any) => {
    setRescheduleExamId(e.id);
    setRescheduleTitle(e.subject_name || '');
    setRescheduleExamMode(e.exam_type || 'ppt_only');
    
    if (e.scheduled_date) {
      try {
        const d = new Date(e.scheduled_date);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setRescheduleDate(`${year}-${month}-${day}`);
          
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          setRescheduleTime(`${hours}:${minutes}`);
        } else {
          setRescheduleDate('');
          setRescheduleTime('');
        }
      } catch (err) {
        setRescheduleDate('');
        setRescheduleTime('');
      }
    } else {
      setRescheduleDate('');
      setRescheduleTime('');
    }

    setRescheduleLocation(e.location || '');
    setRescheduleQuestionsCount(String(e.questions_per_student || 5));
    setRescheduleTimer(String(e.timer_per_question_minutes || 2.0));
    setRescheduleTotalMarks(String(e.total_marks || 100));
    setRescheduleBloomsTaxonomy(Boolean(e.blooms_taxonomy));

    if (e.grading_schemes && e.grading_schemes.length > 0) {
      const tot = Number(e.total_marks) || 100;
      setRescheduleGradingSchemes(
        e.grading_schemes.map((g: any, idx: number) => {
          const minM = Number(g.min_marks);
          const maxM = Number(g.max_marks);
          return {
            grade_label: g.grade_label,
            min_marks: minM,
            max_marks: maxM,
            min_pct: tot > 0 ? Math.round((minM / tot) * 1000) / 10 : (DEFAULT_GRADING_TIERS[idx]?.min_pct ?? 0),
            max_pct: tot > 0 ? Math.round((maxM / tot) * 1000) / 10 : (DEFAULT_GRADING_TIERS[idx]?.max_pct ?? 100)
          };
        })
      );
    } else {
      const tot = Number(e.total_marks) || 100;
      setRescheduleGradingSchemes(computeScaledGradingSchemes(DEFAULT_GRADING_TIERS, tot));
    }

    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleTotalMarksChange = (val: string) => {
    setRescheduleTotalMarks(val);
    const newTotal = parseFloat(val);
    if (!isNaN(newTotal) && newTotal > 0) {
      setRescheduleGradingSchemes(prevSchemes => computeScaledGradingSchemes(prevSchemes, newTotal));
    }
  };

  const handleRescheduleGradeChange = (index: number, field: 'grade_label' | 'min_marks' | 'max_marks', val: any) => {
    const tot = parseFloat(rescheduleTotalMarks) || 100;
    const updated = [...rescheduleGradingSchemes];
    if (field === 'grade_label') {
      updated[index].grade_label = val;
    } else {
      const num = parseFloat(val) || 0;
      updated[index][field] = num;
      if (field === 'min_marks') {
        updated[index].min_pct = tot > 0 ? (num / tot) * 100 : 0;
      } else if (field === 'max_marks') {
        updated[index].max_pct = tot > 0 ? (num / tot) * 100 : 100;
      }
    }
    setRescheduleGradingSchemes(updated);
  };

  const resetRescheduleGradingSchemesToStandard = () => {
    const tot = parseFloat(rescheduleTotalMarks) || 100;
    setRescheduleGradingSchemes(computeScaledGradingSchemes(DEFAULT_GRADING_TIERS, tot));
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleExamId) return;
    setRescheduling(true);

    try {
      const token = localStorage.getItem('access_token');
      let isoDate: string | null = null;
      if (rescheduleDate) {
        const timePart = rescheduleTime || '09:00';
        isoDate = new Date(`${rescheduleDate}T${timePart}`).toISOString();
      }

      const payload = {
        subject_name: rescheduleTitle.trim(),
        scheduled_date: isoDate,
        location: rescheduleLocation.trim(),
        questions_per_student: parseInt(rescheduleQuestionsCount) || 5,
        total_marks: parseFloat(rescheduleTotalMarks) || 100,
        timer_per_question_minutes: parseFloat(rescheduleTimer) || 1.0,
        blooms_taxonomy: rescheduleBloomsTaxonomy,
        exam_type: rescheduleExamMode,
        grading_schemes: rescheduleGradingSchemes.map(g => ({
          grade_label: g.grade_label,
          min_marks: parseFloat(g.min_marks as any) || 0,
          max_marks: parseFloat(g.max_marks as any) || 0
        }))
      };

      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${rescheduleExamId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to reschedule exam");
      }

      alert("Exam rescheduled successfully!");
      setIsRescheduleModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error rescheduling exam");
    } finally {
      setRescheduling(false);
    }
  };

  const handleDeleteExam = async (examId: number, subjectName: string) => {
    if (!confirm(`Are you sure you want to delete the scheduled viva "${subjectName}"?\n\nThis will permanently delete this exam, including all uploaded materials, questions, and scheduled runs.`)) {
      return;
    }

    setDeletingExamId(examId);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/faculty/exams/${examId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to delete exam");
      }

      alert("Exam deleted successfully!");
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete exam");
    } finally {
      setDeletingExamId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Overview
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage your assigned classes and schedule upcoming vivas.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assignments */}
          <div className="glass-panel p-6 rounded-2xl border border-border bg-card/50">
            <h3 className="text-xl font-bold mb-4 text-foreground">My Assigned Subjects</h3>
            <div className="space-y-4">
              {assignments.map(assign => (
                <div key={assign.class_id} className="p-5 bg-background rounded-xl border border-border flex items-center justify-between hover:border-primary/50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-lg text-foreground">{assign.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">Class ID: {assign.class_id}</p>
                  </div>
                  <button 
                    onClick={() => openScheduleModal(assign.class_id, assign.subject_name)}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors"
                  >
                    Schedule New Viva
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Upcoming Exams */}
          <div className="glass-panel p-6 rounded-2xl border border-border bg-card/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-foreground">Upcoming Scheduled Vivas</h3>
              <span className="text-xs px-2.5 py-1 bg-muted rounded-full text-muted-foreground font-medium border border-border">
                {exams.length} {exams.length === 1 ? 'Viva' : 'Vivas'}
              </span>
            </div>
            <div className="space-y-4">
              {exams.map(e => (
                <div key={e.id} className="p-5 bg-background rounded-xl border border-border hover:border-primary/30 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground text-base">{e.subject_name}</h4>
                        {e.blooms_taxonomy && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-md flex items-center gap-1">
                            <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            Bloom&apos;s
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-accent text-accent-foreground border border-border rounded-md">
                          {e.total_marks || 100} Marks
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                          {e.exam_type === 'both' ? 'Mode: Questions + PPT' : e.exam_type === 'qa_pdf' ? 'Mode: Q&A PDF' : 'Mode: Only PPT'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-foreground">{e.location || 'Location Not Set'}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-foreground">{e.timer_per_question_minutes || 2}m/Q ({e.questions_per_student || 5} Qs)</span>
                        </span>
                        {e.scheduled_date && (
                          <span className="flex items-center gap-1.5 text-primary font-medium">
                            <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {new Date(e.scheduled_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                      <button 
                        onClick={() => openRescheduleModal(e)}
                        className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-lg transition-colors flex items-center gap-1.5 font-medium shadow-sm"
                        title="Reschedule or edit viva settings"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span>Reschedule</span>
                      </button>

                      <button 
                        onClick={() => {
                          setNewlyScheduledExamId(e.id);
                          setUploadExamMode(e.exam_type || 'ppt_only');
                          fetchMaterials(e.id);
                          setIsUploadModalOpen(true);
                        }}
                        className="text-xs px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg transition-colors flex items-center gap-1 font-medium"
                      >
                        <span>Materials</span>
                      </button>

                      <button 
                        onClick={() => openQuestionsPreview(e.id, e.subject_name)}
                        className="text-xs px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-colors flex items-center gap-1 font-medium"
                      >
                        <span>Preview Q&A</span>
                      </button>

                      <button 
                        disabled={deletingExamId === e.id}
                        onClick={() => handleDeleteExam(e.id, e.subject_name)}
                        className="text-xs px-2.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-lg transition-colors flex items-center gap-1 font-medium disabled:opacity-50"
                        title="Delete this scheduled viva"
                      >
                        {deletingExamId === e.id ? (
                          <span className="w-3 h-3 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin"></span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {exams.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No upcoming vivas scheduled.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-foreground">Schedule New Viva</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure viva parameters, total marks, and cognitive taxonomy.</p>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form noValidate onSubmit={handleScheduleSubmit} ref={scheduleFormRef} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Viva Title / Name</label>
                  <input 
                    type="text" 
                    value={vivaTitle} 
                    onChange={e => setVivaTitle(e.target.value)} 
                    placeholder="e.g. Midterm Oral Viva" 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Subject</label>
                  <input 
                    type="text" 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Date</label>
                  <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 dark:[&::-webkit-calendar-picker-indicator]:filter dark:[&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Time</label>
                  <input type="time" value={examTime} onChange={e => setExamTime(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 dark:[&::-webkit-calendar-picker-indicator]:filter dark:[&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Location</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50" placeholder="e.g. Lab 402 / Online" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Questions per Student</label>
                  <input type="number" value={questionsCount} onChange={e => setQuestionsCount(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Mins per Question</label>
                  <input type="number" step="0.5" value={timer} onChange={e => setTimer(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center justify-between">
                    <span>Total Marks</span>
                    <span className="text-xs text-primary font-normal">Auto-scales grades</span>
                  </label>
                  <input 
                    type="number" 
                    value={totalMarks} 
                    onChange={e => handleTotalMarksChange(e.target.value)} 
                    className="w-full bg-background border border-primary/40 rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50" 
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Type of Exam (Mode)</label>
                  <select
                    value={examModeSchedule}
                    onChange={e => setExamModeSchedule(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/50 font-medium"
                  >
                    <option value="ppt_only">Only PPT (Questions generated from PPT, answers expected from PPT)</option>
                    <option value="both">Questions Uploaded along with PPT (Only answers expected from PPT)</option>
                    <option value="qa_pdf">Question and Answer PDF (with or without PPT)</option>
                  </select>
                </div>
              </div>

              {/* Bloom's Taxonomy Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold text-sm">Bloom&apos;s Taxonomy</span>
                      {bloomsTaxonomy && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full animate-pulse">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generate questions structured across cognitive levels (Remember, Understand, Apply, Analyze, Evaluate, Create).
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                  <input 
                    type="checkbox" 
                    checked={bloomsTaxonomy} 
                    onChange={e => setBloomsTaxonomy(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-md"></div>
                </label>
              </div>

              {/* Grading Scheme */}
              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="text-foreground font-medium">Grading Scheme</h4>
                    <p className="text-xs text-muted-foreground">Thresholds dynamically calculate based on Total Marks ({totalMarks})</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={resetGradingSchemesToStandard}
                      className="text-xs bg-background hover:bg-muted text-primary border border-primary/30 px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                      title="Reset to standard 90/80/70/60% tiers"
                    >
                      <span>↺ Standard (%)</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const tot = parseFloat(totalMarks) || 100;
                        setGradingSchemes([
                          ...gradingSchemes, 
                          { grade_label: '', min_marks: 0, max_marks: tot, min_pct: 0, max_pct: 100 }
                        ]);
                      }}
                      className="text-xs bg-muted hover:bg-muted/80 text-foreground px-2.5 py-1.5 rounded-lg transition-colors font-medium border border-border"
                    >
                      + Add Grade
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {gradingSchemes.map((scheme, idx) => {
                    const minP = Math.round(scheme.min_pct);
                    const maxP = Math.round(scheme.max_pct);
                    return (
                      <div key={idx} className="flex gap-2.5 items-center">
                        <input 
                          placeholder="Grade" type="text" value={scheme.grade_label} 
                          onChange={e => handleGradeChange(idx, 'grade_label', e.target.value)} 
                          className="w-20 bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground font-semibold text-center uppercase focus:ring-2 focus:ring-primary/50" 
                        />
                        <input 
                          placeholder="Min" type="number" step="0.1" min="0" max={totalMarks} value={scheme.min_marks} 
                          onChange={e => handleGradeChange(idx, 'min_marks', e.target.value)} 
                          className="w-20 bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground text-center focus:ring-2 focus:ring-primary/50" 
                        />
                        <span className="text-muted-foreground text-xs">-</span>
                        <input 
                          placeholder="Max" type="number" step="0.1" min="0" max={totalMarks} value={scheme.max_marks} 
                          onChange={e => handleGradeChange(idx, 'max_marks', e.target.value)} 
                          className="w-20 bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground text-center focus:ring-2 focus:ring-primary/50" 
                        />
                        <span className="text-[11px] text-muted-foreground bg-muted border border-border px-2 py-1 rounded-md shrink-0 font-mono">
                          {minP}% - {maxP}%
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setGradingSchemes(gradingSchemes.filter((_, i) => i !== idx))}
                          className="text-destructive hover:text-destructive/80 p-1.5 ml-auto text-sm"
                          title="Remove grade"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {scheduleError && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-destructive shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="font-medium">{scheduleError}</span>
                  </div>
                  <button type="button" onClick={() => setScheduleError('')} className="text-destructive hover:text-foreground">✕</button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="px-5 py-2.5 rounded-xl text-muted-foreground hover:text-foreground font-medium">Cancel</button>
                <button disabled={loading} type="submit" className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {loading && <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>}
                  <span>{loading ? 'Saving...' : 'Next: Upload Notes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Materials & Viva Weightages Modal */}
      {isUploadModalOpen && (() => {
        const totalWeightSum = materials.reduce((s, m) => s + (Number(m.weightage) || 0), 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
              <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0 bg-slate-900/90">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">Study Materials & Viva Weightages</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                      {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Upload PPT slides/notes, configure each file&apos;s question weightage (%), and generate viva questions.
                  </p>
                </div>
                <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">✕</button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto grow custom-scrollbar">
                {/* Type of Exam (Mode) Selector */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-white">
                          Type of Exam (Mode)
                        </label>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                          Question Sourcing
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Choose how questions and benchmarks will be generated for this viva.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: 'ppt_only',
                        title: 'Only PPT',
                        desc: 'AI generates questions directly from lecture slides',
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        )
                      },
                      {
                        id: 'both',
                        title: 'Questions + PPT',
                        desc: 'Upload questions list alongside PPT lecture slides',
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )
                      },
                      {
                        id: 'qa_pdf',
                        title: 'Q&A PDF',
                        desc: 'Pre-prepared Question & Answer benchmark PDF',
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        )
                      }
                    ].map(opt => {
                      const selected = uploadExamMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleExamModeChangeInUploadModal(opt.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                            selected 
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm shadow-blue-500/20' 
                              : 'bg-white/5 border-white/10 hover:border-white/20 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={selected ? 'text-blue-400' : 'text-gray-400'}>{opt.icon}</span>
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              selected ? 'border-blue-500 bg-blue-500' : 'border-gray-500'
                            }`}>
                              {selected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">{opt.title}</p>
                            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1. Uploaded Materials Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                      Uploaded Lecture Files & Weightages
                    </h4>
                  </div>

                  {materials.length === 0 ? (
                    <div className="text-sm text-gray-400 bg-white/5 rounded-xl p-6 text-center border border-white/10 space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mx-auto">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      </div>
                      <p className="text-sm font-semibold text-white">No study materials uploaded yet</p>
                      <p className="text-xs text-gray-400">
                        {uploadExamMode === 'qa_pdf'
                          ? 'Upload your Question & Answer reference PDF to begin.'
                          : uploadExamMode === 'both'
                          ? 'Upload your PPT slides and questions list files to begin.'
                          : 'Upload your PowerPoint (.ppt, .pptx) or PDF lecture slides below to begin.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Weightage Distribution Visual Bar */}
                      <div className="bg-slate-800/80 p-4 rounded-xl border border-white/10 space-y-3">
                        <div className="flex flex-wrap justify-between items-center text-xs gap-2">
                          <span className="font-semibold text-gray-300">Weightage Distribution across Files:</span>
                          <div className="flex items-center gap-2">
                            {Math.abs(totalWeightSum - 100) < 0.1 ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1">
                                ✓ 100% Balanced
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1">
                                ⚡ Total: {totalWeightSum.toFixed(0)}% (Normalized to 100%)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={handleEqualizeWeightages}
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-gray-200 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1"
                              title="Distribute 100% evenly across all uploaded files"
                            >
                              <span>⚡ Equalize Evenly</span>
                            </button>
                          </div>
                        </div>

                        {/* Segmented Progress Bar */}
                        <div className="h-3 w-full bg-slate-700/60 rounded-full overflow-hidden flex shadow-inner">
                          {materials.map((m, idx) => {
                            const pct = totalWeightSum > 0 ? (Number(m.weightage || 0) / totalWeightSum) * 100 : 100 / materials.length;
                            const color = PALETTE_COLORS[idx % PALETTE_COLORS.length];
                            return (
                              <div
                                key={m.id}
                                style={{ width: `${pct}%` }}
                                className={`${color} transition-all duration-300 h-full relative cursor-pointer`}
                                title={`${m.filename}: ${Number(m.weightage || 0)}% (Represents ${Math.round(pct)}% of question bank)`}
                              />
                            );
                          })}
                        </div>

                        {/* Mini Legend */}
                        <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                          {materials.map((m, idx) => (
                            <div key={m.id} className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded-md border border-white/5">
                              <span className={`w-2 h-2 rounded-full ${PALETTE_COLORS[idx % PALETTE_COLORS.length]}`} />
                              <span className="truncate max-w-[120px] text-gray-300" title={m.filename}>{m.filename}</span>
                              <span className="text-white font-bold">{Number(m.weightage || 0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Materials Cards */}
                      <div className="space-y-2.5">
                        {materials.map((m, idx) => (
                          <div key={m.id} className="flex flex-wrap sm:flex-nowrap justify-between items-center p-3.5 bg-white/5 rounded-xl border border-white/10 gap-3 hover:border-white/20 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 font-bold text-xs ${PALETTE_COLORS[idx % PALETTE_COLORS.length]}`}>
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate" title={m.filename}>{m.filename}</p>
                                <p className="text-[11px] text-gray-400 capitalize">{m.material_type || 'ppt'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                              <div className="flex items-center gap-1.5 bg-slate-800 border border-white/15 rounded-lg px-2.5 py-1">
                                <span className="text-xs text-gray-400">Weightage:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={m.weightage ?? 20}
                                  onChange={e => handleUpdateMaterialWeightage(m.id, parseFloat(e.target.value) || 0)}
                                  className="w-12 bg-transparent text-center text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                                />
                                <span className="text-xs font-semibold text-blue-400">%</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteMaterial(m.id)}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete this file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Upload New File with Weightage */}
                <div className="pt-2 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                    Upload New Lecture File (PPT / PDF)
                  </h4>
                  <form onSubmit={handleUploadSubmit} className="space-y-4">
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                      <input required type="file" accept=".ppt,.pptx,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      {file ? (
                        <p className="text-blue-400 font-semibold text-sm">{file.name}</p>
                      ) : (
                        <>
                          <p className="text-white font-medium text-sm mb-1">
                            {uploadExamMode === 'qa_pdf'
                              ? 'Click to browse or drag and drop Question & Answer PDF'
                              : uploadExamMode === 'both'
                              ? 'Click to browse or drag and drop PPT slides or Question List PDF'
                              : 'Click to browse or drag and drop PPT / PDF slides'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {uploadExamMode === 'qa_pdf'
                              ? 'PDF benchmark document with questions and answers (Max 50MB)'
                              : uploadExamMode === 'both'
                              ? 'PowerPoint (.ppt, .pptx) or PDF question list (Max 50MB)'
                              : 'PowerPoint (.ppt, .pptx) or PDF (Max 50MB)'}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Weightage for this uploaded file */}
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-white/10 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-200">
                            Viva Question Weightage for this File (%)
                          </label>
                          <p className="text-[11px] text-gray-400">
                            e.g. PPT 1 (20%), PPT 2 (30%), PPT 3 (40%). Proportion of viva questions sourced from this file.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-900 border border-blue-500/50 rounded-xl px-3 py-1.5">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={fileWeightage}
                              onChange={e => setFileWeightage(e.target.value)}
                              className="w-14 bg-transparent text-white font-bold text-center text-sm focus:outline-none"
                            />
                            <span className="text-xs font-bold text-blue-400">%</span>
                          </div>

                          <div className="flex gap-1">
                            {['10', '20', '30', '40', '50'].map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => setFileWeightage(w)}
                                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                  fileWeightage === w
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'bg-white/5 hover:bg-white/10 text-gray-300'
                                }`}
                              >
                                {w}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          disabled={!file || generating}
                          type="submit"
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-600/20 transition-colors"
                        >
                          {generating && file ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
                          Upload Material ({fileWeightage}%)
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* 3. Number of Questions & Question Bank Generator Setup */}
                <div className="pt-2 border-t border-white/10">
                  <div className="bg-gradient-to-r from-emerald-950/40 to-teal-950/20 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">Number of Questions to Generate</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                            Proportional AI
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Allocates questions across your uploaded PPTs based on each file&apos;s weightage %.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-900 border border-emerald-500/60 rounded-xl px-3 py-1.5">
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={totalQuestionsToGen}
                            onChange={e => setTotalQuestionsToGen(e.target.value)}
                            className="w-14 bg-transparent text-white font-bold text-center text-sm focus:outline-none"
                          />
                          <span className="text-xs text-emerald-400 font-semibold">Qs</span>
                        </div>

                        <div className="flex gap-1">
                          {['5', '10', '15', '20', '30'].map(q => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setTotalQuestionsToGen(q)}
                              className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                totalQuestionsToGen === q
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300'
                              }`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Allocation Preview Grid */}
                    {materials.length > 0 && (
                      <div className="pt-2 border-t border-emerald-500/20">
                        <div className="text-[11px] font-semibold text-emerald-300/90 mb-1.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                          <span>Live Allocation Preview ({totalQuestionsToGen} Questions Total):</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {getMaterialQuestionAllocations().map((alloc, idx) => (
                            <div key={alloc.id} className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${PALETTE_COLORS[idx % PALETTE_COLORS.length]}`} />
                                <span className="truncate text-gray-300 max-w-[100px]" title={alloc.filename}>{alloc.filename}</span>
                                <span className="text-[10px] text-gray-500">({alloc.sharePct}%)</span>
                              </div>
                              <span className="font-bold text-emerald-400 shrink-0 ml-1">
                                {alloc.allocatedCount} {alloc.allocatedCount === 1 ? 'Q' : 'Qs'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 shrink-0 bg-slate-900/90 flex justify-between items-center">
                <p className="text-xs text-gray-400 max-w-xs">
                  Generates {totalQuestionsToGen} questions according to each PPT&apos;s weightage with preview & editing.
                </p>
                <button 
                  onClick={handleGenerateQuestions} 
                  disabled={generating || materials.length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {generating && !file ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Generating {totalQuestionsToGen} Questions...
                    </>
                  ) : (
                    <>
                      <span>Generate Question Bank ({totalQuestionsToGen} Qs)</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Preview Questions & Answers Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0 bg-slate-900/80">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-bold text-white">Question Bank Preview & Review</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                    {previewQuestions.length} Questions
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {previewExamSubject} • Review, edit, or customize AI-generated questions and expected answers.
                </p>
              </div>
              <button onClick={() => setIsPreviewModalOpen(false)} className="text-gray-400 hover:text-white p-2">✕</button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto grow custom-scrollbar">
              {previewQuestions.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mx-auto mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2" /></svg>
                  </div>
                  <p className="text-white font-medium">No questions generated yet</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    You can add questions manually or upload lecture materials and click generate.
                  </p>
                  <button 
                    onClick={addCustomQuestion}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
                  >
                    + Add First Question
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {previewQuestions.map((q, idx) => {
                    const bloomTag = getBloomTag(q.question_text);
                    return (
                      <div key={idx} className="p-5 bg-white/5 rounded-xl border border-white/10 space-y-3 hover:border-white/20 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 bg-slate-700 text-gray-200 rounded">
                              Q{idx + 1}
                            </span>
                            {bloomTag && (
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-md border ${bloomTag.colorClass} flex items-center gap-1`}>
                                <svg className="w-3 h-3 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                <span>{bloomTag.level}</span>
                              </span>
                            )}
                            {q.source_material_id && (() => {
                              const srcMat = materials.find(m => m.id === q.source_material_id);
                              if (!srcMat) return null;
                              return (
                                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-800 text-blue-300 border border-blue-500/30 flex items-center gap-1" title={srcMat.filename}>
                                  <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <span className="truncate max-w-[140px]">{srcMat.filename}</span>
                                  <span className="text-[10px] text-gray-400">({srcMat.weightage}%)</span>
                                </span>
                              );
                            })()}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => deleteQuestion(idx)} 
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
                          >
                            Delete
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Question Text
                          </label>
                          <textarea 
                            rows={2}
                            value={q.question_text} 
                            onChange={e => updateQuestionText(idx, e.target.value)} 
                            className="w-full bg-slate-800/90 border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 resize-y"
                            placeholder="Enter the question to be asked..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-emerald-400/80 mb-1 flex items-center gap-1">
                            <span>✓</span> Expected Model Answer (Used for Auto-Grading)
                          </label>
                          <textarea 
                            rows={3}
                            value={q.expected_answer || ''} 
                            onChange={e => updateExpectedAnswer(idx, e.target.value)} 
                            className="w-full bg-slate-800/60 border border-white/10 rounded-lg p-3 text-sm text-gray-200 focus:ring-2 focus:ring-emerald-500/50 resize-y"
                            placeholder="Detailed technical explanation and key grading criteria..."
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    <button 
                      onClick={addCustomQuestion}
                      className="w-full py-2.5 border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span>+ Add Another Question</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10 shrink-0 bg-slate-900/80 flex justify-between items-center">
              <button 
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setIsUploadModalOpen(true);
                }}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5"
              >
                <span>← Back to Notes & Uploads</span>
              </button>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveQuestions}
                  disabled={savingQuestions || previewQuestions.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  {savingQuestions ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span>Save & Approve Question Bank</span>
                      <span>✓</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Reschedule Modal */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
                  <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Reschedule & Edit Viva</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Update scheduled date, time, location, question parameters, or marks.</p>
                </div>
              </div>
              <button onClick={() => setIsRescheduleModalOpen(false)} className="text-gray-400 hover:text-white p-2">✕</button>
            </div>
            
            <form noValidate onSubmit={handleRescheduleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Viva Title / Subject</label>
                  <input 
                    type="text" 
                    value={rescheduleTitle} 
                    onChange={e => setRescheduleTitle(e.target.value)} 
                    placeholder="e.g. Midterm Oral Viva" 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">New Date</label>
                  <input 
                    type="date" 
                    value={rescheduleDate} 
                    onChange={e => setRescheduleDate(e.target.value)} 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert focus:ring-2 focus:ring-amber-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">New Time</label>
                  <input 
                    type="time" 
                    value={rescheduleTime} 
                    onChange={e => setRescheduleTime(e.target.value)} 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert focus:ring-2 focus:ring-amber-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Location / Venue</label>
                  <input 
                    type="text" 
                    value={rescheduleLocation} 
                    onChange={e => setRescheduleLocation(e.target.value)} 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50" 
                    placeholder="e.g. Room 302 / Virtual Room" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Questions per Student</label>
                  <input 
                    type="number" 
                    value={rescheduleQuestionsCount} 
                    onChange={e => setRescheduleQuestionsCount(e.target.value)} 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Mins per Question</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    value={rescheduleTimer} 
                    onChange={e => setRescheduleTimer(e.target.value)} 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/50" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center justify-between">
                    <span>Total Marks</span>
                    <span className="text-xs text-amber-400 font-normal">Auto-scales grades</span>
                  </label>
                  <input 
                    type="number" 
                    value={rescheduleTotalMarks} 
                    onChange={e => handleRescheduleTotalMarksChange(e.target.value)} 
                    className="w-full bg-slate-800 border border-amber-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/50" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type of Exam (Mode)</label>
                  <select
                    value={rescheduleExamMode}
                    onChange={e => setRescheduleExamMode(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="ppt_only">Only PPT (Questions generated from PPT, answers expected from PPT)</option>
                    <option value="both">Questions Uploaded along with PPT (Only answers expected from PPT)</option>
                    <option value="qa_pdf">Question and Answer PDF (with or without PPT)</option>
                  </select>
                </div>
              </div>

              {/* Bloom's Taxonomy Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-800/60 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shadow-inner">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">Bloom&apos;s Taxonomy</span>
                      {rescheduleBloomsTaxonomy && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full animate-pulse">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Generate questions structured across cognitive levels (Remember, Understand, Apply, Analyze, Evaluate, Create).
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                  <input 
                    type="checkbox" 
                    checked={rescheduleBloomsTaxonomy} 
                    onChange={e => setRescheduleBloomsTaxonomy(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-md"></div>
                </label>
              </div>

              {/* Grading Scheme */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="text-white font-medium">Grading Scheme</h4>
                    <p className="text-xs text-gray-400">Thresholds dynamically calculate based on Total Marks ({rescheduleTotalMarks})</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={resetRescheduleGradingSchemesToStandard}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                      title="Reset to standard 90/80/70/60% tiers"
                    >
                      <span>↺ Standard (%)</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const tot = parseFloat(rescheduleTotalMarks) || 100;
                        setRescheduleGradingSchemes([
                          ...rescheduleGradingSchemes, 
                          { grade_label: '', min_marks: 0, max_marks: tot, min_pct: 0, max_pct: 100 }
                        ]);
                      }}
                      className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition-colors"
                    >
                      + Add Grade
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {rescheduleGradingSchemes.map((scheme, idx) => {
                    const minP = Math.round(scheme.min_pct);
                    const maxP = Math.round(scheme.max_pct);
                    return (
                      <div key={idx} className="flex gap-2.5 items-center">
                        <input 
                          required placeholder="Grade" type="text" value={scheme.grade_label} 
                          onChange={e => handleRescheduleGradeChange(idx, 'grade_label', e.target.value)} 
                          className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white font-semibold text-center uppercase" 
                        />
                        <input 
                          required placeholder="Min" type="number" step="0.1" min="0" max={rescheduleTotalMarks} value={scheme.min_marks} 
                          onChange={e => handleRescheduleGradeChange(idx, 'min_marks', e.target.value)} 
                          className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white text-center" 
                        />
                        <span className="text-gray-500 text-xs">-</span>
                        <input 
                          required placeholder="Max" type="number" step="0.1" min="0" max={rescheduleTotalMarks} value={scheme.max_marks} 
                          onChange={e => handleRescheduleGradeChange(idx, 'max_marks', e.target.value)} 
                          className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white text-center" 
                        />
                        <span className="text-[11px] text-gray-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md shrink-0 font-mono">
                          {minP}% - {maxP}%
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setRescheduleGradingSchemes(rescheduleGradingSchemes.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 p-1.5 ml-auto text-sm"
                          title="Remove grade"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={() => setIsRescheduleModalOpen(false)} 
                  className="px-5 py-2.5 rounded-xl text-gray-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button 
                  disabled={rescheduling} 
                  type="submit" 
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  {rescheduling ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Reschedule</span>
                      <span>✓</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
