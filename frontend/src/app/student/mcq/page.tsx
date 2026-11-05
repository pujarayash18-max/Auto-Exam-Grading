'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KeyRound, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  ListChecks, RefreshCw, ShieldAlert, Clock, Award
} from 'lucide-react';

export default function StudentMCQPortalPage() {
  const router = useRouter();
  const [pinInput, setPinInput] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinResult, setPinResult] = useState<any | null>(null);
  const [pinError, setPinError] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        setExams(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

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

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10 max-w-5xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Student Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">MCQ Examination Portal</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-medium border border-primary/20">
              Anti-Cheat Protected
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Access secure objective tests with verified class roster enrollment.
          </p>
        </div>
      </div>

      {/* Security PIN Entrance Card */}
      <div className="bg-card p-6 lg:p-8 rounded-2xl border border-border shadow-sm space-y-5">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground tracking-tight">Enter Examination Security PIN</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Please enter the unique 6-digit access PIN provided by your faculty to start or resume your assessment.
          </p>
        </div>

        <form onSubmit={handleVerifyPin} className="max-w-md flex gap-3">
          <input
            type="text"
            maxLength={10}
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            placeholder="e.g. 849201"
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
                  onClick={() => router.push(`/student/mcq/${pinResult.attempt_id}/result`)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors"
                >
                  View Submitted Exam Results
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

      {/* Available MCQ Exams List */}
      <div className="bg-card p-6 lg:p-8 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Objective MCQ Exams for Your Class</h3>
            <p className="text-xs text-muted-foreground">Assigned assessments for your enrolled academic division</p>
          </div>
          <button
            onClick={fetchExams}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : exams.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No active MCQ examinations assigned to your class right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam: any) => {
              const isSubmitted = exam.attempt_status === 'submitted';
              const isLocked = exam.attempt_status === 'locked_out';
              const inProgress = exam.attempt_status === 'in_progress';

              return (
                <div
                  key={exam.id}
                  className={`p-5 rounded-xl border bg-background flex flex-col justify-between transition-colors ${
                    isLocked ? 'border-red-500/30' : 'border-border'
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
                      <button
                        onClick={() => router.push(`/student/mcq/${exam.attempt_id}/result`)}
                        className="w-full py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                      >
                        View Result & Sheet
                      </button>
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
      </div>
    </div>
  );
}

