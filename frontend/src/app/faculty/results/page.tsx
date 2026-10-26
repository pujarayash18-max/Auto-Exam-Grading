'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, CheckCircle2, FileText, Send, Eye, X, RefreshCw, User, Sparkles, Sliders, Volume2, AlertCircle } from 'lucide-react';

export default function FacultyResultsDashboard() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Audit Modal State
  const [auditingStudent, setAuditingStudent] = useState<any | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Publish Settings Modals
  const [publishModalStudent, setPublishModalStudent] = useState<any | null>(null);
  const [publishAllModalOpen, setPublishAllModalOpen] = useState(false);
  const [includeGradesOption, setIncludeGradesOption] = useState(true);

  const fetchResults = async (examId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/results/exams/${examId}/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setResults(await res.json());
      else setResults([]);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:8000/api/v1/faculty/exams', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setExams(await res.json());
      } catch (err) { console.error(err); }
    };
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchResults(selectedExamId);
    } else {
      setResults([]);
    }
  }, [selectedExamId]);

  const executePublish = async (vivaRunId: number, publish: boolean, publishGrades: boolean = true) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/results/${vivaRunId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish, publish_grades: publishGrades })
      });
      if (res.ok) {
        setResults(prev => prev.map(r => 
          r.viva_run_id === vivaRunId 
            ? { ...r, is_published: publish, publish_grades: publishGrades } 
            : r
        ));
        if (auditingStudent && auditingStudent.viva_run_id === vivaRunId) {
          setAuditingStudent((prev: any) => prev ? { ...prev, is_published: publish, publish_grades: publishGrades } : null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishAllConfirmed = async (publishGrades: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      for (const r of results) {
        if (!r.is_published && r.status === 'completed') {
          await fetch(`http://localhost:8000/api/v1/results/${r.viva_run_id}/publish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ publish: true, publish_grades: publishGrades })
          });
        }
      }
      setResults(prev => prev.map(r => r.status === 'completed' ? { ...r, is_published: true, publish_grades: publishGrades } : r));
      setPublishAllModalOpen(false);
      alert(`All drafts published successfully (${publishGrades ? 'With Grades & Remarks' : 'Remarks, Audio & Transcript Only'}).`);
    } catch (err) {
      console.error(err);
      alert('Error publishing drafts.');
    }
  };

  const handleRegenerateReport = async (vivaRunId: number) => {
    setIsGeneratingReport(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/results/${vivaRunId}/generate-report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const newReport = data.report;
        setResults(prev => prev.map(r => r.viva_run_id === vivaRunId ? { ...r, feedback_notes: newReport } : r));
        if (auditingStudent && auditingStudent.viva_run_id === vivaRunId) {
          setAuditingStudent((prev: any) => prev ? { ...prev, feedback_notes: newReport } : null);
          const remarksEl = document.getElementById('override_remarks') as HTMLTextAreaElement;
          if (remarksEl) remarksEl.value = newReport;
        }
      } else {
        alert('Failed to regenerate report');
      }
    } catch (err) {
      console.error(err);
      alert('Error generating improvement report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const openAuditModal = (student: any) => {
    setAuditingStudent(student);
  };

  const saveOverride = async (newScore: number, newGrade: string, remarks?: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/results/${auditingStudent.viva_run_id}/override`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_score: newScore, new_grade: newGrade, faculty_remarks: remarks })
      });
      if (res.ok) {
        setResults(prev => prev.map(r => 
          r.viva_run_id === auditingStudent.viva_run_id 
            ? { ...r, total_score: newScore, grade: newGrade, feedback_notes: remarks } 
            : r
        ));
        setAuditingStudent((prev: any) => prev ? { ...prev, total_score: newScore, grade: newGrade, feedback_notes: remarks } : null);
        alert('Grade and remarks saved successfully.');
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-2 border-b border-border">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Review & Publish Results
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Audit AI evaluations, inspect transcripts, control grade visibility, and publish results to students.
            </p>
          </div>
          {results.some(r => !r.is_published && r.status === 'completed') && (
            <button 
              onClick={() => {
                setIncludeGradesOption(true);
                setPublishAllModalOpen(true);
              }}
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publish All Drafts
            </button>
          )}
        </header>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-full sm:w-80">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Select Exam</label>
            <select 
              value={selectedExamId} 
              onChange={e => setSelectedExamId(e.target.value)} 
              className="w-full h-10 bg-background border border-border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            >
              <option value="">-- Choose Exam --</option>
              {exams.map((e: any) => (
                <option key={e.id} value={e.id}>{e.subject_name} (Class ID: {e.class_id})</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : results.length > 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Student</th>
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Viva Status</th>
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Total Score</th>
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Final Grade</th>
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Questions</th>
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Publish Status</th>
                    <th className="p-3.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r: any) => (
                    <tr key={r.viva_run_id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5">
                        <p className="text-foreground font-medium text-sm">{r.name}</p>
                        <p className="text-muted-foreground text-xs font-mono">{r.gr_number} | {r.enrollment_number}</p>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider
                          ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 
                            r.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {r.status === 'completed' ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-bold text-foreground">{r.total_score}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                         <span className={`text-base font-bold ${r.grade === 'F' ? 'text-rose-600 dark:text-rose-400' : 'text-primary'}`}>
                           {r.grade || '-'}
                         </span>
                      </td>
                      <td className="p-3.5 text-sm text-muted-foreground">
                        {r.answers_count} questions
                      </td>
                      <td className="p-3.5">
                        {r.status === 'completed' && (
                          <button 
                            onClick={() => {
                              setPublishModalStudent(r);
                              setIncludeGradesOption(r.publish_grades !== false);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-colors border flex items-center gap-1.5
                              ${r.is_published 
                                ? (r.publish_grades !== false
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20')
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground'}`}
                            title="Click to change publication settings or unpublish"
                          >
                            <span>
                              {r.is_published 
                                ? (r.publish_grades !== false ? '✓ With Grades' : '✓ Remarks Only') 
                                : 'Draft (Publish)'}
                            </span>
                            <span className="text-[10px] opacity-60">▼</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {r.status === 'completed' && (
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={async () => {
                                const token = localStorage.getItem('access_token');
                                try {
                                  const res = await fetch(`http://localhost:8000/api/v1/results/${r.viva_run_id}/transcript/download`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  if (res.ok) {
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `transcript_${r.name.replace(/ /g, '_')}_${r.viva_run_id}.txt`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                  } else {
                                    alert('Failed to download transcript');
                                  }
                                } catch(e) {
                                  console.error(e);
                                  alert('Error downloading transcript');
                                }
                              }}
                              className="h-8 px-2.5 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5 text-muted-foreground" />
                              Download
                            </button>
                            <button 
                              onClick={() => openAuditModal(r)}
                              className="h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Audit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedExamId ? (
          <div className="bg-card p-12 rounded-xl border border-border text-center shadow-sm">
             <p className="text-foreground font-medium">No viva runs or completed results found for this exam.</p>
             <p className="text-xs text-muted-foreground mt-1">Start and conduct viva sessions from the "Conduct Viva" menu.</p>
          </div>
        ) : (
          <div className="bg-card p-12 rounded-xl border border-border text-center shadow-sm">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-60" />
            <p className="text-foreground font-medium">Select an exam above to review and audit student results.</p>
            <p className="text-xs text-muted-foreground mt-1">Transcripts, evaluations, and grading controls will be displayed.</p>
          </div>
        )}

      </div>

      {/* Individual Publish Modal */}
      {publishModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-foreground animate-in fade-in-50 zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">Publish Options: {publishModalStudent.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{publishModalStudent.gr_number} | {publishModalStudent.enrollment_number}</p>
              </div>
              <button 
                onClick={() => setPublishModalStudent(null)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includeGradesOption}
                  onChange={(e) => setIncludeGradesOption(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-background"
                />
                <span className="font-semibold text-foreground text-sm">Send Grades with Results</span>
              </label>

              {includeGradesOption ? (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 leading-relaxed">
                  ✓ Student will receive: <strong>Audio recording, transcript, AI improvement remarks, and numerical score ({publishModalStudent.total_score}%) with grade ({publishModalStudent.grade})</strong>.
                </div>
              ) : (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 leading-relaxed">
                  🔒 <strong>Grades will be withheld:</strong> Student will receive only their audio recording, transcript, and AI improvement remarks. Numerical score and grade will be hidden.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => {
                  executePublish(publishModalStudent.viva_run_id, true, includeGradesOption);
                  setPublishModalStudent(null);
                }}
                className="flex-1 h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors text-center"
              >
                Publish Now {includeGradesOption ? '(With Grades)' : '(Remarks & Audio Only)'}
              </button>

              {publishModalStudent.is_published && (
                <button
                  onClick={() => {
                    executePublish(publishModalStudent.viva_run_id, false);
                    setPublishModalStudent(null);
                  }}
                  className="h-10 px-4 bg-background hover:bg-muted text-foreground rounded-lg font-medium text-sm border border-border transition-colors"
                >
                  Revert to Draft
                </button>
              )}

              <button
                onClick={() => setPublishModalStudent(null)}
                className="h-10 px-4 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish All Drafts Modal */}
      {publishAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-foreground animate-in fade-in-50 zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">Publish All Draft Results</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure publication options for all completed student viva drafts in this exam.</p>
              </div>
              <button 
                onClick={() => setPublishAllModalOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includeGradesOption}
                  onChange={(e) => setIncludeGradesOption(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-background"
                />
                <span className="font-semibold text-foreground text-sm">Send Grades with Results to All Students</span>
              </label>

              {includeGradesOption ? (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 leading-relaxed">
                  ✓ All students will receive: <strong>Audio recordings, transcripts, AI improvement remarks, and numerical scores with final letter grades</strong>.
                </div>
              ) : (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 leading-relaxed">
                  🔒 <strong>Grades will NOT be published to students:</strong> All students will only receive their audio recordings, transcripts, and AI improvement remarks for diagnostic learning.
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => handlePublishAllConfirmed(includeGradesOption)}
                className="flex-1 h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors text-center"
              >
                Confirm & Publish All {includeGradesOption ? '(With Grades)' : '(Remarks & Audio Only)'}
              </button>
              <button
                onClick={() => setPublishAllModalOpen(false)}
                className="h-10 px-4 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit & Override Modal */}
      {auditingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-foreground overflow-hidden animate-in fade-in-50 zoom-in-95">
            
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
              <div>
                <h3 className="text-xl font-bold text-foreground">Audit Transcript: {auditingStudent.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">GR: {auditingStudent.gr_number} | Enrollment: {auditingStudent.enrollment_number}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('access_token');
                      const res = await fetch(`http://localhost:8000/api/v1/results/${auditingStudent.viva_run_id}/audio/download`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (!res.ok) {
                        alert('No audio recordings found for this student.');
                        return;
                      }
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `audio_${auditingStudent.name.replace(/ /g, '_')}_${auditingStudent.viva_run_id}.zip`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (err) {
                      alert('Could not download audio recording.');
                    }
                  }}
                  className="h-8 px-3 bg-background hover:bg-muted text-foreground rounded-lg text-xs font-semibold border border-border transition-colors flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  Download Audio
                </button>
                <button 
                  onClick={() => setAuditingStudent(null)} 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Cols: Real Answers, Feedback, and Improvement Areas */}
              <div className="lg:col-span-2 space-y-5">
                
                {/* AI Improvement Report Banner */}
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Executive Diagnostic & Improvement Report
                    </span>
                    <button
                      onClick={() => handleRegenerateReport(auditingStudent.viva_run_id)}
                      disabled={isGeneratingReport}
                      className="h-7 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium border border-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isGeneratingReport ? (
                        <>
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          Synthesizing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          Regenerate Report
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-sm text-foreground leading-relaxed font-sans whitespace-pre-line bg-card p-3.5 rounded-lg border border-border">
                    {auditingStudent.feedback_notes || 'No improvement report generated yet. Click "Regenerate Report" to synthesize AI diagnostic feedback.'}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Questions & Spoken Transcripts</h4>
                  {auditingStudent.answers && auditingStudent.answers.length > 0 ? (
                    <div className="space-y-3">
                      {auditingStudent.answers.map((ans: any, idx: number) => (
                        <div key={idx} className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
                          <p className="text-sm text-primary font-semibold">
                            Q{idx + 1}: {ans.question_text}
                          </p>
                          <div className="bg-card p-3 rounded-lg border border-border">
                            <span className="text-xs text-muted-foreground uppercase font-semibold block mb-1">Student Spoken Answer</span>
                            <p className="text-foreground text-sm leading-relaxed font-mono">
                              "{ans.transcript || 'No speech recorded.'}"
                            </p>
                          </div>
                          {ans.expected_answer && (
                            <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border">
                              <span className="text-foreground font-semibold block mb-0.5">Model Answer Reference</span>
                              {ans.expected_answer}
                            </div>
                          )}

                          {/* Audio Player if available */}
                          {ans.has_audio && ans.id && (
                            <div className="bg-card p-2.5 rounded-lg border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <span className="text-xs text-primary font-semibold flex items-center gap-1.5">
                                <Volume2 className="w-3.5 h-3.5" />
                                Spoken Audio
                              </span>
                              <audio
                                controls
                                src={`http://localhost:8000/api/v1/results/answers/${ans.id}/audio`}
                                className="h-8 w-full sm:w-64 accent-primary"
                              />
                            </div>
                          )}

                          {/* AI Evaluation Judgment & Feedback */}
                          {ans.feedback && (
                            <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                              <span className="font-semibold block mb-0.5 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                AI Judgment & Feedback
                              </span>
                              {ans.feedback}
                            </div>
                          )}

                          {/* Areas to Improve */}
                          {ans.areas_to_improve && (
                            <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                              <span className="font-semibold block mb-0.5 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Areas Needing Improvement
                              </span>
                              {ans.areas_to_improve}
                            </div>
                          )}

                          <div className="pt-1 flex justify-between items-center text-xs">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              AI Score: {ans.score_awarded !== null ? `${ans.score_awarded}/100` : 'Not scored'}
                            </span>
                            <span className="text-muted-foreground">Automated Evaluation</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-card p-6 rounded-xl border border-border text-center">
                      <p className="text-muted-foreground text-sm">No spoken answers recorded for this student.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Override Controls & Publishing */}
              <div className="space-y-5">
                
                {/* Publication Controls Card */}
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm space-y-3.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Publication Controls</h4>
                  
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-xs text-muted-foreground block mb-1">Current State</span>
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded inline-block
                      ${auditingStudent.is_published 
                        ? (auditingStudent.publish_grades !== false ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-sky-500/20 text-sky-600 dark:text-sky-400') 
                        : 'bg-muted text-muted-foreground'}`}>
                      {auditingStudent.is_published 
                        ? (auditingStudent.publish_grades !== false ? '✓ Published (With Grades)' : '✓ Published (Remarks Only)') 
                        : 'Draft (Unpublished)'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => executePublish(auditingStudent.viva_run_id, true, true)}
                      className="w-full h-9 px-3 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors text-center"
                    >
                      Publish With Grades
                    </button>
                    <button 
                      onClick={() => executePublish(auditingStudent.viva_run_id, true, false)}
                      className="w-full h-9 px-3 bg-sky-600/10 hover:bg-sky-600 text-sky-700 dark:text-sky-400 hover:text-white border border-sky-500/20 rounded-lg text-xs font-semibold transition-colors text-center"
                    >
                      Publish Remarks & Audio Only (No Grades)
                    </button>
                    {auditingStudent.is_published && (
                      <button 
                        onClick={() => executePublish(auditingStudent.viva_run_id, false)}
                        className="w-full h-8 px-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg text-xs font-medium transition-colors text-center border border-border"
                      >
                        Unpublish (Revert to Draft)
                      </button>
                    )}
                  </div>
                </div>

                {/* Score & Grade Override */}
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    Manual Override & Remarks
                  </h4>
                  
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Total Score (Percentage 0-100)</label>
                      <input 
                        type="number" 
                        id="override_score"
                        defaultValue={auditingStudent.total_score}
                        min="0"
                        max="100"
                        className="w-full h-10 bg-background border border-border rounded-lg px-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Final Grade</label>
                      <select 
                        id="override_grade"
                        defaultValue={auditingStudent.grade || "B"}
                        className="w-full h-10 bg-background border border-border rounded-lg px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      >
                        <option value="O">O (Outstanding)</option>
                        <option value="A+">A+</option>
                        <option value="A">A</option>
                        <option value="B+">B+</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="F">F</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Diagnostic Report / Faculty Remarks</label>
                      <textarea 
                        id="override_remarks"
                        defaultValue={auditingStudent.feedback_notes || ""}
                        placeholder="Diagnostic report or areas student needs to improve..."
                        className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none h-28"
                      ></textarea>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const scoreVal = parseFloat((document.getElementById('override_score') as HTMLInputElement).value);
                      const gradeVal = (document.getElementById('override_grade') as HTMLSelectElement).value;
                      const remarksVal = (document.getElementById('override_remarks') as HTMLTextAreaElement)?.value;
                      saveOverride(scoreVal, gradeVal, remarksVal);
                    }}
                    className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold text-sm shadow-sm transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
