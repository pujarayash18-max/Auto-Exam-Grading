"use client";

import { useState, useEffect } from "react";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import { useRouter } from "next/navigation";
import { UploadCloud, Trash2 } from "lucide-react";

export default function ManageClasses() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [updateType, setUpdateType] = useState("add");
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/auth/login");

    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/classes", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        document.cookie = "refresh_token=; path=/; max-age=0";
        return router.push("/auth/login");
      }
      
      if (res.ok) {
        setClasses(await res.json());
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
      fetchClasses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/classes/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        return router.push("/auth/login");
      }
      
      if (res.ok) {
        fetchClasses();
      } else {
          const data = await res.json();
          const errDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
          setError(errDetail || "Deletion failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

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
                  Manage Classes
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Upload and manage classes.
                </p>
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
            <div className="glass-panel p-6">
              <h3 className="text-xl font-semibold mb-6 flex items-center text-foreground">
                <UploadCloud className="w-5 h-5 mr-3 text-primary" />
                Upload Classes Excel/CSV
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
                  className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground rounded-xl font-medium text-sm transition-all shadow-sm disabled:opacity-50"
                >
                  {loading ? "Uploading..." : "Upload Classes"}
                </button>
              </form>
            </div>

            {/* Classes List */}
            <div className="glass-panel overflow-hidden flex flex-col mt-8">
              <div className="p-6 border-b border-border">
                <h3 className="text-xl font-semibold">Classes List</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Department</th>
                      <th className="px-6 py-4 font-medium">Semester</th>
                      <th className="px-6 py-4 font-medium">Class Name</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {classes.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium">{c.department || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {c.semester}
                        </td>
                        <td className="px-6 py-4">
                          {c.name}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDelete(c.id)}
                            className="text-destructive/70 hover:text-destructive transition-colors p-2 hover:bg-destructive/10 rounded-lg"
                            title="Delete Class"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {classes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                          No classes found. Upload a file to add some.
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
