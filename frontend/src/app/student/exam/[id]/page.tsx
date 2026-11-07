'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Square,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  UserCheck,
  Hourglass,
  ArrowRight,
  Radio,
  FileText,
  Volume2
} from 'lucide-react';

interface QueueStudent {
  turn_number: number;
  student_id: number;
  name: string;
  gr_number: string;
  enrollment_number: string;
  is_you: boolean;
  status: string;
}

interface CurrentlyExamining {
  student_id: number;
  name: string;
  gr_number: string;
  enrollment_number?: string;
  is_you?: boolean;
}

interface SessionData {
  status: string;
  run_id?: number;
  viva_run_id?: number;
  subject_name?: string;
  timer_per_question_minutes?: number;
  questions_per_student?: number;
  my_turn_number?: number | null;
  students_ahead?: number | null;
  total_in_queue?: number;
  estimated_wait_minutes?: number;
  currently_examining?: CurrentlyExamining | null;
  queue_list?: QueueStudent[];
  completed_count?: number;
  total_students?: number;
  active_question?: {
    id: number;
    question_text: string;
    question_index: number;
    total_questions: number;
  } | null;
  total_score?: number | null;
  grade?: string | null;
}

export default function StudentExamView({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [exam, setExam] = useState<any>(null);
  const [status, setStatus] = useState<string>('waiting'); // 'waiting', 'pending', 'in_progress', 'completed'
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [transcript, setTranscript] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  // Question countdown timer
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevQuestionIdRef = useRef<number | null>(null);

  // Auto-clear transcript & recording when question transitions to next question
  useEffect(() => {
    if (currentQuestion?.id && prevQuestionIdRef.current !== currentQuestion.id) {
      if (prevQuestionIdRef.current !== null) {
        setTranscript('');
        setFeedback(null);
        setScore(null);
        setIsRecording(false);
      }
      prevQuestionIdRef.current = currentQuestion.id;
    }
  }, [currentQuestion?.id]);

  const prevStatusRef = useRef<string>('waiting');
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Synthetic admission chime
  const playAdmissionChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext may be restricted by autoplay policies
    }
  };

  // Initialize Speech Recognition for viva oral responses
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript + ' ';
          }
          setTranscript(text.trim());
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Poll real exam and student session queue status from backend every 2s
  useEffect(() => {
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/v1/viva/student-session/${params.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });

        if (res.ok && isMounted) {
          const data: SessionData = await res.json();
          setSessionData(data);
          const rawStatus = (data.status || 'waiting').toLowerCase();
          setStatus(rawStatus);

          if (data.subject_name) {
            setExam((prev: any) => ({ ...prev, subject_name: data.subject_name }));
          }

          // Trigger chime when transitioned from waiting/pending to in_progress
          if (
            (prevStatusRef.current === 'waiting' || prevStatusRef.current === 'pending') &&
            rawStatus === 'in_progress'
          ) {
            playAdmissionChime();
          }
          prevStatusRef.current = rawStatus;

          if (data.active_question) {
            setCurrentQuestion(data.active_question);
          } else if (rawStatus === 'completed') {
            setCurrentQuestion(null);
          }

          if (data.total_score !== undefined && data.total_score !== null) {
            setScore(data.total_score);
          }
        }
      } catch (err) {
        console.error('Session polling error:', err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [params.id, router]);

  // Per-question countdown timer management
  useEffect(() => {
    if (status === 'in_progress') {
      const duration = Math.round((sessionData?.timer_per_question_minutes || 2) * 60);
      setQuestionTimeLeft(duration);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setQuestionTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, currentQuestion?.id, sessionData?.timer_per_question_minutes]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      setIsRecording(false);
    } else {
      setTranscript('');
      setFeedback(null);
      setScore(null);
      audioChunksRef.current = [];

      // Start MediaRecorder for audio capture
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn('MediaRecorder not available, continuing without audio capture:', err);
      }

      // Start Speech Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch {
          setIsRecording(true);
        }
      } else {
        setIsRecording(true);
      }
    }
  };

  const handleSubmitAnswer = async () => {
    if (!transcript.trim()) {
      alert('Please speak or type an answer first.');
      return;
    }
    if (!currentQuestion?.id) return;

    setEvaluating(true);
    setFeedback('AI is evaluating your oral response...');

    // Convert recorded audio to base64
    let audioBase64: string | null = null;
    if (audioChunksRef.current.length > 0) {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioBase64 = btoa(binary);
      } catch (err) {
        console.warn('Error encoding audio:', err);
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/viva/student-session/${params.id}/submit-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          transcript: transcript.trim(),
          audio_data: audioBase64
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Submission failed');
      }

      const data = await res.json();
      setScore(data.score);
      setFeedback(data.feedback);
    } catch (err: any) {
      setFeedback('Error submitting answer: ' + err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleLeave = () => {
    router.push('/student/dashboard');
  };

  const isWaitingRoom = status === 'waiting' || status === 'pending';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';
  const isPaused = status === 'paused';
  const isAbsent = status === 'absent';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 selection:bg-primary/30 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Global Exam Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-6 rounded-2xl border border-border shadow-sm gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                <Radio className="w-5 h-5 animate-pulse" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Live Oral Examination</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-semibold border border-primary/20">
                {exam?.subject_name || `Exam #${params.id}`}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Paced at {sessionData?.timer_per_question_minutes || 2} min / question
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase border ${
              isWaitingRoom
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : isInProgress
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse'
                : isPaused
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : isAbsent
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              {isWaitingRoom
                ? 'In Waiting Queue'
                : isInProgress
                ? 'Live Session Active'
                : isPaused
                ? 'Session Paused'
                : isAbsent
                ? 'Marked Absent'
                : 'Completed'}
            </span>
          </div>
        </div>

        {/* ── STATE 1: WAITING ROOM & LIVE QUEUE ──────────────────────────── */}
        {isWaitingRoom && (
          <div className="space-y-6">
            {/* Top Queue Callout Banner */}
            <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase border bg-primary/10 text-primary border-primary/20">
                    <Clock className="w-3.5 h-3.5" />
                    {sessionData?.my_turn_number === 1
                      ? 'Next in Line : Prepare to be Admitted'
                      : sessionData?.my_turn_number && sessionData.my_turn_number > 1
                      ? `Queue Position: #${sessionData.my_turn_number}`
                      : 'Waiting Room Active'}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {sessionData?.my_turn_number === 1
                      ? 'You are Next in Queue!'
                      : sessionData?.my_turn_number && sessionData.my_turn_number > 1
                      ? `Your Turn: #${sessionData.my_turn_number} in Queue`
                      : 'Oral Viva Waiting Room'}
                  </h2>

                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                    {sessionData?.my_turn_number === 1
                      ? 'The examiner is concluding the previous viva. The moment your faculty starts questioning, your oral questions and timer will appear on this screen automatically.'
                      : sessionData?.my_turn_number && sessionData.my_turn_number > 1
                      ? `There are ${sessionData.students_ahead ?? 0} student(s) ahead of you. Keep this tab open. Your examination will launch automatically without refreshing.`
                      : 'You are registered in the waiting queue. The faculty examiner will admit students in order.'}
                  </p>
                </div>

                {/* Big Turn Number Indicator Badge */}
                <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border text-center min-w-[160px] self-stretch sm:self-auto flex flex-col justify-center items-center">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Your Turn Number
                  </span>
                  <span className="text-4xl font-extrabold text-foreground font-mono mt-1 block">
                    {sessionData?.my_turn_number ? `#${sessionData.my_turn_number}` : '--'}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {sessionData?.my_turn_number === 1 ? 'Next Up!' : `${sessionData?.students_ahead ?? 0} ahead`}
                  </span>
                </div>
              </div>

              {/* 4 Quick Stat Metric Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 mt-6 border-t border-border">
                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Est. Wait Time</span>
                  </div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    ~{sessionData?.estimated_wait_minutes ?? '< 5'} min
                  </div>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    ~{sessionData?.timer_per_question_minutes || 2}m per question
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>With Examiner</span>
                  </div>
                  <div className="text-sm font-bold text-foreground truncate">
                    {sessionData?.currently_examining?.name || 'Session Idle'}
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    {sessionData?.currently_examining?.gr_number ? `GR: ${sessionData.currently_examining.gr_number}` : 'Preparing next'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1">
                    <Hourglass className="w-3.5 h-3.5" />
                    <span>Students Ahead</span>
                  </div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {sessionData?.students_ahead !== null && sessionData?.students_ahead !== undefined
                      ? sessionData.students_ahead
                      : '--'}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {sessionData?.total_in_queue ?? 0} total waiting
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>Exam Progress</span>
                  </div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {sessionData?.completed_count ?? 0} / {sessionData?.total_students ?? 0}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    Completed sessions
                  </span>
                </div>
              </div>
            </div>

            {/* Live Queue Order Roster */}
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Live Examination Queue
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time queue sequence. Your entry is highlighted below.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/40 px-3 py-1 rounded-lg border border-border">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Live Sync (Every 2s)
                </div>
              </div>

              {/* Active Student Callout (if someone is currently in viva) */}
              {sessionData?.currently_examining && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Currently with Examiner:
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {sessionData.currently_examining.name}
                        </span>
                        {sessionData.currently_examining.is_you && (
                          <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        GR: {sessionData.currently_examining.gr_number}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    Live Viva In Progress
                  </span>
                </div>
              )}

              {/* Queue Sequence Table */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="p-3 font-semibold uppercase tracking-wider w-20">Turn</th>
                      <th className="p-3 font-semibold uppercase tracking-wider">Student Name</th>
                      <th className="p-3 font-semibold uppercase tracking-wider">GR / Enrollment</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">Queue Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sessionData?.queue_list && sessionData.queue_list.length > 0 ? (
                      sessionData.queue_list.map((student) => {
                        const isYou = student.is_you;
                        const isNext = student.turn_number === 1;

                        return (
                          <tr
                            key={student.student_id}
                            className={`transition-colors ${
                              isYou
                                ? 'bg-primary/5 font-semibold border-l-4 border-l-primary'
                                : 'hover:bg-muted/30'
                            }`}
                          >
                            <td className="p-3 font-mono font-bold text-foreground">
                              #{student.turn_number}
                            </td>
                            <td className="p-3 text-foreground">
                              <div className="flex items-center gap-2">
                                <span>{student.name}</span>
                                {isYou && (
                                  <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold">
                                    YOU
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-muted-foreground">
                              {student.gr_number} · {student.enrollment_number}
                            </td>
                            <td className="p-3 text-right">
                              {isYou ? (
                                <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                                  Your Turn #{student.turn_number}
                                </span>
                              ) : isNext ? (
                                <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Next Up
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                                  Waiting
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground">
                          {sessionData?.currently_examining
                            ? 'You are next in queue. Waiting for examiner admission...'
                            : 'Queue is currently clear. Stand by for the examiner to begin.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Status Hint */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center gap-3 text-xs text-muted-foreground">
                <Volume2 className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Keep this window open. An audible chime and live questions will trigger immediately once your faculty examiner admits you.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── STATE 2: LIVE QUESTIONS & ORAL EXAMINATION ────────────────── */}
        {isInProgress && (
          <div className="space-y-6">
            {/* Live Session Alert Banner */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                <span className="text-sm font-bold text-foreground">
                  Faculty Examiner Questioning Session Active
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold bg-background px-3 py-1 rounded-lg border border-border text-foreground">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Timer: {formatTime(questionTimeLeft)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Active Question & Oral Recording */}
              <div className="space-y-6">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm min-h-[220px] flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        Question {currentQuestion?.question_index || 1} of {currentQuestion?.total_questions || sessionData?.questions_per_student || 5}
                      </h3>
                      <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-md font-semibold border border-primary/20">
                        Active Prompt
                      </span>
                    </div>

                    <p className="text-lg md:text-xl text-foreground font-semibold leading-relaxed pt-2">
                      {currentQuestion?.question_text || 'Waiting for examiner question...'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                    <span>Answer clearly into your microphone or type below.</span>
                    <span className="font-mono font-bold text-primary">
                      {formatTime(questionTimeLeft)} remaining
                    </span>
                  </div>
                </div>

                {/* Speak / Record Toggle Card */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center min-h-[220px] gap-4">
                  <button
                    type="button"
                    onClick={handleToggleRecording}
                    className={`w-36 h-24 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                      isRecording
                        ? 'bg-rose-500/10 border-2 border-rose-500 text-rose-600 dark:text-rose-400 animate-pulse'
                        : 'bg-primary/10 border-2 border-primary text-primary hover:bg-primary/20 hover:scale-102'
                    }`}
                  >
                    <div className="text-center flex flex-col items-center gap-1.5">
                      {isRecording ? <Square className="w-7 h-7 fill-current" /> : <Mic className="w-7 h-7" />}
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {isRecording ? 'Stop Recording' : 'Speak Answer'}
                      </span>
                    </div>
                  </button>

                  <p className="text-xs text-muted-foreground font-medium tracking-wide">
                    {isRecording ? 'Capturing speech in real-time...' : 'Click to Speak (or type your response below)'}
                  </p>
                </div>
              </div>

              {/* Right Column: Spoken Answer & Evaluation Insight */}
              <div className="space-y-6">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col min-h-[220px]">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Your Spoken / Typed Response
                    </h2>
                    <span className="text-[11px] text-muted-foreground font-mono">Real-Time Transcription</span>
                  </div>

                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Your oral answer will transcribe here in real-time as you speak, or you may type directly..."
                    className="flex-1 w-full min-h-[120px] bg-muted/40 rounded-xl p-3.5 font-mono text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />

                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {transcript.trim().split(/\s+/).filter(Boolean).length} words
                    </span>

                    <button
                      type="button"
                      onClick={handleSubmitAnswer}
                      disabled={evaluating || !transcript.trim()}
                      className="h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {evaluating ? 'Grading...' : 'Submit Oral Answer'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* AI Grading Feedback */}
                {feedback && (
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Evaluation Insight
                      </h4>
                      {score !== null && (
                        <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-md text-xs border border-primary/20 font-mono">
                          Score: {score}/100
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{feedback}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STATE 3: COMPLETED ────────────────────────────────────────── */}
        {isCompleted && (
          <div className="bg-card p-12 rounded-2xl border border-border flex flex-col items-center shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Oral Viva Completed!</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your viva responses have been recorded and evaluated. Your faculty examiner will publish final certified grades shortly.
            </p>

            {score !== null && (
              <div className="p-4 rounded-xl bg-muted/40 border border-border inline-block font-mono text-sm font-bold text-foreground mt-2">
                Evaluated Score: {score}/100
              </div>
            )}

            <button
              type="button"
              onClick={handleLeave}
              className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* ── STATE 4: PAUSED ───────────────────────────────────────────── */}
        {isPaused && (
          <div className="bg-card p-12 rounded-2xl border border-amber-500/30 flex flex-col items-center shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Viva Session Temporarily Paused</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your faculty examiner has temporarily paused this viva session. Please remain on this screen. Your questions and timer will resume automatically once resumed.
            </p>
          </div>
        )}

        {/* ── STATE 5: ABSENT ───────────────────────────────────────────── */}
        {isAbsent && (
          <div className="bg-card p-12 rounded-2xl border border-rose-500/30 flex flex-col items-center shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Marked Absent</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This viva examination session has been recorded as absent. Please contact your faculty examiner or department coordinator.
            </p>
            <button
              type="button"
              onClick={handleLeave}
              className="mt-4 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* Bottom Bar: Leave Exam */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            AutoExam Institutional Oral Assessment Portal
          </span>
          <button
            type="button"
            onClick={handleLeave}
            className="px-5 py-2 bg-muted hover:bg-muted/80 border border-border rounded-xl text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
          >
            Leave Waiting Room
          </button>
        </div>

      </div>
    </div>
  );
}
