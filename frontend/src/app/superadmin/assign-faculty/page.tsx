"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { useRouter } from "next/navigation";
import { UploadCloud, Save, X } from "lucide-react";

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/auth/login");

    try {
      const [facRes, clsRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/admin/faculties", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("http://localhost:8000/api/v1/admin/classes", {
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
      const res = await fetch("http://localhost:8000/api/v1/admin/classes/upload", {
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
      const res = await fetch(`http://localhost:8000/api/v1/admin/faculty/${facultyId}/assign-classes`, {
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
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
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
                  className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
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
                                  <li key={idx} className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded border border-border">
                                    <span className="text-muted-foreground">
                                      <span className="font-medium text-primary">{clsName}</span> - {a.subject_code ? `${a.subject_code} ` : ''}{a.subject_name}
                                    </span>
                                    <button 
                                      onClick={() => handleRemoveAssignment(faculty.id, a.class_id, a.subject_name)}
                                      className="text-destructive/70 hover:text-destructive ml-2 p-1"
                                      title="Remove Assignment"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
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
                              className="bg-primary/10 text-primary py-1.5 rounded-lg border border-primary/20 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
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
                        </td>
                      </tr>
                    )})}
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
    </div>
  );
}
