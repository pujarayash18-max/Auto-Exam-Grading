'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { User, FileText, Calendar, LogOut, Download, Sparkles, AlertCircle } from 'lucide-react';

export default function StudentDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('results');
  const [profile, setProfile] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [scheduledExams, setScheduledExams] = useState<any[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    fetchProfile();
    fetchResults();
    fetchScheduledExams();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      const res = await fetch('http://localhost:8000/api/v1/student/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProfile(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:8000/api/v1/student/results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setResults(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchScheduledExams = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:8000/api/v1/student/scheduled-exams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setScheduledExams(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "refresh_token=; path=/; max-age=0";
    router.push("/auth/login");
  };

  const toggleExpandRun = (runId: number) => {
    setExpandedRuns(prev => ({
      ...prev,
      [runId]: !prev[runId]
    }));
  };

  const navItems = [
    { id: 'profile', name: "Profile", icon: <User className="w-[18px] h-[18px]" /> },
    { id: 'results', name: "Recording & Transcripts", icon: <FileText className="w-[18px] h-[18px]" /> },
    { id: 'scheduled', name: "Scheduled Exams", icon: <Calendar className="w-[18px] h-[18px]" /> },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-[260px] min-w-[260px] max-w-[260px] h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between hidden md:flex shrink-0 transition-colors duration-150 z-20">
        <div className="flex flex-col min-h-0 flex-1">
          <div className="h-16 flex items-center px-5 border-b border-[var(--border)] select-none">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center mr-3 font-bold text-sm tracking-tight shadow-sm shrink-0">
              AE
            </div>
            <span className="text-base font-semibold text-[var(--text)] tracking-tight">
              AutoExam
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              Student
            </span>
          </div>
          
          <nav className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    isActive 
                      ? "bg-[var(--primary)] text-[var(--primary-text)] font-semibold shadow-sm" 
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[var(--primary-text)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'}`}>
                    {item.icon}
                  </div>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer: Logout and Theme Toggle */}
        <div className="p-3 border-t border-[var(--border)] shrink-0 flex items-center gap-2">
          <button 
            type="button"
            onClick={handleLogout}
            className="flex-1 h-10 px-3 rounded-lg text-sm font-medium text-[var(--danger-text)] hover:bg-[var(--danger-bg)] flex items-center gap-2.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--danger-text)]/30"
            title="Sign out of AutoExam"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">Logout</span>
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            <header className="pb-2 border-b border-border">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground capitalize">
                {activeTab === 'profile' ? 'My Profile' : activeTab === 'results' ? 'Results, Transcripts & Diagnostic Remarks' : 'Scheduled Exams'}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Inspect your oral viva feedback, areas to improve, and download recorded spoken audio.
              </p>
            </header>

            {activeTab === 'profile' && profile && (
              <div className="bg-card p-6 lg:p-8 rounded-xl border border-border shadow-sm max-w-xl">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-border/50">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Name</span>
                    <span className="font-semibold text-base text-foreground">{profile.name}</span>
                  </div>
                  <div className="pb-3 border-b border-border/50">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Enrollment Number</span>
                    <span className="font-semibold text-base text-foreground">{profile.enrollment_number}</span>
                  </div>
                  <div className="pb-3 border-b border-border/50">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">GR Number</span>
                    <span className="font-semibold text-base text-foreground">{profile.gr_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Department</span>
                    <span className="font-semibold text-base text-foreground">{profile.department}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="bg-card p-6 lg:p-8 rounded-xl border border-border shadow-sm">
                {results.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No published viva results or feedback available yet.</p>
                ) : (
                  <div className="grid gap-6">
                    {results.map((r: any, i: number) => {
                      const showGrades = r.publish_grades !== false && r.score !== null;
                      const isExpanded = !!expandedRuns[r.viva_run_id];
                      const improvementReport = r.remarks || r.feedback;

                      return (
                        <div key={i} className="bg-muted/30 border border-border p-5 rounded-xl space-y-5 hover:border-primary/20 transition-all">
                          
                          {/* Top Row: Subject, Scores/Badges, Actions */}
                          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold text-foreground">{r.subject}</h3>
                                {showGrades ? (
                                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    ✓ Grades Released
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    🔒 Grades Withheld (Remarks & Audio Only)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Completed: {new Date(r.completed_at).toLocaleString()}
                              </p>

                              {/* Grade cards (Only if showGrades is true) */}
                              {showGrades ? (
                                <div className="mt-3 flex gap-3">
                                  <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-sm">
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total Score</span>
                                    <span className="text-lg font-bold text-primary">{r.score}%</span>
                                  </div>
                                  <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-sm">
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Final Grade</span>
                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{r.grade}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 bg-card px-4 py-2.5 rounded-lg border border-amber-500/20 max-w-lg">
                                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    Official numerical score and letter grade are withheld by faculty for this exam. Your audio recording, transcript, and AI diagnostic remarks are provided below for study and improvement.
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Download Action Buttons */}
                            <div className="flex flex-wrap gap-2.5">
                              <button 
                                onClick={async () => {
                                  const token = localStorage.getItem('access_token');
                                  try {
                                    const res = await fetch(`http://localhost:8000/api/v1/results/${r.viva_run_id}/audio/download`, {
                                      headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (res.ok) {
                                      const blob = await res.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      const contentDisposition = res.headers.get('Content-Disposition') || '';
                                      const filenameMatch = contentDisposition.match(/filename=(.+)/);
                                      a.download = filenameMatch ? filenameMatch[1] : `audio_${r.subject.replace(/ /g, '_')}_${r.viva_run_id}.webm`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    } else if (res.status === 404) {
                                      alert('No audio recordings available for this viva.');
                                    } else {
                                      alert('Failed to download audio');
                                    }
                                  } catch(e) {
                                    console.error(e);
                                    alert('Error downloading audio');
                                  }
                                }}
                                className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download Audio
                              </button>
                              
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
                                      a.download = `transcript_${r.subject.replace(/ /g, '_')}_${r.viva_run_id}.txt`;
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
                                className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors shadow-sm flex items-center gap-2"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Download Transcript
                              </button>
                            </div>
                          </div>

                          {/* AI Performance Judgment & Improvement Remarks Card */}
                          {improvementReport && (
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 shadow-sm space-y-2">
                              <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
                                <Sparkles className="w-4 h-4" />
                                AI Performance Diagnostic & Areas to Improve
                              </div>
                              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-card p-3.5 rounded-lg border border-border font-sans">
                                {improvementReport}
                              </div>
                            </div>
                          )}

                          {/* Question Breakdown Toggle Button */}
                          {r.answers && r.answers.length > 0 && (
                            <div className="space-y-3">
                              <button
                                onClick={() => toggleExpandRun(r.viva_run_id)}
                                className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
                              >
                                <span>{isExpanded ? '▲ Hide Question Breakdown' : `▼ View Question Breakdown (${r.answers.length} Questions)`}</span>
                              </button>

                              {/* Question List */}
                              {isExpanded && (
                                <div className="space-y-3 pt-1">
                                  {r.answers.map((ans: any, qIdx: number) => (
                                    <div key={qIdx} className="bg-muted/40 p-4 rounded-xl border border-border space-y-2.5">
                                      <div className="flex justify-between items-start gap-4">
                                        <p className="text-sm font-semibold text-foreground">
                                          Q{qIdx + 1}: {ans.question_text}
                                        </p>
                                        {showGrades && ans.score_awarded !== null && (
                                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                            Score: {ans.score_awarded}/100
                                          </span>
                                        )}
                                      </div>

                                      {/* Student Spoken Transcript */}
                                      <div className="bg-card p-3 rounded-lg border border-border">
                                        <span className="text-[11px] text-muted-foreground uppercase font-semibold block mb-0.5">Spoken Answer</span>
                                        <p className="text-xs text-foreground font-mono leading-relaxed">
                                          "{ans.transcript || 'No speech recorded.'}"
                                        </p>
                                      </div>

                                      {/* AI Feedback */}
                                      {ans.feedback && (
                                        <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                                          <span className="font-semibold block mb-0.5">AI Evaluation Feedback</span>
                                          {ans.feedback}
                                        </div>
                                      )}

                                      {/* Areas to Improve */}
                                      {ans.areas_to_improve && (
                                        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                                          <span className="font-semibold block mb-0.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Key Areas to Improve
                                          </span>
                                          {ans.areas_to_improve}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'scheduled' && (
              <div className="bg-card p-6 lg:p-8 rounded-xl border border-border shadow-sm">
                {scheduledExams.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No scheduled exams right now.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {scheduledExams.map((exam: any) => (
                      <div key={exam.id} className="bg-muted/40 border border-border p-5 rounded-xl flex flex-col justify-between hover:bg-muted/60 transition-colors">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{exam.subject_name}</h3>
                          <p className="text-xs text-muted-foreground mt-2">Questions: {exam.questions_per_student}</p>
                          <p className="text-xs text-muted-foreground mt-1">Time per Question: {exam.timer_per_question_minutes} min</p>
                        </div>
                        <button 
                          onClick={() => {
                            router.push(`/student/exam/${exam.id}`);
                          }}
                          className="mt-5 w-full h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                          Join Waiting Room
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
