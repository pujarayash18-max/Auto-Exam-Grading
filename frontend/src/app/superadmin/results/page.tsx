"use client";
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Award, 
  GraduationCap, 
  BookOpen,
  CheckCircle2,
  RefreshCw
} from "lucide-react";

export default function MasterResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [assessmentType, setAssessmentType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const fetchAuxData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const clsRes = await fetch(`${API_BASE_URL}/api/v1/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (clsRes.ok) setClasses(await clsRes.json());
    } catch (e) {
      console.error("Failed to load classes:", e);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (selectedClass) params.append("class_id", selectedClass);
      if (assessmentType && assessmentType !== "all") params.append("assessment_type", assessmentType);
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/master-results?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/auth/login");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch master results:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuxData();
  }, []);

  useEffect(() => {
    fetchResults();
  }, [page, selectedClass, assessmentType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchResults();
  };

  const handleExportCSV = async () => {
    setDownloading(true);
    const token = localStorage.getItem("access_token");
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.append("class_id", selectedClass);
      if (assessmentType && assessmentType !== "all") params.append("assessment_type", assessmentType);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/master-results/export-csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("CSV download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Master_Examination_Accreditation_Report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

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
                  <FileSpreadsheet className="w-7 h-7 text-blue-500" />
                  Master Gradebook & Accreditation
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Unified student performance repository across Oral Viva and Objective MCQ examinations for NAAC/NBA compliance
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCSV}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-text)] hover:opacity-95 transition shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {downloading ? "Generating..." : "Export Accreditation CSV"}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Search Form */}
                <form onSubmit={handleSearchSubmit} className="w-full md:w-96 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by student name, enrollment, subject..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </form>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  {/* Class Filter */}
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text)] focus:outline-none"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.department ? `${c.department} - ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>

                  {/* Assessment Type Toggle */}
                  <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--background)] p-1 text-xs font-medium">
                    <button
                      onClick={() => { setAssessmentType("all"); setPage(1); }}
                      className={`px-3 py-1 rounded-md transition ${assessmentType === 'all' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                    >
                      All Types
                    </button>
                    <button
                      onClick={() => { setAssessmentType("viva"); setPage(1); }}
                      className={`px-3 py-1 rounded-md transition ${assessmentType === 'viva' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                    >
                      Oral Viva
                    </button>
                    <button
                      onClick={() => { setAssessmentType("mcq"); setPage(1); }}
                      className={`px-3 py-1 rounded-md transition ${assessmentType === 'mcq' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                    >
                      Objective MCQ
                    </button>
                  </div>

                  <button
                    onClick={() => { setPage(1); fetchResults(); }}
                    title="Refresh data"
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text)] transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Data Table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--background)]/50 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      <th className="py-3 px-4">Student Details</th>
                      <th className="py-3 px-4">Class & Department</th>
                      <th className="py-3 px-4">Exam / Subject</th>
                      <th className="py-3 px-4">Assessment Mode</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Percentage</th>
                      <th className="py-3 px-4">Grade</th>
                      <th className="py-3 px-4">Completed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                          Loading master gradebook records...
                        </td>
                      </tr>
                    ) : results.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                          No assessment records match the current filters.
                        </td>
                      </tr>
                    ) : (
                      results.map((r) => (
                        <tr key={r.id} className="hover:bg-[var(--surface-hover)] transition">
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[var(--text)]">{r.student_name}</div>
                            <div className="text-xs text-[var(--text-secondary)] font-mono">
                              {r.enrollment_number || r.gr_number || "No ID"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="text-[var(--text)] font-medium">{r.class_name}</div>
                            <div className="text-[var(--text-secondary)]">{r.department}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="text-[var(--text)] font-semibold">{r.subject}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${
                              r.assessment_type === 'Oral Viva'
                                ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}>
                              {r.assessment_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-[var(--text)]">
                            {r.score} <span className="text-[var(--text-secondary)] font-normal">/ {r.max_marks}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium">
                            <span className={r.percentage >= 60 ? "text-emerald-500" : (r.percentage >= 40 ? "text-amber-500" : "text-rose-500")}>
                              {r.percentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold text-[var(--text)]">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--background)] border border-[var(--border)]">
                              {r.grade}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            {r.completed_at ? new Date(r.completed_at).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : "N/A"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="p-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div>
                  Showing {results.length} of {totalCount} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-[var(--text)]">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

