'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ShieldAlert, Clock, CheckCircle2, AlertTriangle, ArrowLeft,
  ArrowRight, Flag, Send, RefreshCw, Maximize2, Lock, Unlock, HelpCircle, KeyRound,
  LayoutGrid, X
} from 'lucide-react';

interface Question {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  bloom_level?: string;
}

export default function StudentMCQTakePage() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const examId = (routeParams?.id as string) || '';
  const urlPin = searchParams?.get('pin') || '';
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState('');
  
  // PIN verification state
  const [pinInput, setPinInput] = useState(urlPin);
  const [pinError, setPinError] = useState('');
  const [startingExam, setStartingExam] = useState(false);

  // Exam Data
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalMarks, setTotalMarks] = useState(100);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMobileNavigator, setShowMobileNavigator] = useState(false);

  // Student Responses
  const [answers, setAnswers] = useState<{ [qId: number]: string }>({});
  const [flagged, setFlagged] = useState<{ [qId: number]: boolean }>({});
  const [remainingSeconds, setRemainingSeconds] = useState(1800);

  // Anti-Cheat & Lockout State
  const [hasStarted, setHasStarted] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutCount, setLockoutCount] = useState(0);
  const [lockoutReason, setLockoutReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Refs for event listeners
  const isSubmittedRef = useRef(false);
  const isLockedOutRef = useRef(false);
  const attemptIdRef = useRef<number | null>(null);
  const answersRef = useRef<{ [qId: number]: string }>({});
  const startGraceUntilRef = useRef<number>(0);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    isLockedOutRef.current = isLockedOut;
  }, [isLockedOut]);

  // Auto-persist draft responses to localStorage on every change
  useEffect(() => {
    if (attemptId && Object.keys(answers).length > 0) {
      try {
        localStorage.setItem(`mcq_draft_${examId}_${attemptId}`, JSON.stringify({ answers, flagged }));
      } catch {}
    }
  }, [answers, flagged, attemptId, examId]);

  // Initialize Exam Session
  const initAttempt = async () => {
    setLoading(true);
    setInitError('');
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // 1. Fetch exam public metadata
      const examRes = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!examRes.ok) {
        const err = await examRes.json();
        throw new Error(err.detail || 'Exam not found');
      }
      const examData = await examRes.json();
      setSubjectName(examData.subject_name);
      setDurationMinutes(examData.duration_minutes);
      setTotalMarks(examData.total_marks);

      // 2. Attempt to start/resume if PIN was in URL or attempt was already registered
      const pinToUse = urlPin.trim();
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ access_pin: pinToUse || undefined })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.locked) {
          setAttemptId(data.attempt_id);
          attemptIdRef.current = data.attempt_id;
          setIsLockedOut(true);
          setLockoutCount(data.lockout_count || 1);
          setLockoutReason(data.message || 'Exam locked by anti-cheat');
          setLoading(false);
          return;
        }

        setAttemptId(data.attempt_id);
        attemptIdRef.current = data.attempt_id;
        setSubjectName(data.subject_name || examData.subject_name);
        setDurationMinutes(data.duration_minutes || examData.duration_minutes);
        setTotalMarks(data.total_marks || examData.total_marks);
        setQuestions(data.questions || []);
        setRemainingSeconds(data.remaining_seconds ?? (examData.duration_minutes * 60));

        if (data.saved_answers) {
          setAnswers(data.saved_answers);
        }

        // Restore local draft answers if available (network recovery)
        try {
          const rawDraft = localStorage.getItem(`mcq_draft_${examId}_${data.attempt_id}`);
          if (rawDraft) {
            const parsedDraft = JSON.parse(rawDraft);
            if (parsedDraft?.answers) {
              setAnswers(prev => ({ ...(data.saved_answers || {}), ...parsedDraft.answers }));
            }
            if (parsedDraft?.flagged) {
              setFlagged(parsedDraft.flagged);
            }
          }
        } catch {}
      } else {
        const err = await res.json();
        // If 403 because PIN is missing for a new attempt, stay on consent screen to let student input PIN
        if (res.status === 403 && err.detail?.toLowerCase().includes('pin')) {
          // Normal: prompt student for PIN on consent screen
        } else {
          throw new Error(err.detail || 'Failed to start examination');
        }
      }
    } catch (err: any) {
      setInitError(err.message || 'Failed to load test session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAttempt();
  }, [examId]);

  // Timer Countdown
  useEffect(() => {
    if (!hasStarted || isLockedOut || isSubmittedRef.current || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, isLockedOut, remainingSeconds]);

  // Anti-Cheat Lockout Trigger
  const triggerLockout = async (reason: string) => {
    if (isSubmittedRef.current || isLockedOutRef.current || !attemptIdRef.current) return;

    setIsLockedOut(true);
    isLockedOutRef.current = true;
    setLockoutReason(reason);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptIdRef.current}/lockout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        const data = await res.json();
        setLockoutCount(data.lockout_count || 1);
      }
    } catch (err) {
      console.error('Lockout notification failed', err);
    }
  };

  // Anti-Cheat Event Listeners (Tab change, Window Blur, Fullscreen Exit)
  useEffect(() => {
    if (!hasStarted || isSubmittedRef.current) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerLockout('Tab switch or window minimized');
      }
    };

    const handleWindowBlur = () => {
      // Grace period prevents false-positive lockout during initial fullscreen mode switch
      if (Date.now() < startGraceUntilRef.current) return;
      triggerLockout('Lost window focus: application switch detected');
    };

    const handleFullscreenChange = () => {
      if (Date.now() < startGraceUntilRef.current) return;
      if (!document.fullscreenElement && hasStarted && !isSubmittedRef.current) {
        triggerLockout('Fullscreen mode was exited');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'v', 'u', 'a', 'p', 's'].includes(e.key.toLowerCase())) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasStarted]);

  // Polling for Faculty Approval when Locked Out
  useEffect(() => {
    if (!isLockedOut || !attemptId) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.status === 'in_progress' && statusData.faculty_approved) {
            setIsLockedOut(false);
            isLockedOutRef.current = false;
            startGraceUntilRef.current = Date.now() + 2000;
            // Attempt to re-enter fullscreen
            try {
              if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error('Polling status error', err);
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [isLockedOut, attemptId]);

  // Request Fullscreen and Begin Test
  const handleStartExam = async () => {
    setPinError('');

    // If attempt has not been created or questions not yet loaded (e.g. direct URL visit):
    if (!attemptId || questions.length === 0) {
      if (!pinInput.trim()) {
        setPinError('Please enter the 6-digit exam access PIN to enter.');
        return;
      }
      setStartingExam(true);
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ access_pin: pinInput.trim() })
        });

        if (!res.ok) {
          const err = await res.json();
          setPinError(err.detail || 'Invalid exam access PIN.');
          setStartingExam(false);
          return;
        }

        const data = await res.json();
        if (data.locked) {
          setAttemptId(data.attempt_id);
          attemptIdRef.current = data.attempt_id;
          setIsLockedOut(true);
          setLockoutCount(data.lockout_count || 1);
          setLockoutReason(data.message || 'Exam locked');
          setStartingExam(false);
          return;
        }

        setAttemptId(data.attempt_id);
        attemptIdRef.current = data.attempt_id;
        setQuestions(data.questions || []);
        setRemainingSeconds(data.remaining_seconds ?? (durationMinutes * 60));
        if (data.saved_answers) {
          setAnswers(data.saved_answers);
        }

        // Restore local draft answers if available (network recovery)
        try {
          const rawDraft = localStorage.getItem(`mcq_draft_${examId}_${data.attempt_id}`);
          if (rawDraft) {
            const parsedDraft = JSON.parse(rawDraft);
            if (parsedDraft?.answers) {
              setAnswers(prev => ({ ...(data.saved_answers || {}), ...parsedDraft.answers }));
            }
            if (parsedDraft?.flagged) {
              setFlagged(parsedDraft.flagged);
            }
          }
        } catch {}
      } catch (err: any) {
        setPinError(err.message || 'Network error verifying exam PIN');
        setStartingExam(false);
        return;
      } finally {
        setStartingExam(false);
      }
    }

    startGraceUntilRef.current = Date.now() + 2500;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request bypassed:', err);
    }
    setHasStarted(true);
  };

  // Select Option with Instant Background Auto-Save
  const handleSelectOption = (option: string) => {
    if (isLockedOut || isSubmittedRef.current) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: option
    }));

    // Immediate background draft persistence to DB
    if (attemptIdRef.current) {
      const token = localStorage.getItem('access_token');
      fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptIdRef.current}/save-answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: currentQ.id,
          selected_option: option
        })
      }).catch(err => console.error('Draft autosave error:', err));
    }
  };

  const toggleFlag = (qId: number) => {
    setFlagged(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // Submit Exam
  const handleSubmitExam = async () => {
    if (!attemptId || isSubmittedRef.current) return;
    setIsSubmitting(true);
    isSubmittedRef.current = true;

    try {
      const token = localStorage.getItem('access_token');
      const answersPayload = questions.map(q => ({
        question_id: q.id,
        selected_option: answersRef.current[q.id] || null
      }));

      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers: answersPayload })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit exam');
      }

      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      // Clean up local autosave draft
      try {
        localStorage.removeItem(`mcq_draft_${examId}_${attemptId}`);
      } catch {}

      router.push(`/student/mcq/${attemptId}/result`);
    } catch (err: any) {
      alert(err.message || 'Submission error');
      setIsSubmitting(false);
      isSubmittedRef.current = false;
    }
  };

  const handleAutoSubmit = () => {
    handleSubmitExam();
  };

  // Format Timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Initializing secure examination session...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md w-full p-6 rounded-2xl border border-red-500/30 bg-card text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Examination Access Issue</h2>
          <p className="text-xs text-muted-foreground">{initError}</p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Pre-Exam Fullscreen Consent Screen
  if (!hasStarted && !isLockedOut) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-lg w-full p-8 rounded-2xl border border-border bg-card shadow-lg space-y-6">
          <div className="space-y-2">
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold border border-primary/20 uppercase tracking-wider">
              Secure Assessment Environment
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{subjectName}</h1>
            <p className="text-xs text-muted-foreground">
              Duration: {durationMinutes} Minutes | Questions: {questions.length} | Total Marks: {totalMarks}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Strict Anti-Cheat Proctoring Rules</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
              <li>This test must be completed in continuous fullscreen mode.</li>
              <li>Switching browser tabs, minimizing the window, or losing window focus will <strong>immediately lock your test</strong>.</li>
              <li>Once locked, you will not be able to continue until your faculty manually approves re-entry from the live monitor.</li>
              <li>Questions are randomly generated from the pool for each student.</li>
            </ul>
          </div>

          {/* Direct URL PIN Verification (when attempt not yet loaded) */}
          {(!attemptId || questions.length === 0) && (
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <KeyRound className="w-4 h-4 text-primary" />
                <span>Enter 6-Digit Exam Access PIN</span>
              </div>
              <input
                type="text"
                maxLength={10}
                value={pinInput}
                onChange={e => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="e.g. 849201"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-mono text-center text-lg tracking-widest font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
              />
              {pinError && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{pinError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Enter the access PIN provided by your faculty to unlock and start the exam session.
              </p>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={handleStartExam}
              disabled={startingExam}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {startingExam ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying PIN & Launching Test...
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  Enter Fullscreen & Begin Assessment
                </>
              )}
            </button>
            <button
              onClick={() => router.push('/student/dashboard')}
              className="text-xs text-muted-foreground hover:text-foreground text-center"
            >
              Cancel and return to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : null;
  const answeredCount = Object.keys(answers).length;

  return (
    <div 
      className="h-screen flex flex-col bg-background text-foreground select-none overflow-hidden relative"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
    >
      {/* FULLSCREEN LOCKOUT OVERLAY */}
      {isLockedOut && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/40 bg-card shadow-2xl text-center space-y-5 ring-1 ring-red-500/20">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-500/30 animate-pulse">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Examination Window Locked</h2>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Security Violation: {lockoutReason || 'Navigated away from active window'}
              </p>
              <span className="text-[11px] font-mono text-muted-foreground block mt-1">
                Total Violations Logged: {lockoutCount}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed text-left space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <HelpCircle className="w-4 h-4 text-primary" />
                <span>How to Resume Your Exam:</span>
              </div>
              <p className="text-[11px]">
                1. Inform your faculty/invigilator that your examination has locked out.
              </p>
              <p className="text-[11px]">
                2. Your faculty will verify your status on the Live Monitor and click <strong>Approve Re-entry</strong>.
              </p>
              <p className="text-[11px]">
                3. This screen is actively polling. As soon as re-entry is approved, your test will resume automatically.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-primary font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Waiting for faculty re-entry approval...</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Test Header Bar */}
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
            MCQ
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">{subjectName}</h1>
            <span className="text-[11px] text-muted-foreground">
              Question {currentIndex + 1} of {questions.length} ({answeredCount} answered)
            </span>
          </div>
        </div>

        {/* Center: Running Timer */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono font-bold text-sm ${
          remainingSeconds <= 300
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse'
            : 'bg-background text-foreground border-border'
        }`}>
          <Clock className="w-4 h-4 text-primary" />
          <span>{formatTime(remainingSeconds)}</span>
        </div>

        {/* Submit Exam Button */}
        <div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Finish & Submit Exam
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Active Question Card */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6 flex flex-col justify-between custom-scrollbar">
          {currentQ && (
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {/* Question Header & Stem */}
              <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    Question {currentIndex + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    {currentQ.bloom_level && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium border border-border">
                        {currentQ.bloom_level}
                      </span>
                    )}
                    <button
                      onClick={() => toggleFlag(currentQ.id)}
                      className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                        flagged[currentQ.id]
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                      title="Flag for review"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{flagged[currentQ.id] ? 'Flagged' : 'Flag'}</span>
                    </button>
                  </div>
                </div>

                <h2 className="text-base font-semibold text-foreground leading-relaxed">
                  {currentQ.question_text}
                </h2>
              </div>

              {/* 4 Option Cards */}
              <div className="space-y-3">
                {[
                  { key: 'A', text: currentQ.option_a },
                  { key: 'B', text: currentQ.option_b },
                  { key: 'C', text: currentQ.option_c },
                  { key: 'D', text: currentQ.option_d }
                ].map(opt => {
                  const isSelected = currentAnswer === opt.key;
                  return (
                    <div
                      key={opt.key}
                      onClick={() => handleSelectOption(opt.key)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30 text-foreground'
                          : 'border-border bg-card hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg font-mono font-bold flex items-center justify-center text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {opt.key}
                      </div>
                      <span className="text-sm font-medium leading-relaxed flex-1">
                        {opt.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Navigation Buttons */}
          <div className="max-w-3xl mx-auto w-full pt-4 border-t border-border flex items-center justify-between gap-2">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-3 md:px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Mobile Question Palette Opener */}
            <button
              type="button"
              onClick={() => setShowMobileNavigator(true)}
              className="md:hidden px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground flex items-center gap-1.5"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-primary" />
              <span>Palette ({currentIndex + 1}/{questions.length})</span>
            </button>

            <span className="hidden md:inline text-xs text-muted-foreground font-mono">
              {currentIndex + 1} / {questions.length}
            </span>

            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-3 md:px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

        {/* Mobile Question Navigator Bottom Sheet */}
        {showMobileNavigator && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowMobileNavigator(false)}
            />
            <div className="relative bg-card border-t border-border rounded-t-2xl p-5 max-h-[75vh] flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Question Palette ({answeredCount}/{questions.length} Answered)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileNavigator(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-5 gap-2.5">
                  {questions.map((q, idx) => {
                    const isAnswered = Boolean(answers[q.id]);
                    const isFlag = Boolean(flagged[q.id]);
                    const isCurrent = idx === currentIndex;

                    let btnClass = 'bg-background border-border text-muted-foreground';
                    if (isCurrent) {
                      btnClass = 'border-primary ring-2 ring-primary/20 text-primary font-bold';
                    } else if (isFlag) {
                      btnClass = 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold';
                    } else if (isAnswered) {
                      btnClass = 'bg-primary/15 border-primary/40 text-foreground font-semibold';
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setShowMobileNavigator(false);
                        }}
                        className={`h-10 rounded-lg border text-xs font-mono transition-all flex items-center justify-center relative ${btnClass}`}
                      >
                        {idx + 1}
                        {isFlag && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMobileNavigator(false)}
                className="w-full py-2.5 rounded-lg border border-border text-xs font-medium text-foreground bg-muted hover:bg-muted/80 transition"
              >
                Close Palette
              </button>
            </div>
          </div>
        )}

        {/* Right: Question Navigation Matrix */}
        <aside className="w-64 border-l border-border bg-card p-5 hidden md:flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Question Navigator
            </h3>

            {/* Grid of question buttons */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id]);
                const isFlag = Boolean(flagged[q.id]);
                const isCurrent = idx === currentIndex;

                let btnClass = 'bg-background border-border text-muted-foreground';
                if (isCurrent) {
                  btnClass = 'border-primary ring-2 ring-primary/20 text-primary font-bold';
                } else if (isFlag) {
                  btnClass = 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold';
                } else if (isAnswered) {
                  btnClass = 'bg-primary/15 border-primary/40 text-foreground font-semibold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg border text-xs font-mono transition-all flex items-center justify-center relative ${btnClass}`}
                  >
                    {idx + 1}
                    {isFlag && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-4 border-t border-border space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-primary/20 border border-primary/40"></span>
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-background border border-border"></span>
                <span>Unattempted ({questions.length - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40"></span>
                <span>Flagged for Review</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            Submit Final Assessment
          </button>
        </aside>
      </div>

      {/* CONFIRMATION SUBMIT MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card max-w-md w-full rounded-2xl border border-border p-6 shadow-xl space-y-5">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">Confirm Assessment Submission</h3>
              <p className="text-xs text-muted-foreground">
                You have answered <strong>{answeredCount} of {questions.length}</strong> questions.
                {questions.length - answeredCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 block mt-1">
                    Warning: You have {questions.length - answeredCount} unanswered questions remaining.
                  </span>
                )}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
              Once submitted, your answers will be evaluated immediately. You will not be able to re-enter this examination.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground"
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isSubmitting ? 'Evaluating...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

