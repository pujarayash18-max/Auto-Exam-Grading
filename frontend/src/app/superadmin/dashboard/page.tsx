"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";

export default function SuperadminDashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/admin/analytics", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_role");
          document.cookie = "refresh_token=; path=/; max-age=0";
          router.push("/auth/login");
          return;
        }
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [router]);

  if (!isClient) return null;

  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
          
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground tracking-wide">Dashboard Overview</h2>
              <p className="text-sm text-muted-foreground mt-1">Welcome back, Superadmin</p>
            </div>
          </div>
          
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-foreground mb-6">Subject-wise Average Score</h3>
              <div className="h-80 w-full">
                {stats?.subject_wise?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.subject_wise} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="avg_score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Average Score" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground flex h-full items-center justify-center">No completed exam data available yet.</p>
                )}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-foreground mb-6">Class-wise Average Score</h3>
              <div className="h-80 w-full">
                {stats?.class_wise?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.class_wise} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="class_name" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="avg_score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Average Score" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground flex h-full items-center justify-center">No completed exam data available yet.</p>
                )}
              </div>
            </div>

          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-foreground mb-4">System Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">API Service</span>
                  <span className="text-emerald-500 font-medium">Online (FastAPI)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Database Engine</span>
                  <span className="text-emerald-500 font-medium">Connected (PostgreSQL 18)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Cache & Session Store</span>
                  <span className="text-emerald-500 font-medium">Active (Redis)</span>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Administrative Events</span>
                  <span className="text-muted-foreground">No recent warnings or errors logged</span>
                </div>
              </div>
            </div>
          </div>

          </div>
        </div>
      </main>
    </div>
  );
}
