'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, CheckCircle2, AlertCircle, Clock, Mic, MicOff, RefreshCw, X, Play, Pause, ChevronRight, RotateCcw } from 'lucide-react';

export default function LiveVivaDashboard() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examMode, setExamMode] = useState('ppt_only');
  const [totalQuestionsToGenerate, setTotalQuestionsToGenerate] = useState(20);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [questionsPerStudent, setQuestionsPerStudent] = useState(5);
  const [timerPerQuestion, setTimerPerQuestion] = useState(1.0); // in minutes
  const [roster, setRoster] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Verification popup
  const [verifyingStudent, setVerifyingStudent] = useState<any | null>(null);

  // Live Viva State
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [activeVivaRunId, setActiveVivaRunId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluatingSeconds, setEvaluatingSeconds] = useState(0);
  const evalTimerRef = useRef<any>(null);
  
  // Questions State
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gradingFeedback, setGradingFeedback] = useState<string | null>(null);
  const [gradingScore, setGradingScore] = useState<number | null>(null);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<any>(null);

  // Re-viva processing state
  const [revivaLoading, setRevivaLoading] = useState<number | null>(null);

  // Speech Recognition & Audio Capture refs
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const transcriptRef = useRef('');
  const accumulatedTranscriptRef = useRef('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchExams = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/auth/login');
      const res = await fetch('http://localhost:8000/api/v1/faculty/exams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setExams(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchExams();

    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let sessionTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            sessionTranscript += event.results[i][0].transcript + ' ';
          }
          const prefix = accumulatedTranscriptRef.current ? accumulatedTranscriptRef.current.trim() + ' ' : '';
          const fullText = (prefix + sessionTranscript).trim();
          transcriptRef.current = fullText;
          setTranscript(fullText);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          // 'no-speech' is emitted when the speaker pauses to think or breathe. Do not drop recording.
          if (event.error === 'no-speech') {
            return;
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            isRecordingRef.current = false;
            setIsRecording(false);
          }
        };

        recognition.onend = () => {
          // If user hasn't clicked stop, auto-restart seamlessly so silence pauses do not drop dictation
          if (isRecordingRef.current) {
            accumulatedTranscriptRef.current = transcriptRef.current;
            try {
              recognition.start();
            } catch (e) {
              setTimeout(() => {
                if (isRecordingRef.current) {
                  try { recognition.start(); } catch (err) {}
                }
              }, 250);
            }
          } else {
            setIsRecording(false);
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router]);

  // ── Timer logic ────────────────────────────────────────────────────────────
  const startTimer = useCallback((durationSeconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(durationSeconds);
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fetchRoster = async (runId: number) => {
    setLoadingRoster(true);
    try {
      const token = localStorage.getItem('access_token');
      const rosterRes = await fetch(`http://localhost:8000/api/v1/viva/runs/${runId}/roster`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (rosterRes.ok) {
        setRoster(await rosterRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleStartExamRun = async () => {
    if (!selectedExamId) return alert('Please select an exam first');
    
    try {
      const token = localStorage.getItem('access_token');
      const selectedExam = exams.find((e: any) => String(e.id) === String(selectedExamId));
      const startRes = await fetch('http://localhost:8000/api/v1/viva/runs', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          exam_id: parseInt(selectedExamId),
          exam_type: selectedExam?.exam_type || 'ppt_only'
        })
      });
      
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.detail || "Failed to start exam run");
      
      const runId = startData.run_id;
      setActiveRunId(runId);
      setQuestionsPerStudent(startData.questions_per_student || selectedExam?.questions_per_student || 5);
      setTimerPerQuestion(startData.timer_per_question_minutes || selectedExam?.timer_per_question_minutes || 1.0);
      await fetchRoster(runId);
    } catch (err: any) {
      alert("Error starting exam run: " + err.message);
    }
  };

  const toggleAbsent = (studentId: number) => {
    setRoster(roster.map(s => s.student_id === studentId
      ? { ...s, status: s.status === 'absent' ? 'pending' : 'absent' }
      : s
    ));
  };

  const initiateVerification = (studentId: number) => {
    const student = roster.find(s => s.student_id === studentId);
    setVerifyingStudent(student);
  };

  const confirmVerificationAndStart = async () => {
    if (!verifyingStudent || !activeRunId) return;
    
    try {
      const token = localStorage.getItem('access_token');
      
      // 1. Start the student viva - backend assigns random questions
      const startStudentRes = await fetch(
        `http://localhost:8000/api/v1/viva/runs/${activeRunId}/students/${verifyingStudent.student_id}/start`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const startStudentData = await startStudentRes.json();

      // 2. Fetch this student's assigned questions
      const qRes = await fetch(
        `http://localhost:8000/api/v1/viva/runs/${activeRunId}/questions?student_id=${verifyingStudent.student_id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      let qData = await qRes.json();

      if (!Array.isArray(qData) || qData.length === 0) {
        // Fallback: generate on the fly
        const genRes = await fetch(
          `http://localhost:8000/api/v1/viva/runs/${activeRunId}/generate-question`,
          { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
        );
        const newQ = await genRes.json();
        qData = [newQ];
      }

      setQuestions(qData);
      setCurrentQuestionIndex(0);
      setActiveStudentId(verifyingStudent.student_id);
      setActiveVivaRunId(startStudentData.viva_run_id || activeRunId);
      setVerifyingStudent(null);
      setIsRecording(false);
      setTranscript('');
      setGradingFeedback(null);
      setGradingScore(null);
      
      // Start the per-question timer
      startTimer(Math.round(timerPerQuestion * 60));

      setRoster(roster.map(s =>
        s.student_id === verifyingStudent.student_id ? { ...s, status: 'in_progress' } : s
      ));
    } catch (err: any) {
      alert("Error starting viva for student: " + err.message);
    }
  };

  const handleSkipReroll = async () => {
    if (!activeRunId) return;
    try {
      setGradingFeedback("Ollama is generating a fresh viva question...");
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/viva/runs/${activeRunId}/generate-question`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const newQ = await res.json();
        const updated = [...questions];
        updated[currentQuestionIndex] = newQ;
        setQuestions(updated);
        setTranscript('');
        transcriptRef.current = '';
        accumulatedTranscriptRef.current = '';
        setGradingFeedback(null);
        setGradingScore(null);
        startTimer(Math.round(timerPerQuestion * 60));
      }
    } catch (err) {
      console.error("Failed to reroll question:", err);
      setGradingFeedback("Error generating new question with Ollama.");
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
    } else {
      isRecordingRef.current = true;
      setIsRecording(true);
      setTranscript('');
      transcriptRef.current = '';
      accumulatedTranscriptRef.current = '';
      setGradingFeedback(null);
      setGradingScore(null);
      audioChunksRef.current = [];

      // Start MediaRecorder audio capture
      try {
        if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
          mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start(500);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn("MediaRecorder capture error:", err);
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn("Could not start speech recognition:", e);
        }
      }
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!transcript.trim()) { alert("Please provide an answer before evaluating."); return; }
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ || !activeRunId || !activeStudentId) return;

    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
    }

    setEvaluating(true);
    setEvaluatingSeconds(0);
    if (evalTimerRef.current) clearInterval(evalTimerRef.current);
    evalTimerRef.current = setInterval(() => {
      setEvaluatingSeconds(prev => prev + 1);
    }, 1000);
    setGradingFeedback("Evaluating response with Ollama...");
    
    // Convert recorded audio chunks to base64
    let audioBase64: string | null = null;
    if (audioChunksRef.current.length > 0) {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      } catch (audioErr) {
        console.warn("Could not encode audio blob:", audioErr);
      }
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(
        `http://localhost:8000/api/v1/viva/runs/${activeRunId}/students/${activeStudentId}/answers`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: currentQ.id,
            transcript: transcript.trim(),
            audio_data: audioBase64
          })
        }
      );
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setGradingScore(data.score);
      setGradingFeedback(data.feedback || "Evaluated successfully.");
      audioChunksRef.current = [];
    } catch (err: any) {
      setGradingFeedback("Error contacting Ollama: " + err.message);
    } finally {
      if (evalTimerRef.current) clearInterval(evalTimerRef.current);
      setEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    stopTimer();
    audioChunksRef.current = [];
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTranscript('');
      transcriptRef.current = '';
      accumulatedTranscriptRef.current = '';
      setGradingFeedback(null);
      setGradingScore(null);
      startTimer(Math.round(timerPerQuestion * 60));
    } else {
      handleSkipReroll();
    }
  };

  const handleCompleteStudent = async () => {
    if (!activeVivaRunId) return;
    stopTimer();
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/viva/viva/${activeVivaRunId}/finish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Student viva completed!\nTotal Score: ${data.total_score}%\nGrade: ${data.grade}`);
      
      if (activeRunId) await fetchRoster(activeRunId);
      setActiveStudentId(null);
      setActiveVivaRunId(null);
      setQuestions([]);
    } catch (err: any) {
      alert("Error finishing viva: " + err.message);
    }
  };

  const handlePauseStudent = async () => {
    if (!activeVivaRunId || !activeStudentId || !activeRunId) return;
    stopTimer();
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`http://localhost:8000/api/v1/viva/runs/${activeRunId}/students/${activeStudentId}/pause`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert("Viva session paused.");
      await fetchRoster(activeRunId);
      setActiveStudentId(null);
      setActiveVivaRunId(null);
      setQuestions([]);
    } catch (err: any) {
      alert("Error pausing viva: " + err.message);
    }
  };

  const handleReViva = async (vivaRunId: number, studentId: number) => {
    if (!confirm("Are you sure you want to initiate a Re-Viva for this student? All previous answers will be cleared.")) return;
    setRevivaLoading(vivaRunId);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/viva/viva/${vivaRunId}/re-viva`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Re-Viva reset failed");
      }
      alert("Re-Viva initiated! Student's viva has been reset with a new set of questions.");
      if (activeRunId) await fetchRoster(activeRunId);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setRevivaLoading(null);
    }
  };

  const currentQ = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  // ── Active session view ────────────────────────────────────────────────────
  if (activeStudentId) {
    const student = roster.find((s: any) => s.student_id === activeStudentId);
    const timerDanger = timeLeft <= 30 && timeLeft > 0;
    const timerWarning = timeLeft <= 60 && timeLeft > 30;

    return (
      <div className="min-h-screen bg-background text-foreground p-8 selection:bg-primary/20">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <div className="flex justify-between items-center bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Live Viva Session</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-semibold border border-primary/20">
                  {student?.name}
                </span>
                <span className="text-muted-foreground text-sm font-mono">GR: {student?.gr_number}</span>
                <span className="text-muted-foreground/80 text-xs">Ollama LLM Active</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Countdown Timer */}
              <div className={`flex flex-col items-center px-5 py-2.5 rounded-xl border font-mono ${
                timerDanger ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse' :
                timerWarning ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' :
                'bg-muted/50 border-border text-foreground'
              }`}>
                <span className="text-2xl font-bold tracking-widest">{formatTime(timeLeft)}</span>
                <span className="text-xs mt-0.5 opacity-60 uppercase tracking-wider font-sans">Time Left</span>
              </div>
              <span className="text-xs px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
                Ollama Llama3
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Question & Controls */}
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm relative">
                <div className="absolute -top-3 left-6 bg-primary text-primary-text text-xs font-semibold px-3 py-1 rounded-md shadow-sm">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </div>
                <div className="mt-4">
                  <p className="text-lg text-foreground font-medium leading-relaxed">
                    {currentQ?.question_text || "Loading viva question..."}
                  </p>
                  {currentQ?.expected_answer && (
                    <details className="mt-3 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
                      <summary className="cursor-pointer text-primary hover:underline font-medium">View Model Answer (Faculty Reference)</summary>
                      <p className="mt-2 text-foreground/80 leading-relaxed">{currentQ.expected_answer}</p>
                    </details>
                  )}
                </div>
                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={handleSkipReroll}
                    className="h-9 px-3.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-medium text-foreground transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-primary" />
                    Reroll with Ollama
                  </button>
                </div>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center min-h-[220px] gap-4">
                <button 
                  onClick={handleToggleRecording} 
                  className={`w-28 h-28 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                    isRecording 
                      ? 'bg-rose-500/10 border-2 border-rose-500 text-rose-600 dark:text-rose-400 shadow-rose-500/20 animate-pulse' 
                      : 'bg-primary/10 border-2 border-primary text-primary hover:bg-primary/20 shadow-sm hover:scale-105'
                  }`}
                >
                  <div className="text-center">
                    {isRecording ? (
                      <MicOff className="w-8 h-8 mx-auto mb-1.5 animate-pulse" />
                    ) : (
                      <Mic className="w-8 h-8 mx-auto mb-1.5" />
                    )}
                    <span className="font-bold text-xs tracking-wider">{isRecording ? 'STOP' : 'SPEAK'}</span>
                  </div>
                </button>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase">
                    {isRecording ? 'Listening for speech...' : 'Click to Speak (or Type below)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Transcript & AI Feedback */}
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm h-60 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Transcript / Answer</h2>
                  <span className="text-xs text-muted-foreground/80">Editable</span>
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    transcriptRef.current = e.target.value;
                    accumulatedTranscriptRef.current = e.target.value;
                  }}
                  placeholder="Student answer will transcribe here in real-time as spoken, or you can type here directly..."
                  className="flex-1 w-full bg-background rounded-xl p-3 font-mono text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none leading-relaxed"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleEvaluateAnswer}
                    disabled={evaluating || !transcript.trim()}
                    className="h-9 px-4 bg-primary hover:bg-primary-hover text-primary-text rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
                  >
                    {evaluating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Grading with Ollama ({evaluatingSeconds}s)...</span>
                      </>
                    ) : (
                      <span>Grade with Ollama ➔</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex-1 min-h-[160px] flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Ollama AI Grading Insight
                  </h2>
                  {gradingScore !== null && (
                    <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-md text-xs border border-primary/20 font-mono">
                      Score: {gradingScore}/100
                    </span>
                  )}
                </div>
                <div className="flex-1 bg-muted/40 rounded-xl p-4 text-sm text-foreground border border-border leading-relaxed overflow-y-auto max-h-40">
                  {evaluating ? (
                    <div className="flex items-start gap-3 text-primary">
                      <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Evaluating answer with Ollama...</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Running local model inference ({evaluatingSeconds}s elapsed). Please wait...</p>
                      </div>
                    </div>
                  ) : (
                    gradingFeedback || 'Submit or evaluate the student response to receive real-time feedback and scoring from Ollama.'
                  )}
                </div>
              </div>
            </div>
            
          </div>

          <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex justify-between items-center">
            <div className="flex gap-3">
              <button 
                onClick={handleCompleteStudent}
                className="h-10 px-5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg font-semibold text-sm transition-colors"
              >
                Finish & Grade Student
              </button>
              <button 
                onClick={handlePauseStudent}
                className="h-10 px-5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg font-semibold text-sm transition-colors"
              >
                Pause Viva
              </button>
            </div>

            {currentQuestionIndex + 1 < questions.length ? (
              <button 
                onClick={handleNextQuestion}
                className="h-10 px-6 bg-primary hover:bg-primary-hover text-primary-text rounded-lg font-semibold text-sm shadow-sm transition-colors"
              >
                Next Question ➔
              </button>
            ) : (
              <button 
                onClick={handleCompleteStudent}
                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors"
              >
                Submit & Complete Viva ➔
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ── Roster / Setup view ───────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Conduct Viva
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Select a scheduled exam to open the live roster and conduct AI-graded oral examinations.
          </p>
        </header>

        {!activeRunId ? (
          (() => {
            const selectedExam = exams.find((e: any) => String(e.id) === String(selectedExamId));
            return (
            <div className="bg-card p-6 md:p-8 rounded-2xl border border-border max-w-2xl shadow-sm">
              <h3 className="text-xl font-bold text-foreground mb-6">Select Exam</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Available Scheduled Exams</label>
                  <select 
                    value={selectedExamId} 
                    onChange={e => setSelectedExamId(e.target.value)} 
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground mb-4"
                  >
                    <option value="">-- Choose Exam --</option>
                    {exams.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.subject_name} (Class ID: {e.class_id})</option>
                    ))}
                  </select>

                  {selectedExam && (
                    <div className="bg-muted/40 p-5 rounded-xl border border-border space-y-3 mb-2 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="font-medium text-muted-foreground">Subject</span>
                        <span className="font-semibold text-foreground">{selectedExam.subject_name}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="font-medium text-muted-foreground">Class ID</span>
                        <span className="font-semibold text-foreground">{selectedExam.class_id}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="font-medium text-muted-foreground">Configured Mode</span>
                        <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">
                          {selectedExam.exam_type === 'both' ? 'Questions Uploaded along with PPT' :
                           selectedExam.exam_type === 'qa_pdf' ? 'Question & Answer PDF' : 'Only PPT'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="font-medium text-muted-foreground">Questions per Student</span>
                        <span className="font-semibold text-foreground">{selectedExam.questions_per_student}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="font-medium text-muted-foreground">Timer per Question</span>
                        <span className="font-semibold text-foreground">{selectedExam.timer_per_question_minutes} min</span>
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleStartExamRun} 
                  disabled={!selectedExamId}
                  className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-text rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-40"
                >
                  Start the Exam
                </button>
              </div>
            </div>
          );
        })()
        ) : (
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-foreground">Student Roster</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Live students enrolled in this exam&apos;s class · {questionsPerStudent} questions per student · {timerPerQuestion} min/question
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => fetchRoster(activeRunId)}
                  className="px-3 h-8 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg transition-colors border border-border flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  Refresh Roster
                </button>
                <div className="text-xs bg-primary/10 text-primary py-1 px-3 rounded-md font-semibold border border-primary/20">
                  {roster.filter((r: any) => r.status === 'completed').length} / {roster.length} Completed
                </div>
              </div>
            </div>
            
            {loadingRoster ? (
              <p className="text-muted-foreground p-8 text-center animate-pulse">Loading class roster...</p>
            ) : roster.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl">
                <p className="text-muted-foreground font-medium">No students found enrolled in this class.</p>
                <p className="text-xs text-muted-foreground/80 mt-1">Please ensure students are assigned to this class in the SuperAdmin portal.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enrollment / GR</th>
                      <th className="p-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Name</th>
                      <th className="p-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="p-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score &amp; Grade</th>
                      <th className="p-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {roster.map((student: any) => (
                      <tr key={student.student_id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3.5 text-foreground font-mono text-sm">
                          <div>{student.gr_number}</div>
                          <div className="text-xs text-muted-foreground">{student.enrollment_number}</div>
                        </td>
                        <td className="p-3.5 text-foreground font-medium">{student.name}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${
                            student.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 
                            student.status === 'in_progress' ? 'bg-primary/10 text-primary border border-primary/20' : 
                            student.status === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                            student.status === 'absent' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' : 
                            'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {student.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 text-sm">
                          {student.total_score !== null && student.total_score !== undefined ? (
                            <span className="font-semibold text-foreground">
                              {student.total_score}% ({student.grade || 'N/A'})
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-2 items-center">
                            {student.status !== 'completed' ? (
                              <>
                                <button 
                                  onClick={() => initiateVerification(student.student_id)}
                                  disabled={student.status === 'absent'}
                                  className="h-8 px-3.5 bg-primary hover:bg-primary-hover text-primary-text rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-30"
                                >
                                  {(student.status === 'in_progress' || student.status === 'paused') ? 'Resume Viva' : 'Start Viva'}
                                </button>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                                  <input 
                                    type="checkbox" 
                                    checked={student.status === 'absent'}
                                    onChange={() => toggleAbsent(student.student_id)}
                                    className="w-4 h-4 rounded border-border bg-background checked:bg-rose-600 text-rose-500 focus:ring-rose-500" 
                                  />
                                  Mark Absent
                                </label>
                              </>
                            ) : (
                              <>
                                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4" />
                                  Done
                                </span>
                                {/* Re-Viva Button */}
                                <button
                                  onClick={() => handleReViva(student.run_id, student.student_id)}
                                  disabled={revivaLoading === student.run_id}
                                  className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
                                >
                                  {revivaLoading === student.run_id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                  Re-Viva
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ID Verification Modal */}
      {verifyingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Verify Identity</h3>
                  <p className="text-xs text-muted-foreground">Confirm student details before starting oral exam</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingStudent(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium p-1 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Student Name</p>
                  <p className="text-base font-bold text-foreground mt-0.5">{verifyingStudent.name}</p>
                </div>
                
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">GR Number</p>
                  <p className="text-lg font-mono font-bold text-primary mt-0.5">{verifyingStudent.gr_number}</p>
                </div>

                {verifyingStudent.enrollment_number && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Enrollment Number</p>
                    <p className="text-sm font-mono text-muted-foreground mt-0.5">{verifyingStudent.enrollment_number}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => setVerifyingStudent(null)} 
                  className="flex-1 h-10 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={confirmVerificationAndStart} 
                  className="flex-1 h-10 bg-primary hover:bg-primary-hover text-primary-text rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  Verified, Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

