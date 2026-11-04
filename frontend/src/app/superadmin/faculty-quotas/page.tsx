"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import {
  Building2,
  Sliders,
  Users,
  Layers,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Check,
  X,
  Coins,
  Cpu,
} from "lucide-react";

interface FacultyBreakdown {
  faculty_id: number;
  user_id: number;
  name: string;
  email: string;
  department: string;
  total_tokens_consumed: number;
  token_quota_ceiling: number | null;
  active_reserved_tokens: number;
  active_reservations_count: number;
  tokens_reclaimed: number;
}

interface ExamReservationRecord {
  id: number;
  exam_id: number;
  subject_name: string;
  faculty_id: number;
  faculty_name: string;
  reservation_type: string;
  estimated_tokens: number;
  tokens_consumed: number;
  tokens_reclaimed: number;
  status: string;
  notes?: string;
  created_at?: string;
  closed_at?: string;
}

export default function FacultyQuotasPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [facultyBreakdown, setFacultyBreakdown] = useState<FacultyBreakdown[]>([]);
  const [examReservations, setExamReservations] = useState<ExamReservationRecord[]>([]);

  // Filtering & Tabs
  const [activeTab, setActiveTab] = useState<"FACULTY" | "RESERVATIONS">("FACULTY");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  // Modal State for Editing Quota
  const [editingFaculty, setEditingFaculty] = useState<FacultyBreakdown | null>(null);
  const [quotaInput, setQuotaInput] = useState<string>("");
  const [savingQuota, setSavingQuota] = useState(false);

  const getAuthToken = () => {
    return localStorage.getItem("access_token");
  };

  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const token = getAuthToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [resFaculty, resResv] = await Promise.all([
        fetch("http://localhost:8000/api/v1/admin/ai/faculty-breakdown", { headers }),
        fetch("http://localhost:8000/api/v1/admin/ai/reservations", { headers }),
      ]);

      if (resFaculty.status === 401 || resResv.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (resFaculty.ok) {
        const facData = await resFaculty.json();
        setFacultyBreakdown(facData || []);
      }

      if (resResv.ok) {
        const resvData = await resResv.json();
        setExamReservations(resvData || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to connect to backend faculty quota service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    loadAllData();
  }, []);

  const handleOpenEditQuota = (faculty: FacultyBreakdown) => {
    setEditingFaculty(faculty);
    setQuotaInput(faculty.token_quota_ceiling ? String(faculty.token_quota_ceiling) : "");
  };

  const handleSaveFacultyQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setSavingQuota(true);
    setErrorMsg(null);

    try {
      const token = getAuthToken();
      const ceilingVal =
        quotaInput.trim() === "" || quotaInput === "0"
          ? null
          : parseInt(quotaInput.replace(/,/g, ""), 10);

      const res = await fetch(
        `http://localhost:8000/api/v1/admin/ai/faculty/${editingFaculty.faculty_id}/quota`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token_quota_ceiling: ceilingVal }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update quota ceiling.");
      }

      setSuccessMsg(
        ceilingVal === null
          ? `Quota set to Unlimited (Central Pooled) for ${editingFaculty.name}`
          : `Quota ceiling set to ${ceilingVal.toLocaleString()} tokens for ${editingFaculty.name}`
      );
      setEditingFaculty(null);
      await loadAllData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save quota.");
    } finally {
      setSavingQuota(false);
    }
  };

  if (!isClient) return null;

  // Department list for filtering
  const departments = Array.from(
    new Set(facultyBreakdown.map((f) => f.department || "General Faculty"))
  );

  // Filtered Faculty List
  const filteredFaculty = facultyBreakdown.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      departmentFilter === "ALL" || f.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  // Aggregate Metrics
  const totalFacultyCount = facultyBreakdown.length;
  const totalTokensConsumed = facultyBreakdown.reduce(
    (sum, f) => sum + (f.total_tokens_consumed || 0),
    0
  );
  const totalActiveReserved = facultyBreakdown.reduce(
    (sum, f) => sum + (f.active_reserved_tokens || 0),
    0
  );
  const totalReclaimed = facultyBreakdown.reduce(
    (sum, f) => sum + (f.tokens_reclaimed || 0),
    0
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                  <Sliders className="w-6 h-6 text-primary" />
                  Faculty Token Quotas & Governance
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage individual faculty spending limits, monitor JIT soft reservations, and maintain zero-waste token allocation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadAllData}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                  Refresh
                </button>
                <Link
                  href="/superadmin/ai-settings"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  AI Models & Billing
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="p-1 hover:bg-destructive/20 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMsg(null)}
                  className="p-1 hover:bg-emerald-500/20 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Registered Faculty</span>
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  {totalFacultyCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Teaching staff accounts</p>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Tokens Consumed</span>
                  <Coins className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  {totalTokensConsumed.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Evaluations to date</p>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Active JIT Reserved</span>
                  <Layers className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  {totalActiveReserved.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ongoing exam soft holds</p>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Tokens Reclaimed</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  +{totalReclaimed.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Zero-waste returned</p>
              </div>
            </div>

            {/* Explanation Banner */}
            <div className="p-5 rounded-xl border border-border bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Zero-Waste Pooled Allocation Architecture
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Tokens remain inside the central institution pool. When a faculty initiates an oral viva, JIT soft reservation guarantees headroom. Unspent tokens from absent students or skipped questions are immediately returned to the institution pool upon completion.
                </p>
              </div>
              <div className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-card border border-border text-foreground">
                Central Pool: Active
              </div>
            </div>

            {/* Main Tabs & Table Container */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Tab Navigation & Filters */}
              <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("FACULTY")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      activeTab === "FACULTY"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Faculty Quotas & Allocation ({facultyBreakdown.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("RESERVATIONS")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      activeTab === "RESERVATIONS"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Exam JIT Soft Reservations ({examReservations.length})
                  </button>
                </div>

                {activeTab === "FACULTY" && (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search faculty name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground w-56 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    {departments.length > 1 && (
                      <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="ALL">All Departments</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 1: Faculty Quotas Table */}
              {activeTab === "FACULTY" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-5">Faculty Member</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4 text-right">Tokens Consumed</th>
                        <th className="py-3 px-4 text-right">Active Reserved</th>
                        <th className="py-3 px-4 text-center">Quota Ceiling</th>
                        <th className="py-3 px-4 text-right">Reclaimed (Saved)</th>
                        <th className="py-3 px-5 text-right">Governance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
                            Loading faculty breakdown data...
                          </td>
                        </tr>
                      ) : filteredFaculty.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            No faculty records match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredFaculty.map((f) => (
                          <tr key={f.faculty_id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3.5 px-5">
                              <span className="font-semibold text-foreground block">{f.name}</span>
                              <span className="text-xs text-muted-foreground">{f.email}</span>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-medium text-foreground">
                              {f.department || "General"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                              {f.total_tokens_consumed.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs">
                              {f.active_reserved_tokens > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  {f.active_reserved_tokens.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {f.token_quota_ceiling ? (
                                <span className="inline-block px-2.5 py-0.5 rounded font-mono text-xs font-semibold bg-muted text-foreground border border-border">
                                  {f.token_quota_ceiling.toLocaleString()}
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Unlimited (Pooled)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              +{f.tokens_reclaimed.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenEditQuota(f)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                              >
                                Edit Quota
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Exam JIT Soft Reservations */}
              {activeTab === "RESERVATIONS" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-5">Exam / Subject</th>
                        <th className="py-3 px-4">Faculty</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Reserved Tokens</th>
                        <th className="py-3 px-4 text-right">Consumed</th>
                        <th className="py-3 px-4 text-right">Reclaimed</th>
                        <th className="py-3 px-5 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
                            Loading reservations...
                          </td>
                        </tr>
                      ) : examReservations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            No active or historical exam reservations recorded yet.
                          </td>
                        </tr>
                      ) : (
                        examReservations.map((r) => (
                          <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3.5 px-5 font-semibold text-foreground">
                              {r.subject_name}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-muted-foreground">
                              {r.faculty_name}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                  r.status === "ACTIVE"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs">
                              {r.estimated_tokens?.toLocaleString() || 0}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs font-semibold text-foreground">
                              {r.tokens_consumed?.toLocaleString() || 0}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                              +{r.tokens_reclaimed?.toLocaleString() || 0}
                            </td>
                            <td className="py-3.5 px-5 text-right text-xs text-muted-foreground">
                              {r.created_at ? new Date(r.created_at).toLocaleString() : "N/A"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Quota Ceiling Modal */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Faculty Spending Quota Ceiling
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set safety spending limits for this faculty member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFaculty(null)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFacultyQuota} className="space-y-4">
              <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
                <div className="font-semibold text-foreground text-sm">{editingFaculty.name}</div>
                <div className="text-muted-foreground">{editingFaculty.email}</div>
                <div className="text-muted-foreground">Department: {editingFaculty.department}</div>
                <div className="pt-1.5 text-xs text-primary font-medium">
                  Currently Consumed: {editingFaculty.total_tokens_consumed.toLocaleString()} Tokens
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground block">
                  Token Quota Ceiling:
                </label>
                <input
                  type="number"
                  step={10000}
                  min={0}
                  placeholder="Leave empty or 0 for Unlimited (Central Pool)"
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave empty or set to 0 for unlimited access to the central pool.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground block font-medium">Quick Presets:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Unlimited", val: "" },
                    { label: "50K", val: "50000" },
                    { label: "100K", val: "100000" },
                    { label: "250K", val: "250000" },
                    { label: "500K", val: "500000" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setQuotaInput(preset.val)}
                      className="px-2.5 py-1 rounded text-xs border border-border bg-muted/40 hover:bg-muted text-foreground font-medium transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="px-4 py-2 rounded-lg border border-border bg-muted/40 text-foreground text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuota}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {savingQuota ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Save Quota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

