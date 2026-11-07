"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  GraduationCap,
  School,
  Video,
  BookOpen,
  Settings,
  Cpu,
  CreditCard,
  Sliders,
  LogOut,
  FileSpreadsheet,
  ShieldAlert,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { performLogout } from "@/lib/auth";

export default function SuperAdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    performLogout();
  };

  const navItems = [
    {
      name: "Overview",
      path: "/superadmin/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "AI Models & Billing",
      path: "/superadmin/ai-settings",
      icon: Cpu,
    },
    {
      name: "Faculty Token Quotas",
      path: "/superadmin/faculty-quotas",
      icon: Sliders,
    },
    {
      name: "Manage Faculty",
      path: "/superadmin/manage-faculty",
      icon: Users,
    },
    {
      name: "Assign Faculty-Class",
      path: "/superadmin/assign-faculty",
      icon: UserPlus,
    },
    {
      name: "Manage Students",
      path: "/superadmin/manage-students",
      icon: GraduationCap,
    },
    {
      name: "Manage Classes",
      path: "/superadmin/manage-classes",
      icon: School,
    },
    {
      name: "Master Results & CSV",
      path: "/superadmin/results",
      icon: FileSpreadsheet,
    },
    {
      name: "Anti-Cheat Audit Feed",
      path: "/superadmin/anti-cheat",
      icon: ShieldAlert,
    },
    {
      name: "Faculty Module (Vivas)",
      path: "/faculty/dashboard",
      icon: Video,
    },
    {
      name: "Student Module",
      path: "/student/dashboard",
      icon: BookOpen,
    },
  ];

  return (
    <>
      {/* Mobile Top Header (Visible only on screens < 768px) */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 z-30">
        <Link href="/superadmin/dashboard" className="flex items-center gap-2.5 select-none">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center font-bold text-xs tracking-tight shadow-sm shrink-0">
            AE
          </div>
          <span className="font-semibold text-sm tracking-tight text-[var(--text)]">
            AutoExam
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
            Admin
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:bg-[var(--border)] transition"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex flex-col min-h-0 flex-1">
              <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center font-bold text-xs">
                    AE
                  </div>
                  <span className="font-semibold text-sm text-[var(--text)]">AutoExam</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                    Admin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[var(--primary)] text-[var(--primary-text)] font-semibold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Drawer Footer: Logout */}
            <div className="p-3 border-t border-[var(--border)] shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="flex-1 h-10 px-3 rounded-lg text-sm font-medium text-[var(--danger-text)] hover:bg-[var(--danger-bg)] flex items-center gap-2.5 transition-colors duration-150"
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar (Hidden on screens < 768px) */}
      <aside className="w-[260px] min-w-[260px] max-w-[260px] h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col justify-between hidden md:flex shrink-0 transition-colors duration-150">
        <div className="flex flex-col min-h-0 flex-1">
          {/* Header / Brand */}
          <Link
            href="/superadmin/dashboard"
            className="h-16 flex items-center px-5 border-b border-[var(--border)] cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center mr-3 font-bold text-sm tracking-tight shadow-sm shrink-0">
              AE
            </div>
            <span className="text-base font-semibold text-[var(--text)] tracking-tight">
              AutoExam
            </span>
          </Link>

          {/* Navigation */}
          <nav className="p-3 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  prefetch={false}
                  className={`group flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--primary-text)] font-semibold shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive
                        ? "text-[var(--primary-text)]"
                        : "text-[var(--text-muted)] group-hover:text-[var(--text)]"
                    }`}
                  />
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
    </>
  );
}
