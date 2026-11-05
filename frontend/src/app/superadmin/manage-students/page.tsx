"use client";
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect } from "react";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { useRouter } from "next/navigation";
import { UploadCloud, Trash2, KeyRound, Mail, Search, Pencil, X, Save } from "lucide-react";

export default function ManageStudents() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [updateType, setUpdateType] = useState("add"); // "add" or "replace"
  const [students, setStudents] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    gr_no: "",
    enrollment_no: "",
    department_id: "" as number | "",
    department_name: "",
    class_id: "" as number | "",
    subjects: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchAuxData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const [deptRes, clsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/admin/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/v1/admin/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (clsRes.ok) setClasses(await clsRes.json());
    } catch (e) {
      console.error("Failed to load departments/classes aux data", e);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchAuxData();
  }, []);

  const handleOpenEdit = (student: any) => {
    setEditingStudent(student);
    const subjs = Array.isArray(student.subjects)
      ? student.subjects.join(", ")
      : typeof student.subjects === "string"
      ? student.subjects
      : "";

    setEditForm({
      name: student.name || "",
      email: student.email || "",
      gr_no: student.gr_no || "",
      enrollment_no: student.enrollment_no || "",
      department_id: student.department_id || "",
      department_name: student.department_name || student.department || "",
      class_id: student.class_id || "",
      subjects: subjs,
    });
    setEditError("");
  };

  const handleCloseEdit = () => {
    setEditingStudent(null);
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editForm.name.trim()) {
      setEditError("Student name is required.");
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
        gr_no: editForm.gr_no.trim() || undefined,
        enrollment_no: editForm.enrollment_no.trim() || undefined,
        class_id: editForm.class_id ? Number(editForm.class_id) : undefined,
        subjects: subjectsArray,
      };

      if (editForm.department_id) {
        payload.department_id = Number(editForm.department_id);
      } else if (editForm.department_name.trim()) {
        payload.department_name = editForm.department_name.trim();
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${editingStudent.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update student.");
      }

      setSuccess("Student updated successfully.");
      handleCloseEdit();
      fetchStudents();
    } catch (err: any) {
      setEditError(err.message || "Failed to update student.");
    } finally {
      setEditLoading(false);
    }
  };

  const fetchStudents = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/auth/login");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        document.cookie = "refresh_token=; path=/; max-age=0";
        return router.push("/auth/login");
      }
      
      if (res.ok) {
        setStudents(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an Excel/CSV file.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("update_type", updateType);

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        return router.push("/auth/login");
      }
      
      const data = await res.json();
      if (!res.ok) {
        const errDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new Error(errDetail || "Upload failed");
      }
      
      setSuccess(data.msg);
      setFile(null);
      fetchStudents();
    } catch (err: any) {
      setError(err.message);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/generate-passwords/student`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        return router.push("/auth/login");
      }
      
      const data = await res.json();
      if (!res.ok) {
        const errDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new Error(errDetail || "Generation failed");
      }
      
      setSuccess(data.msg);
      fetchStudents();
    } catch (err: any) {
      setError(err.message);
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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/send-emails/student`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        return router.push("/auth/login");
      }
      
      const data = await res.json();
      if (!res.ok) {
        const errDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new Error(errDetail || "Failed to send emails");
      }
      
      setSuccess(data.msg);
      fetchStudents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        return router.push("/auth/login");
      }
      
      if (res.ok) {
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.gr_no?.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.toLowerCase().includes(search.toLowerCase()) ||
    s.class_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-foreground">
                  Manage Students
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Upload and manage student records and credentials.
                </p>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={handleGeneratePasswords}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-green-500/10 text-green-600 dark:text-green-500 hover:bg-green-500/20 border border-green-500/20 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Generate Passwords</span>
                </button>
                <button 
                  onClick={handleSendEmails}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Emails</span>
                </button>
              </div>
            </header>

            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                {success}
              </div>
            )}

            {/* Upload Section */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-xl font-semibold mb-6 flex items-center text-foreground">
                <UploadCloud className="w-5 h-5 mr-3 text-primary" />
                Upload Students Excel/CSV
              </h3>
              
              <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Select File</label>
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <div className="w-full md:w-auto">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Upload Mode</label>
                  <div className="flex items-center space-x-4 h-[44px]">
                      <label className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer">
                          <input type="radio" checked={updateType === "add"} onChange={() => setUpdateType("add")} className="text-primary focus:ring-primary bg-muted border-border" />
                          <span>Add (Skip Duplicates)</span>
                      </label>
                      <label className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer">
                          <input type="radio" checked={updateType === "replace"} onChange={() => setUpdateType("replace")} className="text-primary focus:ring-primary bg-muted border-border" />
                          <span>Replace All Data</span>
                      </label>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                >
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
              </form>
            </div>

            {/* List Section */}
            <div className="glass-panel p-6 rounded-2xl mt-8">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="text-xl font-semibold text-foreground">Student Directory</h3>
                <div className="relative w-full sm:w-64">
                  <input 
                    type="text"
                    placeholder="Search students..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                  />
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Student Name</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">GR Number</th>
                      <th className="px-6 py-4 font-medium">Department</th>
                      <th className="px-6 py-4 font-medium">Class (Sem)</th>
                      <th className="px-6 py-4 font-medium">Subjects</th>
                      <th className="px-6 py-4 font-medium">Account Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{student.name}</div>
                          <div className="text-xs text-muted-foreground">Enrollment: {student.enrollment_no}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{student.email || '-'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{student.gr_no}</td>
                        <td className="px-6 py-4 text-muted-foreground">{student.department || '-'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{student.class_name ? `${student.class_name} (Sem ${student.semester})` : '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {student.subjects.map((s: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs border border-primary/20">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {!student.has_password && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
                              No Password
                            </span>
                          )}
                          {student.has_password && !student.password_email_sent && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                              Pending Email
                            </span>
                          )}
                          {student.has_password && student.password_email_sent && student.must_change_password && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Email Sent
                            </span>
                          )}
                          {student.has_password && !student.must_change_password && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                              Password Changed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDelete(student.id)}
                            className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors"
                            title="Delete Student"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              type="button"
                              onClick={() => handleOpenEdit(student)}
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Edit Student"
                              aria-label={`Edit ${student.name}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDelete(student.id)}
                              className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Delete Student"
                              aria-label={`Delete ${student.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                          No students found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Student</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update student profile, enrollment details, and class assignment.
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
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    GR Number
                  </label>
                  <input
                    type="text"
                    value={editForm.gr_no}
                    onChange={(e) => setEditForm({ ...editForm, gr_no: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="GR1001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Enrollment Number
                  </label>
                  <input
                    type="text"
                    value={editForm.enrollment_no}
                    onChange={(e) => setEditForm({ ...editForm, enrollment_no: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="ENR2024001"
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
                  placeholder="student@university.edu"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Assigned Class
                  </label>
                  <select
                    value={editForm.class_id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        class_id: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.department ? `${cls.department} Sem-${cls.semester} ${cls.name}` : `Sem-${cls.semester} ${cls.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Enrolled Subjects
                </label>
                <input
                  type="text"
                  value={editForm.subjects}
                  onChange={(e) => setEditForm({ ...editForm, subjects: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. Data Structures, Web Development, Cloud Computing"
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
