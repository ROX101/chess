"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();

  const initialMode: AuthMode = "login";
  const [mode,     setMode]     = useState(initialMode);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint =
      mode === "login"
        ? "/api/auth/login"
        : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      // Store token and email
      localStorage.setItem("token", data.token);
      localStorage.setItem("userEmail", data.email);

      // Redirect to play
      router.push("/play");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setError("");
    setEmail("");
    setPassword("");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo / Title */}
        <div className="text-center space-y-2">
          <div className="text-6xl">♟</div>
          <h1 className="text-3xl font-bold tracking-tight">Chess</h1>
          <p className="text-zinc-500 text-sm">
            {mode === "login"
              ? "Sign in to save your games and track your history."
              : "Create an account to start playing and saving games."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl space-y-6">

          {/* Mode tabs */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-1 flex gap-1">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "login"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "register"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all"
            >
              {loading
                ? mode === "login" ? "Signing in…" : "Creating account…"
                : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-zinc-500">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              onClick={toggleMode}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              {mode === "login" ? "Register" : "Sign In"}
            </button>
          </p>
        </div>

        {/* Play as guest */}
        <div className="text-center">
          <button
            onClick={() => router.push("/play")}
            className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Continue as guest →
          </button>
        </div>

      </div>
    </main>
  );
}