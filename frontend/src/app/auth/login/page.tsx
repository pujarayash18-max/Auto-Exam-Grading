"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("username", username.trim());
      formData.append("password", password);

      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = "Invalid credentials. Please try again.";
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (Array.isArray(data.detail)) {
          msg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
        } else if (data.detail) {
          msg = JSON.stringify(data.detail);
        }
        throw new Error(msg);
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_role", data.role);
      document.cookie = `refresh_token=${data.access_token}; path=/; max-age=604800; SameSite=Lax`;

      if (data.must_change_password) {
        router.push("/auth/change-password");
      } else {
        router.push(`/${data.role}/dashboard`);
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedInput = forgotEmail.trim();
    if (!trimmedInput) {
      setError("Please enter your registered email address or Login ID.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedInput,
          login_id: trimmedInput,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = "Failed to process request.";
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (Array.isArray(data.detail)) {
          msg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
        } else if (data.detail) {
          msg = JSON.stringify(data.detail);
        } else if (data.msg) {
          msg = data.msg;
        }
        throw new Error(msg);
      }

      setSuccess(
        data.msg ||
          "If an account with this email or Login ID exists, password reset instructions have been sent."
      );
      setForgotEmail("");
    } catch (err: any) {
      setError(err.message || "Failed to process password reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)] px-4">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 shadow-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] flex items-center justify-center font-bold text-base mb-3 shadow-sm">
            AE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            AutoExam
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Automated Exam & Grading Platform
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-text)]/20 text-xs mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-text)]/20 text-xs mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {forgotPasswordMode ? (
          /* Forgot Password View */
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                Registered Email Address or Login ID
              </label>
              <input
                type="text"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="e.g. user@example.com or EMP001"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                required
              />
              <p className="text-[11px] text-[var(--text-subtle)] mt-1">
                We will email temporary sign-in credentials to the account on file.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-medium text-sm transition-colors duration-150 disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1"
            >
              {loading ? "Processing..." : "Reset Password"}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordMode(false);
                  setError("");
                  setSuccess("");
                }}
                className="text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          /* Sign In View */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                Login ID / Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or EMP001"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[var(--text-muted)]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(true);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-xs text-[var(--primary)] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-medium text-sm transition-colors duration-150 disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* Footer Legal Links */}
        <div className="mt-8 pt-4 border-t border-[var(--border)] flex justify-center items-center gap-3 text-xs text-[var(--text-muted)]">
          <Link href="/privacy" className="hover:text-[var(--text)] hover:underline">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-[var(--text)] hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
