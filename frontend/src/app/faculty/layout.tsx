'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LayoutDashboard, MonitorPlay, ClipboardCheck, LogOut, Coins, Zap, RotateCcw } from 'lucide-react';

interface FacultyWallet {
  faculty_id: number;
  faculty_name: string;
  email: string;
  department: string;
  tokens_consumed: number;
  quota_ceiling: number | null;
  quota_remaining: number | null;
  has_quota_limit: boolean;
  active_reserved_tokens: number;
  active_reservations_count: number;
  tokens_reclaimed: number;
  institutional_token_balance: number;
  is_depleted: boolean;
  active_provider: string;
}

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [wallet, setWallet] = useState<FacultyWallet | null>(null);

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const res = await fetch("http://localhost:8000/api/v1/faculty/wallet", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
      }
    } catch (err) {
      console.error("Failed to load faculty wallet", err);
    }
  };

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "refresh_token=; path=/; max-age=0";
    router.push("/auth/login");
  };

  const navItems = [
    { 
      path: '/faculty/dashboard', 
      name: "Dashboard", 
      icon: <LayoutDashboard className="w-5 h-5" /> 
    },
    { 
      path: '/faculty/viva', 
      name: "Conduct Viva", 
      icon: <MonitorPlay className="w-5 h-5" /> 
    },
    { 
      path: '/faculty/results', 
      name: "Results & Publish", 
      icon: <ClipboardCheck className="w-5 h-5" /> 
    },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-[260px] min-w-[260px] max-w-[260px] h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between hidden md:flex shrink-0 transition-colors duration-150 z-20">
        <div className="flex flex-col min-h-0 flex-1">
          <Link 
            href="/faculty/dashboard"
            className="h-16 flex items-center px-5 border-b border-[var(--border)] cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center mr-3 font-bold text-sm tracking-tight shadow-sm shrink-0">
              AE
            </div>
            <span className="text-base font-semibold text-[var(--text)] tracking-tight">
              AutoExam
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              Faculty
            </span>
          </Link>
          
          <nav className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link 
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    isActive 
                      ? "bg-[var(--primary)] text-[var(--primary-text)] font-semibold shadow-sm" 
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[var(--primary-text)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'}`}>
                    {Icon}
                  </div>
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Faculty AI Token Wallet Widget */}
          {wallet && (
            <div className="mx-3 mb-2 p-3 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground tracking-tight">AI Token Wallet</span>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${wallet.is_depleted ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
                  {wallet.is_depleted ? 'Depleted' : 'Active'}
                </span>
              </div>

              {wallet.has_quota_limit && wallet.quota_ceiling ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Used:</span>
                    <span className="font-mono font-medium text-foreground">
                      {wallet.tokens_consumed.toLocaleString()} / {wallet.quota_ceiling.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded h-1.5 overflow-hidden">
                    <div 
                      className="bg-primary h-1.5 rounded transition-all duration-300" 
                      style={{ width: `${Math.min(100, Math.round((wallet.tokens_consumed / wallet.quota_ceiling) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                    <span>Remaining:</span>
                    <span className="font-mono font-medium text-foreground">
                      {(wallet.quota_remaining ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Consumed:</span>
                    <span className="font-mono font-medium text-foreground">{wallet.tokens_consumed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Quota:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Unlimited Access</span>
                  </div>
                </div>
              )}

              {/* In-Flight Soft Reservation Badge */}
              {wallet.active_reserved_tokens > 0 && (
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <Zap className="w-3 h-3" />
                    In Exam:
                  </span>
                  <span className="font-mono text-foreground font-medium">
                    {wallet.active_reserved_tokens.toLocaleString()} locked
                  </span>
                </div>
              )}

              {/* Zero-Waste Reclaimed Badge */}
              {wallet.tokens_reclaimed > 0 && (
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <RotateCcw className="w-3 h-3" />
                    Reclaimed:
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    +{wallet.tokens_reclaimed.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
            {children}
        </div>
      </main>
    </div>
  );
}
