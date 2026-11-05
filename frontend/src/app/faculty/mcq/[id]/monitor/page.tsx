'use client';
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  Users, ShieldAlert, CheckCircle2, Clock, AlertTriangle, ArrowLeft,
  Copy, Check, RefreshCw, Lock, Unlock, Eye, Award, ExternalLink, Download
} from 'lucide-react';

interface StudentRow {
  student_id: number;
  name: string;
  enrollment_number: string;
  gr_number: string;
  attempt_id: number | null;
  status: 'not_started' | 'in_progress' | 'locked_out' | 'submitted';
  lockout_count: number;
  last_lockout_reason: string | null;
  last_lockout_at: string | null;
  faculty_approved: boolean;
  score_awarded: number | null;
  percentage: number | null;
  grade: string | null;
  started_at: string | null;
  submitted_at: string | null;
}

interface MonitorData {
  exam_id: number;
  subject_name: string;
  class_name: string;
  access_pin: string;
  duration_minutes: number;
  total_marks: number;
  questions_per_student: number;
  release_mode: 'immediate' | 'withheld';
  is_active: boolean;
  stats: {
    total_enrolled: number;
    not_started: number;
    in_progress: number;
    locked_out: number;
    submitted: number;
    average_score: number;
  };
  students: StudentRow[];
}

export default function FacultyMCQMonitorPage() {
  const routeParams = useParams();
  const examId = (routeParams?.id as string) || '';
  const router = useRouter();

  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedPin, setCopiedPin] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [togglingRelease, setTogglingRelease] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
      a.download = (filenameMatch && filenameMatch[1]) ? filenameMatch[1].trim() : `Exam_${examId}_Results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error exporting CSV: ' + err.message);
    } finally {
      setExportingCsv(false);
    }
  };

  const fetchMonitorData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/monitor`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load monitor telemetry', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchMonitorData, 3500);
    return () => clearInterval(interval);
  }, [examId, autoRefresh]);

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleApproveReentry = async (attemptId: number) => {
    setApprovingId(attemptId);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/attempts/${attemptId}/approve-reentry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Immediate local state update
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              locked_out: Math.max(0, prev.stats.locked_out - 1),
              in_progress: prev.stats.in_progress + 1
            },
            students: prev.students.map(s =>
              s.attempt_id === attemptId
                ? { ...s, status: 'in_progress', faculty_approved: true }
                : s
            )
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleToggleRelease = async () => {
    setTogglingRelease(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/v1/mcq/exams/${examId}/toggle-release`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(prev => prev ? { ...prev, release_mode: json.release_mode } : prev);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingRelease(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm">Connecting to live examination monitor...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Back button and navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/faculty/mcq"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to MCQ Examinations
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            title="Download full student marks and violations sheet"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>{exportingCsv ? 'Exporting...' : 'Export Results (.CSV)'}</span>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live Polling Active' : 'Polling Paused'}
          </button>
          <button
            onClick={fetchMonitorData}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Refresh Now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Header & Live Access Banner */}
      <div className="p-6 rounded-2xl border border-border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.subject_name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold border border-border">
              {data.class_name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Duration: {data.duration_minutes} Mins | Questions / Student: {data.questions_per_student} | Total Marks: {data.total_marks}
          </p>
        </div>

        {/* Security Access PIN Box */}
        <div className="flex items-center gap-4 bg-background p-3.5 px-5 rounded-xl border border-border self-stretch md:self-auto justify-between md:justify-start">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Security Access PIN</span>
            <span className="text-2xl font-black font-mono tracking-widest text-primary">{data.access_pin}</span>
          </div>
          <button
            onClick={() => handleCopyPin(data.access_pin)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Copy PIN"
          >
            {copiedPin ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Telemetry Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">Enrolled Roster</span>
          <span className="text-2xl font-bold font-mono text-foreground mt-1 block">{data.stats.total_enrolled}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Total verified students</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">In Progress</span>
          <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">{data.stats.in_progress}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Currently taking test</span>
        </div>

        <div className={`p-4 rounded-xl border transition-colors ${
          data.stats.locked_out > 0
            ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 ring-1 ring-red-500/20 animate-pulse'
            : 'border-border bg-card'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Locked Out</span>
            {data.stats.locked_out > 0 && <ShieldAlert className="w-4 h-4 text-red-500" />}
          </div>
          <span className="text-2xl font-bold font-mono mt-1 block">
            {data.stats.locked_out}
          </span>
          <span className="text-[11px] mt-0.5 block opacity-80">Requires faculty approval</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">Submitted</span>
          <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">{data.stats.submitted}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Auto-graded</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">Class Average</span>
          <span className="text-2xl font-bold font-mono text-foreground mt-1 block">
            {data.stats.average_score} <span className="text-xs text-muted-foreground font-normal">/ {data.total_marks}</span>
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Across submitted tests</span>
        </div>
      </div>

      {/* Grade Release Toggle Strip */}
      <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            data.release_mode === 'immediate'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {data.release_mode === 'immediate' ? <Award className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Current Grade Release Policy: {data.release_mode === 'immediate' ? 'Immediate Release' : 'Withheld'}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.release_mode === 'immediate'
                ? 'Students see their numerical score, letter grade, and full response reviews immediately upon submission.'
                : 'Grades and review sheets are hidden from students until you switch to Immediate Release.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleRelease}
          disabled={togglingRelease}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shrink-0 disabled:opacity-50"
        >
          {togglingRelease ? 'Updating...' : data.release_mode === 'immediate' ? 'Switch to Withhold Grades' : 'Release All Grades to Students'}
        </button>
      </div>

      {/* Live Student Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Verified Student Roster ({data.students.length})</h3>
          </div>
          <span className="text-xs text-muted-foreground">Real-time anti-cheat status tracking</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">GR / Enrollment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Lockout Violations</th>
                <th className="py-3 px-4">Score & Grade</th>
                <th className="py-3 px-4 text-right">Faculty Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.students.map((student) => {
                const isLocked = student.status === 'locked_out';
                return (
                  <tr
                    key={student.student_id}
                    className={`hover:bg-muted/20 transition-colors ${
                      isLocked ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      {student.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {student.gr_number || '—'} / {student.enrollment_number || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {student.status === 'not_started' && (
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium border border-border">
                          Not Started
                        </span>
                      )}
                      {student.status === 'in_progress' && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium border border-blue-500/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          In Progress
                        </span>
                      )}
                      {student.status === 'locked_out' && (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold border border-red-500/30 flex items-center gap-1 w-max animate-pulse">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Locked Out
                        </span>
                      )}
                      {student.status === 'submitted' && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border border-emerald-500/20 flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Submitted
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {student.lockout_count > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-red-500 font-mono">
                            {student.lockout_count} violation(s)
                          </span>
                          {student.last_lockout_reason && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={student.last_lockout_reason}>
                              {student.last_lockout_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono">0 clean</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {student.status === 'submitted' && student.score_awarded !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {student.score_awarded} / {data.total_marks}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                            {student.grade || 'A'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isLocked && student.attempt_id && (
                        <button
                          onClick={() => handleApproveReentry(student.attempt_id!)}
                          disabled={approvingId === student.attempt_id}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          {approvingId === student.attempt_id ? 'Unlocking...' : 'Approve Re-entry'}
                        </button>
                      )}
                      {!isLocked && student.status === 'submitted' && (
                        <span className="text-[11px] text-muted-foreground">Evaluation Final</span>
                      )}
                      {!isLocked && student.status === 'in_progress' && (
                        <span className="text-[11px] text-blue-500">Live Session Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

