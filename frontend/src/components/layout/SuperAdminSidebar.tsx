"use client";

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
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SuperAdminSidebar() {
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
  );
}
