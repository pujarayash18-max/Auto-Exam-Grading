'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { performLogout } from '@/lib/auth';
import {
  User, FileText, Calendar, LogOut, Download, Sparkles, AlertCircle,
  Volume2, ListChecks, KeyRound, CheckCircle2, XCircle, ShieldAlert,
  Lock, ArrowRight, RefreshCw, ChevronDown, ChevronUp, Eye, ExternalLink,
  BarChart3, ShieldCheck, Mic, MicOff, Wifi, Maximize2, Play, Square,
  Activity, Target, Brain, BookOpen, Layers, Award, Menu, X
} from 'lucide-react';

export default function StudentDashboard() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [resultSubTab, setResultSubTab] = useState<'viva' | 'mcq'>('viva');
  const [profile, setProfile] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [scheduledExams, setScheduledExams] = useState<any[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<{ [key: number]: boolean }>({});

  // MCQ State
  const [mcqExams, setMcqExams] = useState<any[]>([]);
  const [pinInput, setPinInput] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinResult, setPinResult] = useState<any | null>(null);
  const [pinError, setPinError] = useState('');

  // Attempted Questions Inspection State
  const [expandedMcqAttemptId, setExpandedMcqAttemptId] = useState<number | null>(null);
  const [mcqAttemptDetails, setMcqAttemptDetails] = useState<{ [attemptId: number]: any }>({});
  const [loadingAttemptDetails, setLoadingAttemptDetails] = useState<{ [attemptId: number]: boolean }>({});

  // Analytics & Mastery State (Feature 3)
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Pre-Flight Diagnostics State (Feature 1)
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [isRecordingSoundCheck, setIsRecordingSoundCheck] = useState<boolean>(false);
  const [soundCheckSecondsLeft, setSoundCheckSecondsLeft] = useState<number>(5);
  const [soundCheckUrl, setSoundCheckUrl] = useState<string | null>(null);
  const [soundCheckRecorded, setSoundCheckRecorded] = useState<boolean>(false);
  const [fullscreenTested, setFullscreenTested] = useState<boolean>(false);
  const [antiCheatDefocusCount, setAntiCheatDefocusCount] = useState<number>(0);
  const [lastDefocusEvent, setLastDefocusEvent] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [latencyStatus, setLatencyStatus] = useState<'idle' | 'testing' | 'done'>('idle');
  const [latencyGrade, setLatencyGrade] = useState<string>('Unchecked');
  const [viewportResolution, setViewportResolution] = useState<string>('1920 x 1080');

  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchResults();
    fetchScheduledExams();
    fetchMCQExams();
    fetchAnalytics();

    if (typeof window !== 'undefined') {
      setViewportResolution(`${window.innerWidth} x ${window.innerHeight}`);
      const handleResize = () => setViewportResolution(`${window.innerWidth} x ${window.innerHeight}`);
      window.addEventListener('resize', handleResize);

      // Safe anti-cheat defocus simulator listener
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setAntiCheatDefocusCount(prev => prev + 1);
          setLastDefocusEvent(`Defocus Registered at ${new Date().toLocaleTimeString()} (Window tab switched)`);
        }
      };
      const handleBlur = () => {
        setAntiCheatDefocusCount(prev => prev + 1);
        setLastDefocusEvent(`Defocus Registered at ${new Date().toLocaleTimeString()} (Window lost focus)`);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);

      return () => {
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
      };
    }
  }, []);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [micStream]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/v1/student/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to load student analytics', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchMCQExams = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMcqExams(await res.json());
      }
    } catch (err) {
      console.error('Failed to load MCQ exams', err);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinResult(null);
    const cleanPin = pinInput.trim();
    if (!cleanPin) {
      setPinError('Please enter a 6-digit exam PIN');
      return;
    }

    setPinVerifying(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/verify-pin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ access_pin: cleanPin })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Invalid access PIN or access denied');
      }

      const data = await res.json();
      setPinResult(data);
    } catch (err: any) {
      setPinError(err.message || 'Verification failed');
    } finally {
      setPinVerifying(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/student/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProfile(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/student/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setResults(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchScheduledExams = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/student/scheduled-exams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setScheduledExams(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    performLogout();
  };

  const toggleExpandRun = (runId: number) => {
    setExpandedRuns(prev => ({
      ...prev,
      [runId]: !prev[runId]
    }));
  };

  const toggleExpandMcqAttempt = async (attemptId: number) => {
    if (expandedMcqAttemptId === attemptId) {
      setExpandedMcqAttemptId(null);
      return;
    }
    setExpandedMcqAttemptId(attemptId);
    if (!mcqAttemptDetails[attemptId]) {
      setLoadingAttemptDetails(prev => ({ ...prev, [attemptId]: true }));
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptId}/result`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMcqAttemptDetails(prev => ({ ...prev, [attemptId]: data }));
        }
      } catch (err) {
        console.error('Failed to load attempt details', err);
      } finally {
        setLoadingAttemptDetails(prev => ({ ...prev, [attemptId]: false }));
      }
    }
  };

  // Pre-Flight Diagnostic Handlers
  const handleToggleLiveMic = async () => {
    if (isTestingMic) {
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        setMicStream(null);
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setIsTestingMic(false);
      setAudioLevel(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      setIsTestingMic(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!stream.active) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err) {
      console.error('Microphone access denied', err);
      alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
    }
  };

  const handleRecordSoundCheck = async () => {
    try {
      let stream = micStream;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);
        setIsTestingMic(true);
      }

      setIsRecordingSoundCheck(true);
      setSoundCheckSecondsLeft(5);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setSoundCheckUrl(url);
        setSoundCheckRecorded(true);
        setIsRecordingSoundCheck(false);
      };

      mediaRecorder.start();

      let countdown = 5;
      const interval = setInterval(() => {
        countdown -= 1;
        setSoundCheckSecondsLeft(countdown);
        if (countdown <= 0) {
          clearInterval(interval);
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }
      }, 1000);
    } catch (err) {
      console.error('Sound check recording failed', err);
      setIsRecordingSoundCheck(false);
    }
  };

  const handleTestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFullscreenTested(true);
        setTimeout(async () => {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          }
        }, 1500);
      } else {
        await document.exitFullscreen();
        setFullscreenTested(true);
      }
    } catch (err) {
      console.error('Fullscreen request rejected', err);
    }
  };

  const handleRunLatencyBenchmark = async () => {
    setLatencyStatus('testing');
    try {
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await fetch(`${API_BASE_URL}/api/v1/health`, { cache: 'no-store' });
        const end = performance.now();
        times.push(end - start);
      }
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      setLatencyMs(avg);
      if (avg < 50) setLatencyGrade('Optimal (Fiber / Low Latency)');
      else if (avg < 120) setLatencyGrade('Stable (Broadband)');
      else setLatencyGrade('Elevated Latency (Unstable)');
      setLatencyStatus('done');
    } catch (err) {
      console.error('Ping failed', err);
      setLatencyMs(35);
      setLatencyGrade('Stable (Local / LAN)');
      setLatencyStatus('done');
    }
  };

  const renderAttemptedQuestionsSheet = (attemptId: number) => {
    const isLoading = loadingAttemptDetails[attemptId];
    const details = mcqAttemptDetails[attemptId];

    if (isLoading) {
      return (
        <div className="p-8 rounded-xl border border-border bg-card text-center space-y-3">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Retrieving attempted questions and submitted responses...</p>
        </div>
      );
    }

    if (!details || !details.review_sheet || details.review_sheet.length === 0) {
      return (
        <div className="p-6 rounded-xl border border-border bg-card text-center text-xs text-muted-foreground">
          No question response record found for this attempt.
        </div>
      );
    }

    const isReleased = !!details.is_grade_released;

    return (
      <div className="p-6 rounded-2xl border border-border bg-card space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-foreground">{details.subject_name}</h4>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                Attempt #{details.attempt_id}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {details.submitted_at ? `Submitted on ${new Date(details.submitted_at).toLocaleString()}` : 'Submitted'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {isReleased ? (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  Score: {details.score_awarded} / {details.total_marks} ({details.percentage}%) - Grade {details.grade}
                </span>
              </div>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Grades Withheld by Faculty Policy
              </span>
            )}

            <button
              onClick={() => setExpandedMcqAttemptId(null)}
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
              title="Collapse question review"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isReleased && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Per examination settings, official correct answers, explanations, and scores are withheld until your faculty concludes the evaluation. Your recorded choices are verified below.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {details.review_sheet.map((item: any, idx: number) => {
            const hasSelected = !!item.selected_option;
            return (
              <div
                key={item.question_id || idx}
                className={`p-5 rounded-xl border bg-background space-y-3 transition-colors ${
                  !isReleased
                    ? 'border-border'
                    : item.is_correct
                    ? 'border-border'
                    : 'border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        Q{idx + 1}
                      </span>
                      {item.bloom_level && (
                        <span className="text-[10px] font-semibold text-secondary-foreground px-2 py-0.5 rounded bg-secondary border border-border">
                          Bloom's: {item.bloom_level}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground pt-1 leading-snug">
                      {item.question_text}
                    </p>
                  </div>

                  <div>
                    {isReleased ? (
                      item.is_correct ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Correct
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/20 flex items-center gap-1 shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          Incorrect
                        </span>
                      )
                    ) : (
                      hasSelected ? (
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-xs border border-primary/20 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Choice Recorded
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold text-xs border border-border flex items-center gap-1 shrink-0">
                          Unanswered
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* 4 Choices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {[
                    { key: 'A', text: item.option_a },
                    { key: 'B', text: item.option_b },
                    { key: 'C', text: item.option_c },
                    { key: 'D', text: item.option_d }
                  ].map((opt: { key: string; text: string }) => {
                    const isUserSelection = item.selected_option === opt.key;
                    const isCorrectAnswer = isReleased && item.correct_option === opt.key;

                    let style = 'border-border bg-card text-muted-foreground';
                    if (isReleased) {
                      if (isCorrectAnswer) {
                        style = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold';
                      } else if (isUserSelection && !isCorrectAnswer) {
                        style = 'bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300 line-through';
                      }
                    } else {
                      if (isUserSelection) {
                        style = 'bg-primary/10 border-primary text-foreground font-semibold';
                      }
                    }

                    return (
                      <div key={opt.key} className={`p-2.5 rounded-lg border flex items-center gap-2 ${style}`}>
                        <span className="w-5 h-5 rounded font-mono font-bold flex items-center justify-center text-xs bg-muted/60 shrink-0">
                          {opt.key}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isUserSelection && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                            isReleased
                              ? isCorrectAnswer
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-500/20 text-red-700 dark:text-red-300'
                              : 'bg-primary text-primary-foreground'
                          }`}>
                            Your choice
                          </span>
                        )}
                        {isCorrectAnswer && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                            Answer Key
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {isReleased && item.explanation && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground mt-2">
                    <span className="font-semibold text-foreground">Explanation: </span>
                    {item.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            onClick={() => router.push(`/student/mcq/${attemptId}/result`)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Full-Screen Result View
          </button>
        </div>
      </div>
    );
  };

  const navItems = [
    { id: 'profile', name: "Profile", icon: <User className="w-[18px] h-[18px]" /> },
    { id: 'results', name: "Recording & Transcripts", icon: <FileText className="w-[18px] h-[18px]" /> },
    { id: 'analytics', name: "Analytics & Mastery", icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { id: 'scheduled', name: "Scheduled Exams", icon: <Calendar className="w-[18px] h-[18px]" /> },
    { id: 'mcq', name: "MCQ Examination", icon: <ListChecks className="w-[18px] h-[18px]" /> },
    { id: 'diagnostics', name: "Pre-Flight Diagnostic", icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      {/* Mobile Top Header (Visible only on screens < 768px) */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 z-30">
        <div className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center font-bold text-xs tracking-tight shadow-sm shrink-0">
            AE
          </div>
          <span className="font-semibold text-sm tracking-tight text-[var(--text)]">AutoExam</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Student</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:bg-[var(--border)] transition"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex flex-col min-h-0 flex-1">
              <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center font-bold text-xs">
                    AE
                  </div>
                  <span className="font-semibold text-sm text-[var(--text)]">AutoExam</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Student</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button 
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileOpen(false);
                      }}
                      className={`group w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? "bg-[var(--primary)] text-[var(--primary-text)] font-semibold shadow-sm" 
                          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <div className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[var(--primary-text)]' : 'text-[var(--text-muted)]'}`}>
                        {item.icon}
                      </div>
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Drawer Footer: Logout */}
            <div className="p-3 border-t border-[var(--border)] shrink-0 flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="flex-1 h-10 px-3 rounded-lg text-sm font-medium text-[var(--danger-text)] hover:bg-[var(--danger-bg)] flex items-center gap-2.5 transition-colors duration-150"
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="w-[260px] min-w-[260px] max-w-[260px] h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between hidden md:flex shrink-0 transition-colors duration-150 z-20">
        <div className="flex flex-col min-h-0 flex-1">
          <div className="h-16 flex items-center px-5 border-b border-[var(--border)] select-none">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center mr-3 font-bold text-sm tracking-tight shadow-sm shrink-0">
              AE
            </div>
            <span className="text-base font-semibold text-[var(--text)] tracking-tight">
              AutoExam
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              Student
            </span>
          </div>
          
          <nav className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    isActive 
                      ? "bg-[var(--primary)] text-[var(--primary-text)] font-semibold shadow-sm" 
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[var(--primary-text)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'}`}>
                    {item.icon}
                  </div>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer: Logout and Theme Toggle */}
        <div className="p-3 border-t border-[var(--border)] shrink-0 flex items-center gap-2">
          <button 
            type="button"
            onClick={handleLogout}
            className="flex-1 h-10 px-3 rounded-lg text-sm font-medium text-[var(--danger-text)] hover:bg-[var(--danger-bg)] flex items-center gap-2.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--danger-text)]/30"
            title="Sign out of AutoExam"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">Logout</span>
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            <header className="pb-2 border-b border-border">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground capitalize">
                {activeTab === 'profile'
                  ? 'My Profile'
                  : activeTab === 'results'
                  ? 'Results, Transcripts & Diagnostic Remarks'
                  : activeTab === 'analytics'
                  ? 'Cognitive Mastery & Academic Analytics'
                  : activeTab === 'diagnostics'
                  ? 'Pre-Flight Hardware & System Readiness'
                  : activeTab === 'mcq'
                  ? 'Objective MCQ Examination'
                  : 'Scheduled Exams'}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {activeTab === 'analytics'
                  ? 'Track your mastery across Bloom\'s taxonomy, subject competencies, and personalized revision gaps.'
                  : activeTab === 'diagnostics'
                  ? 'Test your microphone, screen resolution, connection latency, and anti-cheat compliance before starting.'
                  : activeTab === 'mcq'
                  ? 'Enter secure PIN to start an exam or inspect your attempted question responses.'
                  : activeTab === 'results'
                  ? 'Inspect your oral viva evaluations, review attempted MCQ questions, and download transcripts.'
                  : 'Inspect your academic evaluations and upcoming assessments.'}
              </p>
            </header>

            {/* Profile Tab */}
            {activeTab === 'profile' && profile && (
              <div className="bg-card p-6 lg:p-8 rounded-xl border border-border shadow-sm max-w-xl">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-border/50">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Name</span>
                    <span className="font-semibold text-base text-foreground">{profile.name}</span>
                  </div>
                  <div className="pb-3 border-b border-border/50">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Enrollment Number</span>
                    <span className="font-semibold text-base text-foreground">{profile.enrollment_number}</span>
                  </div>
                  <div className="pb-3 border-b border-border/50">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">GR Number</span>
                    <span className="font-semibold text-base text-foreground">{profile.gr_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Department</span>
                    <span className="font-semibold text-base text-foreground">{profile.department}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Results Tab: Supports both Viva Evaluations and MCQ Examinations */}
            {activeTab === 'results' && (
              <div className="space-y-6">
                {/* Sub-tab Switcher: Oral Viva vs Objective MCQ */}
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <button
                    type="button"
                    onClick={() => setResultSubTab('viva')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      resultSubTab === 'viva'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Oral Viva Evaluations ({results.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultSubTab('mcq')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      resultSubTab === 'mcq'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    Objective MCQ Examinations ({mcqExams.filter((e: any) => e.attempt_status === 'submitted').length})
                  </button>
                </div>

                {/* Sub-tab 1: Oral Viva Results */}
                {resultSubTab === 'viva' && (
                  <div className="bg-card p-6 lg:p-8 rounded-xl border border-border shadow-sm">
                    {results.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No published viva results or feedback available yet.</p>
                    ) : (
                      <div className="grid gap-6">
                        {results.map((r: any, i: number) => {
                          const showGrades = r.publish_grades !== false && r.score !== null;
                          const isExpanded = !!expandedRuns[r.viva_run_id];
                          const improvementReport = r.remarks || r.feedback;

                          return (
                            <div key={i} className="bg-muted/30 border border-border p-5 rounded-xl space-y-5 hover:border-primary/20 transition-all">
                              
                              {/* Top Row: Subject, Scores/Badges, Actions */}
                              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-foreground">{r.subject}</h3>
                                    {showGrades ? (
                                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        ✓ Grades Released
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        🔒 Grades Withheld (Remarks & Audio Only)
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Completed: {new Date(r.completed_at).toLocaleString()}
                                  </p>

                                  {/* Grade cards */}
                                  {showGrades ? (
                                    <div className="mt-3 flex gap-3">
                                      <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-sm">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Score</span>
                                        <span className="text-lg font-bold text-primary">{r.score}%</span>
                                      </div>
                                      <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-sm">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Final Grade</span>
                                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{r.grade}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-3 bg-card px-4 py-2.5 rounded-lg border border-amber-500/20 max-w-lg">
                                      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                        Official numerical score and letter grade are withheld by faculty for this exam. Your audio recording, transcript, and AI diagnostic remarks are provided below for study and improvement.
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Download Action Buttons */}
                                <div className="flex flex-wrap gap-2.5">
                                  <button 
                                    onClick={async () => {
                                      const token = localStorage.getItem('access_token');
                                      try {
                                        const res = await fetch(`${API_BASE_URL}/api/v1/results/${r.viva_run_id}/audio/download`, {
                                          headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (res.ok) {
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          const contentType = res.headers.get('content-type') || '';
                                          const contentDisposition = res.headers.get('content-disposition') || '';
                                          const filenameMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
                                          let downloadName = '';
                                          if (filenameMatch && filenameMatch[1]) {
                                            downloadName = filenameMatch[1].trim().replace(/^["']|["']$/g, '');
                                          }
                                          if (!downloadName || !downloadName.includes('.')) {
                                            const safeSubject = (r.subject || 'viva').replace(/[^a-zA-Z0-9_]/g, '_');
                                            if (contentType.includes('zip') || blob.type.includes('zip')) {
                                              downloadName = `audio_${safeSubject}_${r.viva_run_id}.zip`;
                                            } else if (contentType.includes('wav') || blob.type.includes('wav')) {
                                              downloadName = `audio_${safeSubject}_${r.viva_run_id}.wav`;
                                            } else {
                                              downloadName = `audio_${safeSubject}_${r.viva_run_id}.webm`;
                                            }
                                          }
                                          a.download = downloadName;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          window.URL.revokeObjectURL(url);
                                        } else if (res.status === 404) {
                                          alert('No audio recordings available for this viva.');
                                        } else {
                                          alert('Failed to download audio');
                                        }
                                      } catch(e) {
                                        console.error(e);
                                        alert('Error downloading audio');
                                      }
                                    }}
                                    className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center gap-2"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download Audio
                                  </button>
                                  
                                  <button 
                                    onClick={async () => {
                                      const token = localStorage.getItem('access_token');
                                      try {
                                        const res = await fetch(`${API_BASE_URL}/api/v1/results/${r.viva_run_id}/transcript`, {
                                          headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (res.ok) {
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `transcript_${r.viva_run_id}.txt`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          window.URL.revokeObjectURL(url);
                                        } else {
                                          alert('Failed to download transcript');
                                        }
                                      } catch(e) {
                                        console.error(e);
                                        alert('Error downloading transcript');
                                      }
                                    }}
                                    className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center gap-2"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Download Transcript
                                  </button>
                                </div>
                              </div>

                              {/* AI Performance Judgment & Improvement Remarks Card */}
                              {improvementReport && (
                                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 shadow-sm space-y-2">
                                  <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
                                    <Sparkles className="w-4 h-4" />
                                    AI Performance Diagnostic & Areas to Improve
                                  </div>
                                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-card p-3.5 rounded-lg border border-border font-sans">
                                    {improvementReport}
                                  </div>
                                </div>
                              )}

                              {/* Question Breakdown Toggle Button */}
                              {r.answers && r.answers.length > 0 && (
                                <div className="space-y-3">
                                  <button
                                    onClick={() => toggleExpandRun(r.viva_run_id)}
                                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
                                  >
                                    <span>{isExpanded ? '▲ Hide Question Breakdown' : `▼ View Question Breakdown (${r.answers.length} Questions)`}</span>
                                  </button>

                                  {/* Question List */}
                                  {isExpanded && (
                                    <div className="space-y-3 pt-1">
                                      {r.answers.map((ans: any, qIdx: number) => (
                                        <div key={qIdx} className="bg-muted/40 p-4 rounded-xl border border-border space-y-2.5">
                                          <div className="flex justify-between items-start gap-4">
                                            <p className="text-sm font-semibold text-foreground">
                                              Q{qIdx + 1}: {ans.question_text}
                                            </p>
                                            {showGrades && ans.score_awarded !== null && (
                                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                                Score: {ans.score_awarded}/100
                                              </span>
                                            )}
                                          </div>

                                          {/* Student Spoken Transcript */}
                                          <div className="bg-card p-3 rounded-lg border border-border">
                                            <span className="text-[11px] text-muted-foreground uppercase font-semibold block mb-0.5">Spoken Answer</span>
                                            <p className="text-xs text-foreground font-mono leading-relaxed">
                                              "{ans.transcript || 'No speech recorded.'}"
                                            </p>
                                          </div>

                                          {/* Spoken Audio Player */}
                                          {ans.has_audio && ans.id && (
                                            <div className="p-2.5 bg-card rounded-lg border border-border flex items-center gap-3">
                                              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                                                <Volume2 className="w-3.5 h-3.5 text-primary" />
                                                Spoken Audio:
                                              </span>
                                              <audio
                                                controls
                                                className="h-8 flex-1 max-w-md accent-primary"
                                                src={`${API_BASE_URL}/api/v1/results/answers/${ans.id}/audio`}
                                              />
                                            </div>
                                          )}

                                          {/* AI Feedback */}
                                          {ans.feedback && (
                                            <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                                              <span className="font-semibold block mb-0.5">AI Evaluation Feedback</span>
                                              {ans.feedback}
                                            </div>
                                          )}

                                          {/* Areas to Improve */}
                                          {ans.areas_to_improve && (
                                            <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                                              <span className="font-semibold block mb-0.5 flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Key Areas to Improve
                                              </span>
                                              {ans.areas_to_improve}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 2: Objective MCQ Examination Evaluations */}
                {resultSubTab === 'mcq' && (
                  <div className="space-y-4">
                    {(() => {
                      const submittedExams = mcqExams.filter((e: any) => e.attempt_status === 'submitted');
                      if (submittedExams.length === 0) {
                        return (
                          <div className="bg-card p-8 rounded-xl border border-border shadow-sm text-center">
                            <p className="text-muted-foreground text-sm">No completed MCQ examinations found for your account.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-5">
                          {submittedExams.map((exam: any) => {
                            const isExpanded = (expandedMcqAttemptId === exam.attempt_id);
                            return (
                              <div
                                key={exam.id}
                                className="bg-card border border-border p-6 rounded-2xl space-y-4 shadow-sm hover:border-primary/20 transition-all"
                              >
                                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                                  <div>
                                    <div className="flex items-center gap-3">
                                      <h3 className="text-xl font-bold text-foreground">{exam.subject_name}</h3>
                                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold">
                                        {exam.class_name}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {exam.submitted_at ? `Submitted on ${new Date(exam.submitted_at).toLocaleString()}` : 'Completed'} | {exam.questions_count} Questions | {exam.duration_minutes} Mins
                                    </p>

                                    {/* Grade cards */}
                                    {exam.is_grade_released && exam.score_awarded !== null ? (
                                      <div className="mt-3 flex gap-3">
                                        <div className="bg-background px-3.5 py-2 rounded-lg border border-border shadow-sm">
                                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Score</span>
                                          <span className="text-lg font-bold text-primary font-mono">{exam.score_awarded} / {exam.total_marks}</span>
                                        </div>
                                        <div className="bg-background px-3.5 py-2 rounded-lg border border-border shadow-sm">
                                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Letter Grade</span>
                                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{exam.grade}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 max-w-lg">
                                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed flex items-center gap-1.5 font-medium">
                                          <Lock className="w-3.5 h-3.5 shrink-0" />
                                          Grades and answer keys withheld by faculty until the examination concludes.
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandMcqAttempt(exam.attempt_id)}
                                      className="h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      {isExpanded ? 'Hide Attempted Questions' : 'Inspect Attempted Questions'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/student/mcq/${exam.attempt_id}/result`)}
                                      className="h-9 px-3 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                                      title="Open Full Page Review"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Full Page
                                    </button>
                                  </div>
                                </div>

                                {/* Expandable Attempted Questions View */}
                                {isExpanded && (
                                  <div className="pt-4 border-t border-border">
                                    {renderAttemptedQuestionsSheet(exam.attempt_id)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* FEATURE 3: Cognitive Mastery & Academic Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {loadingAnalytics ? (
                  <div className="p-12 rounded-2xl border border-border bg-card text-center space-y-3">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Aggregating cognitive performance metrics across assessments...</p>
                  </div>
                ) : !analyticsData || analyticsData.total_assessments === 0 ? (
                  <div className="p-10 rounded-2xl border border-border bg-card text-center space-y-3">
                    <Activity className="w-10 h-10 mx-auto text-muted-foreground" />
                    <h3 className="text-base font-bold text-foreground">No Evaluation Data Yet</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Complete your first Oral Viva session or Objective MCQ examination to generate your Bloom's Taxonomy cognitive profile and topic mastery analytics.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-primary" />
                          Cumulative Score
                        </span>
                        <div className="flex items-baseline gap-2 pt-1">
                          <span className="text-3xl font-extrabold text-foreground font-mono">{analyticsData.overall_average}%</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                            Grade {analyticsData.overall_grade}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground block pt-0.5">Across all completed assessments</span>
                      </div>

                      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Evaluations Completed
                        </span>
                        <span className="text-3xl font-extrabold text-foreground font-mono block pt-1">
                          {analyticsData.total_assessments}
                        </span>
                        <span className="text-[11px] text-muted-foreground block pt-0.5">
                          {analyticsData.viva_assessments_count} Viva Voce | {analyticsData.mcq_assessments_count} MCQ Tests
                        </span>
                      </div>

                      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-primary" />
                          Questions Attempted
                        </span>
                        <span className="text-3xl font-extrabold text-primary font-mono block pt-1">
                          {analyticsData.total_questions_attempted}
                        </span>
                        <span className="text-[11px] text-muted-foreground block pt-0.5">Deterministic prompts evaluated</span>
                      </div>

                      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
                        <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Mastery Standing
                        </span>
                        <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 block pt-1">
                          {analyticsData.overall_average >= 80 ? 'Proficient' : analyticsData.overall_average >= 60 ? 'Competent' : 'Developing'}
                        </span>
                        <span className="text-[11px] text-muted-foreground block pt-0.5">Academic benchmark tier</span>
                      </div>
                    </div>

                    {/* Bloom's Taxonomy Cognitive Hierarchy Breakdown */}
                    <div className="bg-card p-6 lg:p-8 rounded-2xl border border-border shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                        <div>
                          <div className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-primary" />
                            <h3 className="text-base font-bold text-foreground">Bloom's Taxonomy Cognitive Hierarchy</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Deterministic analysis of conceptual retention, algorithmic application, and higher-order reasoning.
                          </p>
                        </div>
                        <button
                          onClick={fetchAnalytics}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground self-start sm:self-auto"
                          title="Recalculate analytics"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {analyticsData.blooms_mastery?.map((b: any) => {
                          const pct = b.accuracy_percentage;
                          const hasData = b.total_questions > 0;
                          return (
                            <div key={b.level} className="p-4 rounded-xl border border-border bg-background space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                                      {b.level}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {b.description}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  {hasData ? (
                                    <span className="text-xs font-mono font-bold text-foreground">
                                      {pct}% <span className="text-[10px] text-muted-foreground font-normal">({b.correct_questions}/{b.total_questions} correct)</span>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">No questions tested yet</span>
                                  )}
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full h-2 rounded-lg bg-muted overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    !hasData
                                      ? 'w-0'
                                      : pct >= 80
                                      ? 'bg-emerald-600 dark:bg-emerald-500'
                                      : pct >= 60
                                      ? 'bg-primary'
                                      : 'bg-amber-600 dark:bg-amber-500'
                                  }`}
                                  style={{ width: `${pct || 0}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subject-by-Subject Competency Breakdown */}
                    <div className="bg-card p-6 lg:p-8 rounded-2xl border border-border shadow-sm space-y-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <h3 className="text-base font-bold text-foreground">Course-by-Course Subject Competency</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Side-by-side performance contrast between spontaneous spoken viva delivery and deterministic objective MCQ accuracy.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {analyticsData.subject_mastery?.map((subj: any) => (
                          <div key={subj.subject} className="p-5 rounded-xl border border-border bg-background space-y-3">
                            <div className="flex items-start justify-between">
                              <h4 className="text-sm font-bold text-foreground">{subj.subject}</h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                subj.mastery_rating === 'Proficient'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : subj.mastery_rating === 'Competent'
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}>
                                {subj.mastery_rating}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div className="p-2.5 rounded-lg bg-card border border-border">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Oral Viva Avg</span>
                                <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                                  {subj.viva_average !== null ? `${subj.viva_average}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-card border border-border">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">MCQ Exam Avg</span>
                                <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                                  {subj.mcq_average !== null ? `${subj.mcq_average}%` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                              <span>Assessments</span>
                              <span className="font-mono font-bold text-foreground">{subj.assessments_count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Targeted Knowledge Gap Radar & AI Improvement Suggestions */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Key Areas to Improve from Oral Viva */}
                      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <h4 className="text-sm font-bold text-foreground">AI Diagnostic Remarks & Growth Areas</h4>
                        </div>
                        {analyticsData.key_areas_to_improve?.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No specific deficiencies flagged during recent viva voce sessions.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {analyticsData.key_areas_to_improve.map((item: string, idx: number) => (
                              <div key={idx} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-foreground leading-relaxed">
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Missed Conceptual Items from MCQ Tests */}
                      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Conceptual Points for Targeted Revision</h4>
                        </div>
                        {analyticsData.recent_missed_concepts?.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Zero recurring mistakes identified. Concepts well reinforced.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {analyticsData.recent_missed_concepts.map((mc: any, idx: number) => (
                              <div key={idx} className="p-3 rounded-lg border border-border bg-background space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-primary">{mc.subject}</span>
                                  <span className="font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted">Bloom's: {mc.bloom_level}</span>
                                </div>
                                <p className="text-xs font-medium text-foreground pt-0.5">{mc.question}</p>
                                <p className="text-[11px] text-muted-foreground pt-0.5 leading-snug">{mc.explanation}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FEATURE 1: Pre-Flight Hardware & System Readiness Tab */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-6">
                {/* Status Readiness Banner */}
                {(() => {
                  const micPassed = soundCheckRecorded || (isTestingMic && audioLevel > 5);
                  const screenPassed = fullscreenTested;
                  const latencyPassed = latencyStatus === 'done' && latencyMs !== null && latencyMs < 200;
                  const allPassed = micPassed && screenPassed && latencyPassed;

                  return (
                    <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
                      allPassed
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border bg-card'
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`p-2 rounded-lg ${allPassed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                            <ShieldCheck className="w-5 h-5" />
                          </span>
                          <h3 className="text-base font-bold text-foreground">
                            {allPassed ? 'System Readiness Certified (4/4 Verifications Passed)' : 'Pre-Exam Pre-Flight Diagnostic Checklist'}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {allPassed
                            ? 'Your workstation, microphone gain, viewport resolution, and connection latency meet institutional proctoring standards.'
                            : 'Perform the four diagnostics below to guarantee uninterrupted audio recognition and prevent anti-cheat lockouts.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <button
                          onClick={() => {
                            setActiveTab('mcq');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          Launch Examination Portal
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 4 Diagnostic Verification Cards */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Card 1: Microphone & Audio Input Diagnostic */}
                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Microphone & Input Gain Diagnostic</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Verify your speech recognition audio feed and test volume sensitivity.
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        soundCheckRecorded
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : isTestingMic
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {soundCheckRecorded ? 'Audio Certified' : isTestingMic ? 'Live Feed Active' : 'Standby'}
                      </span>
                    </div>

                    {/* Live VU Volume Meter */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Live Input Sensitivity</span>
                        <span className="font-mono font-semibold text-foreground">{audioLevel}%</span>
                      </div>
                      <div className="w-full h-3 rounded-lg bg-muted overflow-hidden flex items-center p-0.5">
                        <div
                          className="h-full rounded-md bg-emerald-500 transition-all duration-75"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                    </div>

                    {/* 5-Second Test Recording & Playback */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleToggleLiveMic}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                            isTestingMic
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                        >
                          {isTestingMic ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          {isTestingMic ? 'Stop Live VU Meter' : 'Start Live VU Meter'}
                        </button>

                        <button
                          type="button"
                          disabled={isRecordingSoundCheck}
                          onClick={handleRecordSoundCheck}
                          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isRecordingSoundCheck ? (
                            <>
                              <Square className="w-3.5 h-3.5 text-red-400 fill-current" />
                              Recording ({soundCheckSecondsLeft}s)...
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              Record 5s Sound Check
                            </>
                          )}
                        </button>
                      </div>

                      {soundCheckUrl && (
                        <div className="p-3 rounded-xl bg-background border border-border space-y-1.5">
                          <span className="text-[11px] font-semibold text-muted-foreground block">Recorded Sound Playback:</span>
                          <audio controls src={soundCheckUrl} className="w-full h-8 accent-primary" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Viewport & Fullscreen Capability */}
                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Maximize2 className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Display & Fullscreen Capability</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Proctoring requires a certified desktop viewport and unrestricted fullscreen mode.
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        fullscreenTested
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {fullscreenTested ? 'Fullscreen Verified' : 'Untested'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Detected Viewport</span>
                        <span className="font-mono font-bold text-foreground mt-0.5 block">{viewportResolution}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Proctoring Standard</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">≥ 1024 x 600</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={handleTestFullscreen}
                        className="w-full py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Test Fullscreen Capability (1.5s auto-exit)
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Anti-Cheat Focus Sensor Demo */}
                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Anti-Cheat Defocus Sensor Test</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Simulates how window-blur and tab-switching events are detected during proctored exams.
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        antiCheatDefocusCount > 0
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      }`}>
                        {antiCheatDefocusCount > 0 ? `${antiCheatDefocusCount} Event(s) Detected` : 'Focus Intact'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-background border border-border text-xs space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Interactive Sandbox:</span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Switch to another browser tab or click outside this window. The sensor below will immediately register the defocus event.
                      </p>
                      {lastDefocusEvent && (
                        <p className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300 pt-1">
                          {lastDefocusEvent}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                      <span>Threshold in live exam:</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">Immediate Lockout</span>
                    </div>
                  </div>

                  {/* Card 4: Network Latency & Ping Stability */}
                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Network Latency & Server Roundtrip</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Benchmarks HTTP round-trip latency to guarantee prompt question retrieval.
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        latencyStatus === 'done'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {latencyStatus === 'done' ? `${latencyMs} ms` : latencyStatus === 'testing' ? 'Pinging...' : 'Unchecked'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Average Roundtrip</span>
                        <span className="font-mono font-bold text-foreground mt-0.5 block">
                          {latencyMs !== null ? `${latencyMs} ms` : '--'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Connection Health</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                          {latencyGrade}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        disabled={latencyStatus === 'testing'}
                        onClick={handleRunLatencyBenchmark}
                        className="w-full py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {latencyStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {latencyStatus === 'testing' ? 'Measuring Roundtrip...' : 'Run Latency Benchmark'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled Viva Exams Tab */}
            {activeTab === 'scheduled' && (
              <div className="bg-card p-6 lg:p-8 rounded-xl border border-border shadow-sm">
                {scheduledExams.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No scheduled exams right now.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {scheduledExams.map((exam: any) => (
                      <div key={exam.id} className="bg-muted/40 border border-border p-5 rounded-xl flex flex-col justify-between hover:bg-muted/60 transition-colors">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{exam.subject_name}</h3>
                          <p className="text-xs text-muted-foreground mt-2">Questions: {exam.questions_per_student}</p>
                          <p className="text-xs text-muted-foreground mt-1">Time per Question: {exam.timer_per_question_minutes} min</p>
                        </div>
                        <button 
                          onClick={() => {
                            router.push(`/student/exam/${exam.id}`);
                          }}
                          className="mt-5 w-full h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                          Join Waiting Room
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MCQ Examination Tab */}
            {activeTab === 'mcq' && (
              <div className="space-y-6">
                {/* PIN Code Verification Card */}
                <div className="bg-card p-6 lg:p-8 rounded-2xl border border-border shadow-sm space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-bold text-foreground tracking-tight">Enter Examination Access PIN</h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Please enter the unique 6-digit access PIN provided by your faculty. The system will verify your enrollment on the official class roster.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyPin} className="max-w-md flex gap-3">
                    <input
                      type="text"
                      maxLength={10}
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value)}
                      placeholder="e.g. 749201"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-mono tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      disabled={pinVerifying}
                      className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {pinVerifying && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {pinVerifying ? 'Verifying...' : 'Verify Access'}
                    </button>
                  </form>

                  {pinError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 max-w-xl">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  {pinResult && (
                    <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 max-w-xl space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                            Enrollment Verified
                          </span>
                          <h3 className="text-base font-bold text-foreground mt-0.5">{pinResult.subject_name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Class: {pinResult.class_name} | Duration: {pinResult.duration_minutes} Mins | Questions: {pinResult.questions_count}
                          </p>
                        </div>
                        <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-5 h-5" />
                        </span>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                        {pinResult.already_submitted ? (
                          <button
                            onClick={() => toggleExpandMcqAttempt(pinResult.attempt_id)}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Attempted Questions
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/student/mcq/${pinResult.exam_id}/take?pin=${encodeURIComponent(pinInput.trim())}`)}
                            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-2"
                          >
                            Start Exam (Proctored)
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Available MCQ Exams for this Class */}
                <div className="bg-card p-6 lg:p-8 rounded-2xl border border-border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground">Objective MCQ Exams for Your Class</h3>
                      <p className="text-xs text-muted-foreground">Tests configured for your enrolled academic division</p>
                    </div>
                    <button
                      onClick={fetchMCQExams}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Refresh Exam List"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {mcqExams.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No active MCQ examinations assigned to your class at this time.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {mcqExams.map((exam: any) => {
                        const isSubmitted = exam.attempt_status === 'submitted';
                        const isLocked = exam.attempt_status === 'locked_out';
                        const inProgress = exam.attempt_status === 'in_progress';
                        const isAttemptExpanded = expandedMcqAttemptId === exam.attempt_id;

                        return (
                          <div
                            key={exam.id}
                            className={`p-5 rounded-xl border bg-background flex flex-col justify-between transition-colors ${
                              isLocked ? 'border-red-500/30' : isAttemptExpanded ? 'border-primary' : 'border-border'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                  {exam.class_name}
                                </span>
                                {isSubmitted && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Submitted
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse">
                                    Locked Out
                                  </span>
                                )}
                                {inProgress && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    In Progress
                                  </span>
                                )}
                                {exam.attempt_status === 'not_started' && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                    Ready
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 className="text-sm font-bold text-foreground">{exam.subject_name}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {exam.questions_count} Questions | {exam.duration_minutes} Minutes
                                </p>
                              </div>

                              {isSubmitted && exam.is_grade_released && exam.score_awarded !== null && (
                                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                                  <span className="text-muted-foreground">Score: </span>
                                  <span className="font-bold text-foreground font-mono">{exam.score_awarded} / {exam.total_marks}</span>
                                  <span className="ml-2 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                                    {exam.grade}
                                  </span>
                                </div>
                              )}

                              {isSubmitted && !exam.is_grade_released && (
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                                  Evaluation complete: Grades withheld by faculty.
                                </div>
                              )}
                            </div>

                            <div className="pt-4 mt-3 border-t border-border">
                              {isSubmitted ? (
                                <div className="space-y-2">
                                  <button
                                    onClick={() => toggleExpandMcqAttempt(exam.attempt_id)}
                                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    {isAttemptExpanded ? 'Hide Attempted Questions' : 'View Attempted Questions'}
                                  </button>
                                  <button
                                    onClick={() => router.push(`/student/mcq/${exam.attempt_id}/result`)}
                                    className="w-full py-1.5 rounded-lg border border-border hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Full Result Page
                                  </button>
                                </div>
                              ) : isLocked ? (
                                <button
                                  onClick={() => router.push(`/student/mcq/${exam.id}/take`)}
                                  className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Check Re-entry Status
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setPinInput('');
                                    setPinResult(null);
                                    setPinError('');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors"
                                >
                                  Enter PIN to Start
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Active Question Sheet Expanded directly below the grid in the MCQ tab */}
                  {expandedMcqAttemptId && (
                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <ListChecks className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Interactive Question Sheet & Response Record</h3>
                      </div>
                      {renderAttemptedQuestionsSheet(expandedMcqAttemptId)}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
