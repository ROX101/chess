"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (email) setUserEmail(email);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setUserEmail("");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">♟</span>
            <span className="text-lg font-bold tracking-tight">Chess</span>
          </div>
          <div className="flex items-center gap-3">
            {userEmail ? (
              <>
                <span className="text-sm text-zinc-400 hidden sm:block">{userEmail}</span>
                <button
                  onClick={() => router.push("/games")}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition-all"
                >
                  History
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-semibold transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/auth")}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition-all"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push("/auth")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center space-y-8">

        <div className="text-8xl mb-4 select-none">♟</div>

        <div className="space-y-4 max-w-2xl">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            Play Chess.{" "}
            <span className="text-indigo-400">Your way.</span>
          </h1>
          <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed">
            Play locally with a friend, challenge the computer, or go head-to-head
            against a real opponent online. Track your games and improve over time.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            onClick={() => router.push("/play")}
            className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-lg font-bold transition-all shadow-lg shadow-indigo-900/40"
          >
            ♟ Play Now
          </button>
          <button
            onClick={() => router.push("/multiplayer")}
            className="px-8 py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white text-lg font-bold transition-all shadow-lg shadow-emerald-900/40"
          >
            🌐 Play Online
          </button>
          {!userEmail && (
            <button
              onClick={() => router.push("/auth")}
              className="px-8 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-lg font-bold transition-all"
            >
              Create Account
            </button>
          )}
          {userEmail && (
            <button
              onClick={() => router.push("/games")}
              className="px-8 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-lg font-bold transition-all"
            >
              View History
            </button>
          )}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">
            Everything you need
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "🌐",
                title: "Real-time Multiplayer",
                desc: "Play against a real opponent online. Quick match or invite a friend with a room code.",
              },
              {
                icon: "🤖",
                title: "AI Opponent",
                desc: "Four difficulty levels — Easy, Medium, Hard, and Expert powered by the Stockfish engine.",
              },
              {
                icon: "📊",
                title: "Eval Bar",
                desc: "Real-time position evaluation in Expert mode so you always know who's winning.",
              },
              {
                icon: "📖",
                title: "Opening Book",
                desc: "The Expert bot plays real openings like the Ruy Lopez, Sicilian, and Queen's Gambit.",
              },
              {
                icon: "⏱",
                title: "Chess Clock",
                desc: "Play with 1, 3, 5, or 10 minute time controls for a competitive experience.",
              },
              {
                icon: "💾",
                title: "Game History",
                desc: "Save your games to the cloud and download them as PGN files anytime.",
              },
              {
                icon: "🎵",
                title: "Sound Effects",
                desc: "Immersive audio cues for moves, captures, checks, and checkmates.",
              },
              {
                icon: "🏳",
                title: "Resign & Draw",
                desc: "Offer draws or resign gracefully in multiplayer games.",
              },
              {
                icon: "🔒",
                title: "Secure Auth",
                desc: "Register and login securely. Your games are saved to your account.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3 hover:border-zinc-700 transition-colors"
              >
                <div className="text-3xl">{icon}</div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modes ──────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 px-6 py-20 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <h2 className="text-3xl font-bold tracking-tight">Choose your mode</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            {/* Local */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 space-y-4 text-left">
              <div className="text-4xl">👥</div>
              <h3 className="text-xl font-bold">Local Play</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Pass and play with a friend on the same device. Full legal move
                highlighting, captured pieces, and move history.
              </p>
              <button
                onClick={() => router.push("/play")}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all"
              >
                Play Local
              </button>
            </div>

            {/* Vs Computer */}
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-8 space-y-4 text-left">
              <div className="text-4xl">🤖</div>
              <h3 className="text-xl font-bold">Vs Computer</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Challenge the AI at any difficulty. Play as White or Black.
                Expert mode uses Stockfish with a live evaluation bar.
              </p>
              <button
                onClick={() => router.push("/play")}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
              >
                Play vs Computer
              </button>
            </div>

            {/* Multiplayer */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8 space-y-4 text-left">
              <div className="text-4xl">🌐</div>
              <h3 className="text-xl font-bold">Multiplayer</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Play against a real opponent online in real time. Quick match or
                invite a friend with a room code.
              </p>
              <button
                onClick={() => router.push("/multiplayer")}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition-all"
              >
                Play Online
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-600">
            <span className="text-xl">♟</span>
            <span className="text-sm font-semibold">Chess</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-600">
            <button onClick={() => router.push("/play")}        className="hover:text-zinc-400 transition-colors">Solo</button>
            <button onClick={() => router.push("/multiplayer")} className="hover:text-zinc-400 transition-colors">Multiplayer</button>
            <button onClick={() => router.push("/auth")}        className="hover:text-zinc-400 transition-colors">Sign In</button>
            <button onClick={() => router.push("/games")}       className="hover:text-zinc-400 transition-colors">History</button>
          </div>
        </div>
      </footer>

    </main>
  );
}