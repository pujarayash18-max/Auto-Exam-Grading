"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { UploadCloud, Trash2, KeyRound, Mail, AlertCircle, CheckCircle2, X } from "lucide-react";

interface FacultyItem {
  id: number;
  emp_id: string;
  name: string;
  email?: string;
  department?: string;
  subjects?: string[];
  assigned_classes?: string[];
  has_password?: boolean;
  password_email_sent?: boolean;
  must_change_password?: boolean;
}

export default function ManageFacultyPage() {
  const router = useRouter();
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [updateType, setUpdateType] = useState<"add" | "replace">("add");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchFaculties = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/auth/login");
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/faculties", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        document.cookie = "refresh_token=; path=/; max-age=0";
        return router.push("/auth/login");
      }
      if (res.ok) {
        setFaculties(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch faculties:", err);
    }
  };

  useEffect(() => {
    fetchFaculties();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a spreadsheet file (.csv or .xlsx) to upload.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("update_type", updateType);

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/faculty/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        document.cookie = "refresh_token=; path=/; max-age=0";
        return router.push("/auth/login");
      }

      const data = await res.json();
      if (!res.ok) {
        const errDetail =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        throw new Error(errDetail || "Upload failed");
      }

      setSuccess("Faculty data uploaded successfully.");
      setFile(null);
      // Reset the file input element value if present
      const fileInput = document.getElementById("faculty-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchFaculties();
    } catch (err: any) {
      setError(err.message || "An error occurred while uploading.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePasswords = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(
        "http://localhost:8000/api/v1/admin/generate-passwords/faculty",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const errDetail =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        throw new Error(errDetail || "Failed to generate passwords");
      }
      setSuccess(data.msg || "Passwords generated successfully.");
      fetchFaculties();
    } catch (err: any) {
      setError(err.message || "Failed to generate passwords.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmails = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/send-emails/faculty", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        const errDetail =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        throw new Error(errDetail || "Failed to send emails");
      }
      setSuccess(data.msg || "Emails sent successfully.");
      fetchFaculties();
    } catch (err: any) {
      setError(err.message || "Failed to send emails.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this faculty member?")) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/faculties/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchFaculties();
      }
    } catch (err) {
      console.error("Failed to delete faculty member:", err);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Shared Admin Sidebar */}
      <SuperAdminSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Page Header: 24px title, 14px subtitle, 24px gap below */}
            <header>
              <h1 className="text-2xl font-semibold text-[var(--text)] tracking-tight">
                Faculty Management
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Upload and manage institutional faculty records, subject assignments, and credentials.
              </p>
            </header>

            {/* Notification Alerts */}
            {error && (
              <div className="p-3.5 rounded-lg bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-text)]/20 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="p-1 rounded hover:bg-[var(--danger-text)]/10"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {success && (
              <div className="p-3.5 rounded-lg bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-text)]/20 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{success}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccess("")}
                  className="p-1 rounded hover:bg-[var(--success-text)]/10"
                  aria-label="Dismiss success"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Faculty Data Card */}
            <section className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 shadow-none">
              <h2 className="text-base font-semibold text-[var(--text)] flex items-center gap-2.5 mb-4">
                <UploadCloud className="w-5 h-5 text-[var(--primary)]" />
                <span>Upload Faculty Data (Excel/CSV)</span>
              </h2>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label
                    htmlFor="faculty-file-input"
                    className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
                  >
                    Select File (.csv, .xlsx, .xls)
                  </label>
                  <input
                    id="faculty-file-input"
                    type="file"
                    accept=".csv, .xls, .xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[var(--border)] file:text-xs file:font-medium file:bg-[var(--surface-muted)] file:text-[var(--text)] hover:file:bg-[var(--border-strong)]/20 file:cursor-pointer cursor-pointer border border-[var(--border)] rounded-lg bg-[var(--surface)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  {/* Radio options aligned in one row */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer select-none">
                      <input
                        type="radio"
                        name="updateType"
                        checked={updateType === "add"}
                        onChange={() => setUpdateType("add")}
                        className="w-4 h-4 text-[var(--primary)] border-[var(--border-strong)] focus:ring-[var(--primary)] bg-[var(--surface)]"
                      />
                      <span>Add to Existing Data</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer select-none">
                      <input
                        type="radio"
                        name="updateType"
                        checked={updateType === "replace"}
                        onChange={() => setUpdateType("replace")}
                        className="w-4 h-4 text-[var(--primary)] border-[var(--border-strong)] focus:ring-[var(--primary)] bg-[var(--surface)]"
                      />
                      <span>Replace All Data</span>
                    </label>
                  </div>

                  {/* Solid Primary Upload Button (No gradients, guaranteed contrast) */}
                  <button
                    type="submit"
                    disabled={loading || !file}
                    className="h-9 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-medium text-sm transition-colors duration-150 shadow-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{loading ? "Uploading..." : "Upload Excel"}</span>
                  </button>
                </div>
              </form>
            </section>

            {/* Faculty List Section */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[var(--text)] tracking-tight">
                  Faculty List ({faculties.length})
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGeneratePasswords}
                    disabled={loading}
                    className="h-9 px-3.5 rounded-lg text-sm font-medium bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-text)]/20 hover:opacity-90 transition-opacity duration-150 inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Generate Missing Passwords</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSendEmails}
                    disabled={loading}
                    className="h-9 px-3.5 rounded-lg text-sm font-medium bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-text)]/20 hover:opacity-90 transition-opacity duration-150 inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send Emails</span>
                  </button>
                </div>
              </div>

              {/* Data Table Container with Horizontal Scroll & Sticky Header */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-[var(--surface-muted)] text-[var(--text-muted)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] w-10 text-center">
                          #
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] w-24">
                          Emp ID
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[120px]">
                          Name
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[160px]">
                          Email
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[130px]">
                          Department
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[160px]">
                          Subjects
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[180px]">
                          Assigned Classes
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] w-36 text-center">
                          Account Status
                        </th>
                        <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] text-right w-16">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {faculties.map((f, i) => {
                        const subjectsList = Array.isArray(f.subjects)
                          ? f.subjects
                          : typeof f.subjects === "string"
                          ? (f.subjects as string).split(",").map((s) => s.trim()).filter(Boolean)
                          : [];

                        const classesList = Array.isArray(f.assigned_classes)
                          ? f.assigned_classes
                          : typeof f.assigned_classes === "string"
                          ? (f.assigned_classes as string).split(",").map((c) => c.trim()).filter(Boolean)
                          : [];

                        return (
                          <tr
                            key={f.id}
                            className="hover:bg-[var(--surface-muted)] transition-colors duration-150"
                          >
                            {/* Sequential Index with Tabular Numbers */}
                            <td className="px-3 py-4 text-xs font-mono tabular-nums text-[var(--text-muted)] text-center">
                              {i + 1}
                            </td>

                            {/* Employee ID with Tabular Numbers */}
                            <td className="px-3 py-4 text-xs font-mono tabular-nums font-semibold text-[var(--text)]">
                              {f.emp_id || "-"}
                            </td>

                            {/* Name */}
                            <td className="px-3 py-4 font-medium text-[var(--text)]">
                              {f.name}
                            </td>

                            {/* Email */}
                            <td className="px-3 py-4 text-[var(--text-muted)] text-xs">
                              {f.email || "-"}
                            </td>

                            {/* Department */}
                            <td className="px-3 py-4 text-[var(--text-muted)] text-xs">
                              {f.department || "N/A"}
                            </td>

                            {/* Subjects: Compact Clean Tags */}
                            <td className="px-3 py-4">
                              {subjectsList.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {subjectsList.map((subject, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--surface-muted)] text-[var(--text)] border border-[var(--border)] font-normal"
                                    >
                                      {subject}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[var(--text-subtle)] text-xs">-</span>
                              )}
                            </td>

                            {/* Assigned Classes: Compact Clean Tags */}
                            <td className="px-3 py-4">
                              {classesList.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {classesList.map((cls, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--surface-muted)] text-[var(--text)] border border-[var(--border)] font-normal"
                                    >
                                      {cls}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[var(--text-subtle)] text-xs">-</span>
                              )}
                            </td>

                            {/* Status Badges: Single-Line, Compact, Non-wrapping, Consistent Height */}
                            <td className="px-3 py-4 text-center">
                              {!f.has_password && (
                                <span className="h-6 whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center justify-center leading-none bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning-text)]/20">
                                  No Password
                                </span>
                              )}
                              {f.has_password && !f.password_email_sent && (
                                <span className="h-6 whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center justify-center leading-none bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-text)]/20">
                                  Pending Email
                                </span>
                              )}
                              {f.has_password && f.password_email_sent && f.must_change_password && (
                                <span className="h-6 whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center justify-center leading-none bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-text)]/20">
                                  Email Sent
                                </span>
                              )}
                              {f.has_password && !f.must_change_password && (
                                <span className="h-6 whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center justify-center leading-none bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-text)]/20">
                                  Password Changed
                                </span>
                              )}
                            </td>

                            {/* Actions: Trash Button with Danger Hover State and Tooltip */}
                            <td className="px-3 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDelete(f.id)}
                                className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-bg)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--danger-text)]/30 cursor-pointer"
                                title="Delete faculty member"
                                aria-label={`Delete ${f.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {faculties.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-6 py-12 text-center text-sm text-[var(--text-muted)]"
                          >
                            No faculty data found. Upload an Excel or CSV file to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
