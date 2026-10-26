"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function FacultySidebar() {
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
      name: "Dashboard",
      path: "/faculty-dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    // The FacultyDashboard page itself handles sub-tabs, but if the user wants separate pages we can change it later.
    // For now, let's keep it as one page but styled uniformly.
  ];

  return (
    <aside className="w-64 glass-panel border-r border-white/10 flex flex-col justify-between hidden md:flex shrink-0 h-screen bg-slate-900">
      <div>
        <Link href="/faculty-dashboard" className="h-20 flex items-center px-8 border-b border-white/10 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mr-3 shadow-md shadow-blue-600/20">
            <span className="font-bold text-white tracking-tight">AE</span>
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            AutoExam
          </h1>
        </Link>
        
        <nav className="p-4 space-y-2 mt-4 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path}
                href={item.path}
                prefetch={false}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? "bg-blue-600/15 text-white border border-blue-500/20 shadow-sm" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className={`${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'} transition-colors`}>
                  {item.icon}
                </div>
                <span className="ml-3 font-medium text-sm">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 group"
        >
          <svg className="w-5 h-5 text-gray-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="ml-3 font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
