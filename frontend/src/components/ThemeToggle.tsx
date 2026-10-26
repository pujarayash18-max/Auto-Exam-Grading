"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div 
        className={`h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] shrink-0 ${className}`} 
        aria-hidden="true" 
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 flex items-center justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-[18px] h-[18px] text-[var(--text)]" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-[var(--text)]" />
      )}
    </button>
  );
}
