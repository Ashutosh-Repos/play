"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

function SetUsernameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { data: session, status } = useSession();

  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestion, setSuggestion] = useState("");

  // Determine auth mode: token (credential reg) or session (OAuth)
  const isOAuthFlow = !token && status === "authenticated";
  const isCredentialFlow = !!token;
  const isValidFlow = isOAuthFlow || isCredentialFlow;

  // Check username availability on change (debounced)
  useEffect(() => {
    if (username.length < 3) {
      setAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`/api/users/check-username?username=${username}`);
        const data = await res.json();
        if (data.success) {
          setAvailable(data.data.available);
          setSuggestion(data.data.suggestion || "");
        }
      } catch {
        // Ignore
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isCredentialFlow) {
        // Credential flow: complete registration with token
        const res = await fetch("/api/auth/complete-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, username }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error?.message || "Failed to complete registration");
          setIsLoading(false);
          return;
        }

        router.push("/login?registered=true");
      } else if (isOAuthFlow) {
        // OAuth flow: update username via API
        const res = await fetch("/api/users/set-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error?.message || "Failed to set username");
          setIsLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };

  // Loading state for session check
  if (status === "loading") {
    return <div className="text-white text-center">Loading...</div>;
  }

  // Invalid flow - neither token nor session
  if (!isValidFlow) {
    return (
      <div className="text-center text-red-400">
        Invalid registration link. Please register again.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Choose your username</h1>
        <p className="text-zinc-400">This will be your unique handle on Play</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            required
            minLength={3}
            maxLength={30}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="johndoe"
          />
          <div className="mt-2 h-5">
            {isChecking && (
              <span className="text-zinc-400 text-sm">Checking...</span>
            )}
            {!isChecking && available === true && (
              <span className="text-green-400 text-sm">✓ Available</span>
            )}
            {!isChecking && available === false && (
              <span className="text-red-400 text-sm">
                ✗ Taken. Try: {suggestion}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || available === false || username.length < 3}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isLoading ? "Setting username..." : "Complete Setup"}
        </button>
      </form>
    </div>
  );
}

export default function SetUsernamePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <SetUsernameForm />
        </Suspense>
      </div>
    </div>
  );
}
