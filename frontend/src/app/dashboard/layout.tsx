"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (!token && !pathname.includes("/login")) {
      router.push("/auth/login");
    }
  }, [router, pathname]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Basic Sidebar placeholder */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-gray-700">
          AutoExamGrading
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {pathname.startsWith("/superadmin") && <div>Superadmin Menu</div>}
          {pathname.startsWith("/admin") && <div>Admin Menu</div>}
          {pathname.startsWith("/faculty") && <div>Faculty Menu</div>}
          {pathname.startsWith("/student") && <div>Student Menu</div>}
        </nav>
        <div className="p-4 border-t border-gray-700 text-sm">
          <button
            onClick={() => {
              localStorage.removeItem("token");
              router.push("/auth/login");
            }}
            className="w-full text-left text-red-400 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
