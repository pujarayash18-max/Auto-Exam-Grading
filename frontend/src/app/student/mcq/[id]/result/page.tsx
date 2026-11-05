'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  Award, CheckCircle2, XCircle, Clock, ArrowLeft,
  FileText, ShieldCheck, RefreshCw, Lock, HelpCircle
} from 'lucide-react';

interface ReviewItem {
  question_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  selected_option: string | null;
  correct_option?: string | null;
  is_correct?: boolean | null;
  explanation?: string | null;
  bloom_level?: string;
}

interface AttemptResult {
  attempt_id: number;
  status: string;
  is_grade_released: boolean;
  subject_name: string;
  score_awarded?: number | null;
  total_marks?: number;
  percentage?: number | null;
  grade?: string | null;
  correct_count?: number | null;
  total_questions?: number;
  answered_count?: number;
  lockout_count?: number;
  started_at?: string;
  submitted_at?: string;
  message?: string;
  review_sheet?: ReviewItem[];
}

export default function StudentMCQResultPage() {
  const routeParams = useParams();
  const attemptId = (routeParams?.id as string) || '';
  const router = useRouter();

  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchResult = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptId}/result`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to retrieve assessment result');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error loading result');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Retrieving examination evaluation sheet...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md w-full p-6 rounded-2xl border border-red-500/30 bg-card text-center space-y-4">
          <h2 className="text-lg font-bold text-foreground">Result Not Available</h2>
          <p className="text-xs text-muted-foreground">{error || 'Unable to locate attempt result.'}</p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Case 1: Legacy or empty attempts without questions available
  if (!result.review_sheet || result.review_sheet.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-lg w-full p-8 rounded-2xl border border-border bg-card shadow-lg text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Exam Submitted Successfully</h1>
            <p className="text-sm font-semibold text-primary">{result.subject_name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your responses have been deterministically recorded and archived in the institutional registry.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs text-left space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Grades Withheld by Faculty Policy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Per examination settings, scores and question review sheets for this assessment are withheld until your faculty concludes the session.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={fetchResult}
              className="w-full py-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check for Published Results
            </button>
            <button
              onClick={() => router.push('/student/dashboard')}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors"
            >
              Return to Student Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Attempt with review sheet (handles both Released and Withheld modes)
  const isReleased = !!result.is_grade_released;

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-5xl mx-auto space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Examination Performance & Review</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{result.subject_name}</p>
        </div>

        {isReleased ? (
          <span className="text-xs px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1.5 self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4" />
            Graded & Published
          </span>
        ) : (
          <span className="text-xs px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 flex items-center gap-1.5 self-start sm:self-auto">
            <Lock className="w-4 h-4" />
            Grades Withheld by Faculty
          </span>
        )}
      </div>

      {/* Withheld Notice Banner */}
      {!isReleased && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-3">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <span className="font-bold text-amber-800 dark:text-amber-200">Official Answer Keys & Marks Withheld</span>
            <p className="text-[11px] leading-relaxed">
              Your instructor has configured this examination to withhold correct answer keys and final marks until all sessions conclude. Your attempted questions and submitted choices are safely recorded below.
            </p>
          </div>
        </div>
      )}

      {/* Score Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">{isReleased ? 'Marks Awarded' : 'Assessment Status'}</span>
          <span className="text-3xl font-extrabold font-mono text-foreground mt-1 block">
            {isReleased ? (
              <>
                {result.score_awarded} <span className="text-sm font-normal text-muted-foreground">/ {result.total_marks}</span>
              </>
            ) : (
              'Submitted'
            )}
          </span>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {isReleased ? 'Total marks attained' : 'Archived in registry'}
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">{isReleased ? 'Percentage Score' : 'Questions Answered'}</span>
          <span className="text-3xl font-extrabold font-mono text-primary mt-1 block">
            {isReleased ? `${result.percentage}%` : `${result.answered_count || result.review_sheet.filter(q => q.selected_option).length} / ${result.total_questions || result.review_sheet.length}`}
          </span>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {isReleased ? 'Deterministic accuracy' : 'Submitted choices'}
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">{isReleased ? 'Letter Grade' : 'Grade Status'}</span>
          <span className={`text-3xl font-black font-mono mt-1 block ${isReleased ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400 text-xl pt-1.5'}`}>
            {isReleased ? result.grade : 'Withheld'}
          </span>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {isReleased ? 'Institutional standard' : 'Awaiting publication'}
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">{isReleased ? 'Correct Responses' : 'Integrity Record'}</span>
          <span className="text-3xl font-extrabold font-mono text-foreground mt-1 block">
            {isReleased ? (
              <>
                {result.correct_count} <span className="text-sm font-normal text-muted-foreground">/ {result.total_questions}</span>
              </>
            ) : (
              result.lockout_count || 0
            )}
          </span>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {isReleased
              ? (result.lockout_count ? `${result.lockout_count} anti-cheat lockout(s)` : 'Zero lockouts recorded')
              : 'Anti-cheat lockouts'}
          </span>
        </div>
      </div>

      {/* Detailed Response Sheet */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Attempted Question Sheet & Responses</h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {result.review_sheet.length} Questions
          </span>
        </div>

        <div className="space-y-4">
          {result.review_sheet?.map((item, idx) => {
            const hasUserAnswered = !!item.selected_option;
            return (
              <div
                key={item.question_id}
                className={`p-6 rounded-2xl border bg-card space-y-4 transition-all ${
                  !isReleased
                    ? 'border-border'
                    : item.is_correct
                    ? 'border-border'
                    : 'border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        Question {idx + 1}
                      </span>
                      {item.bloom_level && (
                        <span className="text-[11px] font-semibold text-secondary-foreground px-2 py-0.5 rounded-md bg-secondary border border-border">
                          Bloom's: {item.bloom_level}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground pt-1 leading-relaxed">
                      {item.question_text}
                    </h3>
                  </div>
                  <div>
                    {isReleased ? (
                      item.is_correct ? (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Correct
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/20 flex items-center gap-1 shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          Incorrect
                        </span>
                      )
                    ) : (
                      hasUserAnswered ? (
                        <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold text-xs border border-primary/20 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Choice Recorded
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-semibold text-xs border border-border flex items-center gap-1 shrink-0">
                          Unanswered
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* 4 Choices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'A', text: item.option_a },
                    { key: 'B', text: item.option_b },
                    { key: 'C', text: item.option_c },
                    { key: 'D', text: item.option_d }
                  ].map(opt => {
                    const isUserSelection = item.selected_option === opt.key;
                    const isCorrectAnswer = isReleased && item.correct_option === opt.key;

                    let style = 'border-border bg-background text-muted-foreground';
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
                      <div key={opt.key} className={`p-3 rounded-xl border flex items-center gap-2.5 ${style}`}>
                        <span className="w-6 h-6 rounded-md font-mono font-bold flex items-center justify-center text-xs bg-muted/60 shrink-0">
                          {opt.key}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isUserSelection && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
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

                {/* Rationale / Explanation */}
                {isReleased && item.explanation && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Explanation: </span>
                    {item.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

