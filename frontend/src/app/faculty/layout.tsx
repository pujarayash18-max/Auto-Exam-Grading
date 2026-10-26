'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LayoutDashboard, MonitorPlay, ClipboardCheck, LogOut } from 'lucide-react';

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

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
