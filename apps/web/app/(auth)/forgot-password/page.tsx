"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to send reset email");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Check your email</h1>
          <p className="text-zinc-400 mb-6">
            If an account with that email exists, we&apos;ve sent a password reset link.
          </p>
          <Link href="/login" className="text-blue-500 hover:text-blue-400">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Forgot password?</h1>
            <p className="text-zinc-400">Enter your email and we&apos;ll send you a reset link</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-lg transition-colors"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-zinc-400 text-sm hover:text-white">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
