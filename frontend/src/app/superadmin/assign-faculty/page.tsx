"use client";
import { API_BASE_URL } from '@/lib/api';

import { useState, useEffect, useMemo, useRef } from "react";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { useRouter } from "next/navigation";
import { UploadCloud, Save, X, Pencil, Plus } from "lucide-react";

export default function AssignFaculty() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [updateType, setUpdateType] = useState("add");
  const [faculties, setFaculties] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assignments, setAssignments] = useState<Record<number, any[]>>({}); // faculty_id -> array of { class_id, subject_code, subject_name }
  
  const [newAssignment, setNewAssignment] = useState<Record<number, { class_id: number | "", subject: string }>>({});

  // Single Mapping Edit Modal State
  const [editingMapping, setEditingMapping] = useState<{
    faculty: any;
    index: number;
    assignment: any;
  } | null>(null);
  const [editMappingForm, setEditMappingForm] = useState<{
    class_id: number | "";
    subject: string;
  }>({ class_id: "", subject: "" });
  const [singleEditLoading, setSingleEditLoading] = useState(false);

  // All Mappings Edit Modal for a Faculty
  const [facultyForModal, setFacultyForModal] = useState<any | null>(null);
  const [modalAssignmentsList, setModalAssignmentsList] = useState<any[]>([]);
  const [modalNewAssignment, setModalNewAssignment] = useState<{ class_id: number | ""; subject: string }>({ class_id: "", subject: "" });
  const [modalSaving, setModalSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/auth/login");

    try {
      const [facRes, clsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/admin/faculties`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/v1/admin/classes`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (facRes.status === 401 || clsRes.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        document.cookie = "refresh_token=; path=/; max-age=0";
        return router.push("/auth/login");
      }

      if (facRes.ok) {
        const facs = await facRes.json();
        setFaculties(facs);
        const initialAssignments: Record<number, any[]> = {};
        facs.forEach((f: any) => {
          initialAssignments[f.id] = f.assignments || [];
        });
        setAssignments(initialAssignments);
      }
      if (clsRes.ok) setClasses(await clsRes.json());
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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/classes/upload`, {
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
      fetchData(); // Refresh classes
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = (facultyId: number) => {
    const na = newAssignment[facultyId];
    if (!na || !na.class_id || !na.subject) return;

    let subject_code = "";
    let subject_name = na.subject;
    if (na.subject.includes(" - ")) {
      const parts = na.subject.split(" - ");
      subject_code = parts[0];
      subject_name = parts[1];
    }

    setAssignments(prev => {
      const current = prev[facultyId] || [];
      // Prevent duplicates
      if (current.some(a => a.class_id === na.class_id && a.subject_name === subject_name)) {
        return prev;
      }
      return {
        ...prev,
        [facultyId]: [...current, { class_id: Number(na.class_id), subject_code, subject_name }]
      };
    });

    // Reset local new assignment
    setNewAssignment(prev => ({ ...prev, [facultyId]: { class_id: "", subject: "" } }));
  };

  const handleRemoveAssignment = (facultyId: number, class_id: number, subject_name: string) => {
    setAssignments(prev => {
      const current = prev[facultyId] || [];
      return {
        ...prev,
        [facultyId]: current.filter(a => !(a.class_id === class_id && a.subject_name === subject_name))
      };
    });
  };

  const handleSaveAssignments = async (facultyId: number) => {
    const payloadAssignments = assignments[facultyId] || [];
    const token = localStorage.getItem("access_token");
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculty/${facultyId}/assign-classes`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ assignments: payloadAssignments })
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        return router.push("/auth/login");
      }
      
      if (!res.ok) throw new Error("Failed to assign classes");
      setSuccess("Classes assigned successfully!");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Open Single Mapping Edit Modal
  const handleOpenEditAssignment = (faculty: any, index: number, a: any) => {
    setEditingMapping({ faculty, index, assignment: a });
    const fullSubj = a.subject_code ? `${a.subject_code} - ${a.subject_name}` : a.subject_name;
    setEditMappingForm({
      class_id: a.class_id,
      subject: fullSubj,
    });
  };

  const handleCloseEditAssignment = () => {
    setEditingMapping(null);
  };

  const handleSaveSingleMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMapping || !editMappingForm.class_id || !editMappingForm.subject) return;

    setSingleEditLoading(true);
    let subject_code = "";
    let subject_name = editMappingForm.subject;
    if (editMappingForm.subject.includes(" - ")) {
      const parts = editMappingForm.subject.split(" - ");
      subject_code = parts[0].trim();
      subject_name = parts[1].trim();
    }

    const facultyId = editingMapping.faculty.id;
    const currentList = [...(assignments[facultyId] || [])];
    currentList[editingMapping.index] = {
      class_id: Number(editMappingForm.class_id),
      subject_code,
      subject_name,
    };

    setAssignments((prev) => ({
      ...prev,
      [facultyId]: currentList,
    }));

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculty/${facultyId}/assign-classes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignments: currentList }),
      });
      if (!res.ok) throw new Error("Failed to update mapping on server");
      setSuccess("Mapping updated and saved successfully!");
      handleCloseEditAssignment();
    } catch (err: any) {
      setError(err.message || "Failed to update mapping");
    } finally {
      setSingleEditLoading(false);
    }
  };

  // Open All Mappings Modal for a Faculty
  const handleOpenFacultyMappingsModal = (faculty: any) => {
    setFacultyForModal(faculty);
    setModalAssignmentsList([...(assignments[faculty.id] || [])]);
    setModalNewAssignment({ class_id: "", subject: "" });
  };

  const handleCloseFacultyMappingsModal = () => {
    setFacultyForModal(null);
  };

  const handleModalAddAssignment = () => {
    if (!modalNewAssignment.class_id || !modalNewAssignment.subject) return;
    let subject_code = "";
    let subject_name = modalNewAssignment.subject;
    if (modalNewAssignment.subject.includes(" - ")) {
      const parts = modalNewAssignment.subject.split(" - ");
      subject_code = parts[0].trim();
      subject_name = parts[1].trim();
    }

    if (modalAssignmentsList.some((a) => a.class_id === modalNewAssignment.class_id && a.subject_name === subject_name)) {
      return;
    }

    setModalAssignmentsList((prev) => [
      ...prev,
      { class_id: Number(modalNewAssignment.class_id), subject_code, subject_name },
    ]);
    setModalNewAssignment({ class_id: "", subject: "" });
  };

  const handleModalRemoveAssignment = (index: number) => {
    setModalAssignmentsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveModalFacultyAssignments = async () => {
    if (!facultyForModal) return;
    setModalSaving(true);
    const facultyId = facultyForModal.id;
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/faculty/${facultyId}/assign-classes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignments: modalAssignmentsList }),
      });
      if (!res.ok) throw new Error("Failed to save assignments");
      setAssignments((prev) => ({
        ...prev,
        [facultyId]: modalAssignmentsList,
      }));
      setSuccess(`Mappings updated for ${facultyForModal.name}!`);
      handleCloseFacultyMappingsModal();
    } catch (err: any) {
      setError(err.message || "Failed to save assignments");
    } finally {
      setModalSaving(false);
    }
  };

  // Group classes
  const groupedClasses = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    classes.forEach(c => {
      const dept = c.department?.name || c.department || 'Unknown Department';
      const sem = `Sem-${c.semester}`;
      
      if (!groups[dept]) groups[dept] = {};
      if (!groups[dept][sem]) groups[dept][sem] = [];
      
      groups[dept][sem].push(c);
    });
    return groups;
  }, [classes]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
            <header>
              <h2 className="text-3xl font-bold text-foreground">
                Assign Faculty-Class
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Upload class lists and map faculties to their respective classes and subjects.
              </p>
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
                Upload Classes
              </h3>
              
              <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Excel/CSV File (Department, Semester, Class)</label>
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <div className="flex-1 w-full flex items-center space-x-4 mb-2">
                    <label className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer">
                        <input type="radio" checked={updateType === "add"} onChange={() => setUpdateType("add")} className="text-primary focus:ring-primary bg-muted border-border" />
                        <span>Add to Existing</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer">
                        <input type="radio" checked={updateType === "replace"} onChange={() => setUpdateType("replace")} className="text-primary focus:ring-primary bg-muted border-border" />
                        <span>Replace All</span>
                    </label>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                >
                  {loading ? 'Uploading...' : 'Upload Classes'}
                </button>
              </form>
            </div>

            {/* List Section */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-xl font-semibold mb-6 text-foreground">Faculty Class Assignments</h3>
              
              <div className="overflow-x-auto rounded-xl border border-border pb-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Faculty Name</th>
                      <th className="px-6 py-4 font-medium min-w-[300px]">Current Assignments</th>
                      <th className="px-6 py-4 font-medium min-w-[400px]">Add Assignment</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {faculties.map((faculty) => {
                      const facultyAssignments = assignments[faculty.id] || [];
                      const na = newAssignment[faculty.id] || { class_id: "", subject: "" };

                      return (
                      <tr key={faculty.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 align-top">
                          <div className="font-medium text-foreground">{faculty.name}</div>
                          <div className="text-xs text-muted-foreground">{faculty.emp_id}</div>
                          <div className="text-xs text-muted-foreground mt-1">{faculty.department}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {facultyAssignments.length === 0 ? (
                            <span className="text-muted-foreground italic">No assignments yet</span>
                          ) : (
                            <ul className="space-y-2">
                              {facultyAssignments.map((a, idx) => {
                                const clsObj = classes.find(c => c.id === a.class_id);
                                const clsName = clsObj ? `${clsObj.department} Sem-${clsObj.semester} ${clsObj.name}` : a.class_name || `Class ID ${a.class_id}`;
                                return (
                                  <li key={idx} className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
                                    <span className="text-muted-foreground text-xs">
                                      <span className="font-medium text-primary">{clsName}</span> - {a.subject_code ? `${a.subject_code} ` : ''}{a.subject_name}
                                    </span>
                                    <div className="flex items-center gap-1 ml-2">
                                      <button 
                                        type="button"
                                        onClick={() => handleOpenEditAssignment(faculty, idx, a)}
                                        className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                                        title="Edit this mapping"
                                        aria-label="Edit mapping"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => handleRemoveAssignment(faculty.id, a.class_id, a.subject_name)}
                                        className="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
                                        title="Remove Assignment"
                                        aria-label="Remove mapping"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            <select 
                              value={na.class_id}
                              onChange={e => setNewAssignment(prev => ({ ...prev, [faculty.id]: { ...na, class_id: e.target.value ? Number(e.target.value) : "" } }))}
                              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                            >
                              <option value="">-- Select Class --</option>
                              {Object.keys(groupedClasses).map(dept => (
                                <optgroup key={dept} label={dept}>
                                  {Object.keys(groupedClasses[dept]).map(sem => (
                                    groupedClasses[dept][sem].map(cls => (
                                      <option key={cls.id} value={cls.id}>{sem} {cls.name}</option>
                                    ))
                                  ))}
                                </optgroup>
                              ))}
                            </select>

                            <select
                              value={na.subject}
                              onChange={e => setNewAssignment(prev => ({ ...prev, [faculty.id]: { ...na, subject: e.target.value } }))}
                              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                            >
                              <option value="">-- Select Subject --</option>
                              {faculty.subjects?.map((subj: string, idx: number) => (
                                <option key={idx} value={subj}>{subj}</option>
                              ))}
                            </select>

                            <button 
                              onClick={() => handleAddAssignment(faculty.id)}
                              disabled={!na.class_id || !na.subject}
                              className="bg-primary/10 text-primary py-1.5 rounded-lg border border-primary/20 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <button 
                            onClick={() => handleSaveAssignments(faculty.id)}
                            className="flex items-center justify-center space-x-1 text-sm px-4 py-2 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors border border-accent/20 whitespace-nowrap ml-auto"
                          >
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </button>
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              type="button"
                              onClick={() => handleOpenFacultyMappingsModal(faculty)}
                              className="flex items-center justify-center space-x-1.5 text-xs font-semibold px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors border border-primary/20 whitespace-nowrap cursor-pointer"
                              title="Edit all mappings for this faculty"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit Mappings</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleSaveAssignments(faculty.id)}
                              className="flex items-center justify-center space-x-1.5 text-xs font-semibold px-3.5 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20 whitespace-nowrap cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                    {faculties.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                          No faculties found.
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

      {/* Edit Single Mapping Modal */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Class Mapping</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update assigned class or subject for {editingMapping.faculty.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditAssignment}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleMapping} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Select Class *
                </label>
                <select
                  required
                  value={editMappingForm.class_id}
                  onChange={(e) =>
                    setEditMappingForm({
                      ...editMappingForm,
                      class_id: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">-- Select Class --</option>
                  {Object.keys(groupedClasses).map((dept) => (
                    <optgroup key={dept} label={dept}>
                      {Object.keys(groupedClasses[dept]).map((sem) =>
                        groupedClasses[dept][sem].map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {sem} {cls.name}
                          </option>
                        ))
                      )}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={editMappingForm.subject}
                  onChange={(e) =>
                    setEditMappingForm({ ...editMappingForm, subject: e.target.value })
                  }
                  list="faculty-single-subjects"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. CS101 - Data Structures"
                />
                <datalist id="faculty-single-subjects">
                  {editingMapping.faculty.subjects?.map((s: string, i: number) => (
                    <option key={i} value={s} />
                  ))}
                </datalist>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Type a subject or pick from the faculty&apos;s available subjects.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseEditAssignment}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleEditLoading || !editMappingForm.class_id || !editMappingForm.subject}
                  className="px-4 py-2 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  {singleEditLoading ? "Saving..." : "Update Mapping"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit All Mappings Modal for Faculty */}
      {facultyForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Class & Subject Mappings: {facultyForModal.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage all assigned classes and subject teaching duties for this faculty member.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseFacultyMappingsModal}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Current Assignments ({modalAssignmentsList.length})
                </h4>
                {modalAssignmentsList.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    No classes or subjects mapped yet. Add one below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modalAssignmentsList.map((a, i) => {
                      const clsObj = classes.find((c) => c.id === a.class_id);
                      const clsName = clsObj
                        ? `${clsObj.department} Sem-${clsObj.semester} ${clsObj.name}`
                        : a.class_name || `Class ID ${a.class_id}`;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/40 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">{clsName}</span>
                            <span className="text-muted-foreground">&bull;</span>
                            <span className="text-foreground font-medium">
                              {a.subject_code ? `${a.subject_code} - ` : ""}
                              {a.subject_name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleModalRemoveAssignment(i)}
                            className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                            title="Remove mapping"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New Assignment in Modal */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Add New Mapping
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Class
                    </label>
                    <select
                      value={modalNewAssignment.class_id}
                      onChange={(e) =>
                        setModalNewAssignment({
                          ...modalNewAssignment,
                          class_id: e.target.value ? Number(e.target.value) : "",
                        })
                      }
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">-- Select Class --</option>
                      {Object.keys(groupedClasses).map((dept) => (
                        <optgroup key={dept} label={dept}>
                          {Object.keys(groupedClasses[dept]).map((sem) =>
                            groupedClasses[dept][sem].map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {sem} {cls.name}
                              </option>
                            ))
                          )}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Subject
                    </label>
                    <select
                      value={modalNewAssignment.subject}
                      onChange={(e) =>
                        setModalNewAssignment({ ...modalNewAssignment, subject: e.target.value })
                      }
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">-- Select Subject --</option>
                      {facultyForModal.subjects?.map((subj: string, idx: number) => (
                        <option key={idx} value={subj}>
                          {subj}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleModalAddAssignment}
                    disabled={!modalNewAssignment.class_id || !modalNewAssignment.subject}
                    className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors disabled:opacity-40"
                  >
                    + Add Mapping
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleCloseFacultyMappingsModal}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalFacultyAssignments}
                disabled={modalSaving}
                className="px-4 py-2 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {modalSaving ? "Saving..." : "Save All Mappings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
