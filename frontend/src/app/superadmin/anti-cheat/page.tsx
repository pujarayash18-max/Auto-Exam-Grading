"use client";
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Unlock, 
  RefreshCw, 
  Clock, 
  User, 
  GraduationCap,
  BookOpen
} from "lucide-react";

export default function AntiCheatAuditPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchIncidents = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/anti-cheat/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/auth/login");
        return;
      }

      if (res.ok) {
        setIncidents(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch anti-cheat incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleApproveReentry = async (attemptId: number) => {
    setActionLoading(attemptId);
    setSuccessMsg("");
    setErrorMsg("");
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/anti-cheat/approve-reentry/${attemptId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to approve re-entry");

      setSuccessMsg(data.msg || "Student re-entry approved successfully.");
      await fetchIncidents();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to approve re-entry");
    } finally {
      setActionLoading(null);
    }
  };

  const activeLockouts = incidents.filter(i => i.status === "locked_out");

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--text)] selection:bg-blue-600/30 overflow-hidden transition-colors duration-150">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2.5">
                  <ShieldAlert className="w-7 h-7 text-amber-500" />
                  Anti-Cheat & Lockout Audit Feed
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Institutional proctoring telemetry, security violation triggers, and centralized student re-entry management
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchIncidents}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Feed
                </button>
              </div>
            </div>

            {/* Notification Banners */}
            {successMsg && (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total Flagged Incidents</span>
                <div className="text-2xl font-bold text-[var(--text)] mt-2">{incidents.length}</div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Recorded across all exams</p>
              </div>
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Active Lockouts</span>
                <div className={`text-2xl font-bold mt-2 ${activeLockouts.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {activeLockouts.length}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Requiring administrative clearance</p>
              </div>
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Proctoring Status</span>
                <div className="text-2xl font-bold text-emerald-500 mt-2">Active</div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Tab switches & fullscreen guarded</p>
              </div>
            </div>

            {/* Incidents Table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text)]">Proctoring Telemetry Log</h2>
                <span className="text-xs text-[var(--text-secondary)]">{incidents.length} event(s) logged</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--background)]/50 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Exam / Subject</th>
                      <th className="py-3 px-4">Violations</th>
                      <th className="py-3 px-4">Last Detected Reason</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Administrative Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                          Fetching proctoring events...
                        </td>
                      </tr>
                    ) : incidents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                          No proctoring incidents or lockouts logged. All exams are proceeding securely.
                        </td>
                      </tr>
                    ) : (
                      incidents.map((inc) => (
                        <tr key={inc.attempt_id} className="hover:bg-[var(--surface-hover)] transition">
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[var(--text)]">{inc.student_name}</div>
                            <div className="text-xs text-[var(--text-secondary)] font-mono">{inc.enrollment_number}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[var(--text)] font-medium">
                            {inc.class_name}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[var(--text)] font-semibold">
                            {inc.subject}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-amber-500">
                            {inc.lockout_count} time(s)
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] max-w-xs truncate" title={inc.last_lockout_reason}>
                            {inc.last_lockout_reason}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${
                              inc.status === 'locked_out'
                                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                : (inc.status === 'in_progress'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20')
                            }`}>
                              {inc.status.replace("_", " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            {inc.last_lockout_at ? new Date(inc.last_lockout_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            }) : "N/A"}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-right">
                            {inc.status === 'locked_out' ? (
                              <button
                                onClick={() => handleApproveReentry(inc.attempt_id)}
                                disabled={actionLoading === inc.attempt_id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                {actionLoading === inc.attempt_id ? "Approving..." : "Approve Re-Entry"}
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Cleared
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

