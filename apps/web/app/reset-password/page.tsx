"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to reset password");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-400 mb-4">Invalid reset link.</p>
        <Link href="/login" className="text-blue-500 hover:text-blue-400">
          Back to login
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Password Reset!</h1>
        <p className="text-zinc-400 mb-6">You can now log in with your new password.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-zinc-400">Enter your new password</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-lg transition-colors"
        >
          {isLoading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
