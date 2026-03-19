"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SavedGame {
  _id: string;
  whitePlayer: string;
  blackPlayer: string;
  moves: string[];
  result: string;
  pgn: string;
  playedAt: string;
}

export default function GamesPage() {
  const router = useRouter();

  const [games,    setGames]    = useState<SavedGame[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState<SavedGame | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/auth"); return; }

    fetch("/api/games", {
      headers: { "Authorization": `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else            { setGames(data.games ?? []); }
      })
      .catch(() => setError("Failed to load games."))
      .finally(() => setLoading(false));
  }, [router]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function resultBadge(result: string) {
    if (result === "1-0")       return <span className="text-emerald-400 font-bold">1-0</span>;
    if (result === "0-1")       return <span className="text-red-400 font-bold">0-1</span>;
    if (result === "1/2-1/2")   return <span className="text-blue-400 font-bold">½-½</span>;
    return                             <span className="text-zinc-500 font-bold">*</span>;
  }

  function copyPgn(pgn: string) {
    navigator.clipboard.writeText(pgn).catch(() => {});
  }

  function downloadPgn(pgn: string, id: string) {
    const blob = new Blob([pgn], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `game-${id}.pgn`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Game History</h1>
            <p className="text-zinc-500 text-sm mt-1">Your saved games</p>
          </div>
          <button
            onClick={() => router.push("/play")}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all active:scale-95"
          >
            ♟ Play
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-12 text-center text-zinc-500">
            Loading games…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-6 text-center text-red-400">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && games.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-12 text-center space-y-3">
            <div className="text-5xl">♟</div>
            <p className="text-zinc-400 font-medium">No saved games yet</p>
            <p className="text-zinc-600 text-sm">Finish a game and click Save Game to store it here.</p>
            <button
              onClick={() => router.push("/play")}
              className="mt-2 px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
            >
              Start Playing
            </button>
          </div>
        )}

        {/* Game list */}
        {!loading && games.length > 0 && (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game._id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3"
              >
                {/* Top row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">♟</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {game.whitePlayer} <span className="text-zinc-500">vs</span> {game.blackPlayer}
                      </p>
                      <p className="text-[11px] text-zinc-600">{formatDate(game.playedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {resultBadge(game.result)}
                    <span className="text-[11px] text-zinc-600 tabular-nums">
                      {game.moves.length} move{game.moves.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Move list preview */}
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2">
                  <p className="text-[11px] font-mono text-zinc-500 truncate">
                    {game.moves.slice(0, 10).join(" ")}
                    {game.moves.length > 10 ? "…" : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(selected?._id === game._id ? null : game)}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                  >
                    {selected?._id === game._id ? "Hide PGN" : "View PGN"}
                  </button>
                  <button
                    onClick={() => copyPgn(game.pgn)}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                  >
                    Copy PGN
                  </button>
                  <button
                    onClick={() => downloadPgn(game.pgn, game._id)}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                  >
                    Download
                  </button>
                </div>

                {/* PGN expanded */}
                {selected?._id === game._id && (
                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-3 max-h-48 overflow-y-auto">
                    <p className="text-[10px] font-mono text-zinc-500 whitespace-pre-wrap break-all leading-relaxed">
                      {game.pgn}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Back */}
        <div className="text-center pt-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </main>
  );
}