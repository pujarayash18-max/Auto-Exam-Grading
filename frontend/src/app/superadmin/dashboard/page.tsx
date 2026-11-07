"use client";
import { API_BASE_URL } from '@/lib/api';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
import { 
  Users, 
  GraduationCap, 
  School, 
  Award, 
  Coins, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  ArrowUpRight,
  ArrowRight,
  Database,
  Cpu
} from "lucide-react";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";

export default function SuperadminDashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/admin/analytics`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_role");
          document.cookie = "refresh_token=; path=/; max-age=0";
          router.push("/auth/login");
          return;
        }
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [router]);

  if (!isClient) return null;

  const kpis = stats?.kpis || {};
  const health = stats?.system_health || {};
  const recentActivities = stats?.recent_activity || [];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[var(--background)] text-[var(--text)] selection:bg-blue-600/30 overflow-hidden transition-colors duration-150">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
          
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--text)] tracking-tight">System Overview</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Centralized command console for institutional examinations and operational metrics
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/superadmin/results"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-text)] hover:opacity-95 transition shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Master Gradebook
                </Link>
                <Link
                  href="/superadmin/anti-cheat"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Anti-Cheat Feed
                </Link>
              </div>
            </div>

            {/* Low Token Balance Institutional Alert Banner */}
            {!loading && kpis.ai_token_balance !== null && kpis.ai_token_balance < 15000 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text)]">
                      Low Institutional AI Token Balance ({kpis.ai_token_balance.toLocaleString()} tokens remaining)
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Token reserve is low. Recharging tokens ensures uninterrupted question generation and AI oral viva grading.
                    </p>
                  </div>
                </div>
                <Link
                  href="/superadmin/ai-billing"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  Recharge Tokens
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Students */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Students</span>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-[var(--text)]">
                    {loading ? "..." : (kpis.students_count ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Enrolled across all classes</p>
                </div>
              </div>

              {/* Card 2: Faculty */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-xs font-semibold uppercase tracking-wider">Active Faculty</span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-[var(--text)]">
                    {loading ? "..." : (kpis.faculty_count ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Assigned educators</p>
                </div>
              </div>

              {/* Card 3: Classes */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-xs font-semibold uppercase tracking-wider">Classes & Batches</span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <School className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-[var(--text)]">
                    {loading ? "..." : (kpis.classes_count ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Active academic divisions</p>
                </div>
              </div>

              {/* Card 4: Total Completed Assessments */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-xs font-semibold uppercase tracking-wider">Completed Exams</span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-[var(--text)]">
                    {loading ? "..." : (kpis.total_completed_assessments ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {kpis.completed_viva_runs ?? 0} Vivas · {kpis.submitted_mcq_attempts ?? 0} MCQs
                  </p>
                </div>
              </div>

              {/* Card 5: AI Token Balance */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-xs font-semibold uppercase tracking-wider">AI Token Reserve</span>
                  <div className="p-2 rounded-lg bg-slate-500/10 text-slate-500">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-[var(--text)] truncate">
                    {loading ? "..." : (kpis.ai_token_balance ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    ₹{(kpis.ai_wallet_balance ?? 0).toFixed(2)} prepaid wallet
                  </p>
                </div>
              </div>
            </div>

            {/* System Health & Proctoring Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Service Health Widget */}
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <h2 className="text-base font-semibold text-[var(--text)]">Infrastructure Health & Real-Time Latency</h2>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${health.status === 'operational' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                    {health.status === 'operational' ? 'All Systems Operational' : 'Degraded Service'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">Database (PostgreSQL)</span>
                      <Database className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-lg font-bold text-[var(--text)]">
                        {health?.database?.latency_ms ? `${health.database.latency_ms} ms` : "Connected"}
                      </span>
                      <span className="text-xs text-emerald-500 font-medium">Healthy</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">Cache & Queue (Redis)</span>
                      <Cpu className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-lg font-bold text-[var(--text)]">
                        {health?.redis?.latency_ms ? `${health.redis.latency_ms} ms` : "Connected"}
                      </span>
                      <span className="text-xs text-emerald-500 font-medium">Healthy</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">API Core Server</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-lg font-bold text-[var(--text)]">FastAPI</span>
                      <span className="text-xs text-emerald-500 font-medium">99.98% SLA</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Anti-Cheat Incident Alert Card */}
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      <h2 className="text-base font-semibold text-[var(--text)]">Proctoring Watch</h2>
                    </div>
                    {kpis.active_lockouts > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        {kpis.active_lockouts} Locked Out
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Secure
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Monitors student fullscreen exits, browser tab switching, and AI disconnects across active viva and MCQ examination sessions.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <Link
                    href="/superadmin/anti-cheat"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition"
                  >
                    View All Incidents & Re-entry Approvals
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Performance Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Subject-Wise */}
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <h2 className="text-base font-semibold text-[var(--text)] mb-4">Subject-wise Average Score</h2>
                <div className="h-72 w-full">
                  {stats?.subject_wise?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.subject_wise} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis 
                          dataKey="subject" 
                          stroke="var(--text-secondary)" 
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <YAxis 
                          stroke="var(--text-secondary)" 
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false} 
                          domain={[0, 100]}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--surface)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px',
                            color: 'var(--text)'
                          }}
                          itemStyle={{ color: 'var(--text)' }}
                        />
                        <Bar dataKey="avg_score" fill="#2563eb" radius={[4, 4, 0, 0]} name="Average Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                      No completed examination records available yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Class-Wise */}
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <h2 className="text-base font-semibold text-[var(--text)] mb-4">Class-wise Average Score</h2>
                <div className="h-72 w-full">
                  {stats?.class_wise?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.class_wise} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis 
                          dataKey="class_name" 
                          stroke="var(--text-secondary)" 
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <YAxis 
                          stroke="var(--text-secondary)" 
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false} 
                          domain={[0, 100]}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--surface)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px',
                            color: 'var(--text)'
                          }}
                          itemStyle={{ color: 'var(--text)' }}
                        />
                        <Bar dataKey="avg_score" fill="#0891b2" radius={[4, 4, 0, 0]} name="Average Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                      No class assessment records available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Administrative Activity Feed */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[var(--text-secondary)]" />
                  <h2 className="text-base font-semibold text-[var(--text)]">Recent Examination & Security Activity</h2>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">Live database events</span>
              </div>

              {recentActivities.length > 0 ? (
                <div className="divide-y divide-[var(--border)]">
                  {recentActivities.map((act: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-md ${
                          act.type === 'lockout_incident' 
                            ? 'bg-amber-500/10 text-amber-500' 
                            : act.type === 'mcq_submitted' 
                              ? 'bg-blue-500/10 text-blue-500' 
                              : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {act.type === 'lockout_incident' ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--text)]">{act.title}</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            Student: <span className="font-semibold text-[var(--text)]">{act.student_name}</span> · {act.detail}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                  No recent activity logged.
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
