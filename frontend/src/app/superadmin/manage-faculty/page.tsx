"use client";
import { API_BASE_URL } from '@/lib/api';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { UploadCloud, Trash2, KeyRound, Mail, AlertCircle, CheckCircle2, X, Pencil, Save } from "lucide-react";

interface FacultyItem {
  id: number;
  emp_id: string;
  name: string;
  email?: string;
  department?: string;
  department_id?: number;
  department_name?: string;
  subjects?: string[];
  assigned_classes?: string[];
  has_password?: boolean;
  password_email_sent?: boolean;
  must_change_password?: boolean;
}

export default function ManageFacultyPage() {
  const router = useRouter();
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [updateType, setUpdateType] = useState<"add" | "replace">("add");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit Modal State
  const [editingFaculty, setEditingFaculty] = useState<FacultyItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    emp_id: "",
    department_id: "" as number | "",
    department_name: "",
    subjects: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDepartments(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch departments", e);
    }
  };

  const fetchFaculties = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/auth/login");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculties`, {
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
    fetchDepartments();
  }, []);

  const handleOpenEdit = (faculty: FacultyItem) => {
    setEditingFaculty(faculty);
    const subjs = Array.isArray(faculty.subjects)
      ? faculty.subjects.join(", ")
      : typeof faculty.subjects === "string"
      ? faculty.subjects
      : "";

    setEditForm({
      name: faculty.name || "",
      email: faculty.email || "",
      emp_id: faculty.emp_id || "",
      department_id: faculty.department_id || "",
      department_name: faculty.department_name || faculty.department || "",
      subjects: subjs,
    });
    setEditError("");
  };

  const handleCloseEdit = () => {
    setEditingFaculty(null);
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    if (!editForm.name.trim()) {
      setEditError("Name is required.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    const token = localStorage.getItem("access_token");

    try {
      const subjectsArray = editForm.subjects
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim() || undefined,
        emp_id: editForm.emp_id.trim() || undefined,
        subjects: subjectsArray,
      };

      if (editForm.department_id) {
        payload.department_id = Number(editForm.department_id);
      } else if (editForm.department_name.trim()) {
        payload.department_name = editForm.department_name.trim();
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculties/${editingFaculty.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update faculty.");
      }

      setSuccess("Faculty updated successfully.");
      handleCloseEdit();
      fetchFaculties();
    } catch (err: any) {
      setEditError(err.message || "Failed to update faculty.");
    } finally {
      setEditLoading(false);
    }
  };

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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculty/upload`, {
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
        `${API_BASE_URL}/api/v1/admin/generate-passwords/faculty`,
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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/send-emails/faculty`, {
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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculties/${id}`, {
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
                            {/* Actions: Edit and Delete Buttons */}
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
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(f)}
                                  className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-primary hover:bg-primary/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                                  title="Edit faculty member"
                                  aria-label={`Edit ${f.name}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(f.id)}
                                  className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-bg)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--danger-text)]/30 cursor-pointer"
                                  title="Delete faculty member"
                                  aria-label={`Delete ${f.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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

      {/* Edit Faculty Modal */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Faculty Member</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update employee profile and subject assignments.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Faculty Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Prof. John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={editForm.emp_id}
                    onChange={(e) => setEditForm({ ...editForm, emp_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="EMP1001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="faculty@university.edu"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Department
                </label>
                <select
                  value={editForm.department_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const selected = departments.find((d) => String(d.id) === String(val));
                    setEditForm({
                      ...editForm,
                      department_id: val ? Number(val) : "",
                      department_name: selected ? selected.name : "",
                    });
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.department_id ? `${dept.department_id} - ${dept.name}` : dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Assigned Subjects
                </label>
                <input
                  type="text"
                  value={editForm.subjects}
                  onChange={(e) => setEditForm({ ...editForm, subjects: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. CS101 - Data Structures, Database Systems"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Separate multiple subjects with commas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
