"use client";

import { useEffect, useState } from "react";
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

function getResultTone(result: string): string {
  if (result === "1-0") return "lux-badge-emerald";
  if (result === "0-1") return "border border-[rgba(242,125,125,0.25)] bg-[rgba(116,27,27,0.24)] text-[rgba(255,192,192,0.92)]";
  if (result === "1/2-1/2") return "lux-badge-indigo";
  return "lux-badge";
}

export default function GamesPage() {
  const router = useRouter();

  const [games, setGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SavedGame | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    fetch("/api/games", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }

        const nextGames: SavedGame[] = data.games ?? [];
        setGames(nextGames);
        setSelected(nextGames[0] ?? null);
      })
      .catch(() => setError("Failed to load games."))
      .finally(() => setLoading(false));
  }, [router]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function copyPgn(pgn: string) {
    navigator.clipboard.writeText(pgn).catch(() => {});
  }

  function downloadPgn(pgn: string, id: string) {
    const blob = new Blob([pgn], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-${id}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="lux-shell min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="lux-ambient-orb left-[8%] top-20 h-56 w-56 bg-[rgba(124,130,255,0.12)]" />
      <div className="lux-ambient-orb right-[10%] top-10 h-56 w-56 bg-[rgba(215,182,125,0.14)]" />

      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="lux-panel rounded-[1.8rem] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="lux-kicker">Archive</p>
              <h1 className="lux-display mt-3 text-4xl text-white sm:text-5xl">Saved games</h1>
              <p className="mt-3 text-sm leading-7 text-white/54">
                Review completed games, inspect PGN, and return to play.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-white/66">
                {loading ? "Loading" : `${games.length} saved`}
              </span>
              <button
                onClick={() => router.push("/play")}
                className="lux-button-primary rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Play
              </button>
              <button
                onClick={() => router.push("/")}
                className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Home
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-[1.5rem] border border-[rgba(242,125,125,0.25)] bg-[rgba(116,27,27,0.24)] px-5 py-4 text-sm text-[rgba(255,192,192,0.92)]">
            {error}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_380px]">
          <div className="space-y-3">
            {loading && (
              <div className="lux-panel rounded-[1.7rem] px-5 py-10 text-center text-sm text-white/46">
                Loading games...
              </div>
            )}

            {!loading && !error && games.length === 0 && (
              <div className="lux-panel rounded-[1.9rem] px-6 py-12 text-center">
                <h2 className="lux-display text-4xl text-white">No saved games</h2>
                <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/52">
                  Finish a game and use Save Game to build your archive.
                </p>
                <button
                  onClick={() => router.push("/play")}
                  className="lux-button-primary mt-6 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                >
                  Start a new game
                </button>
              </div>
            )}

            {!loading && !error && games.length > 0 && (
              games.map((game) => {
                const isSelected = selected?._id === game._id;

                return (
                  <button
                    key={game._id}
                    onClick={() => setSelected(game)}
                    className={`w-full text-left transition-all duration-200 ${
                      isSelected ? "translate-y-[-1px]" : "hover:-translate-y-0.5"
                    }`}
                  >
                    <article className={`lux-panel rounded-[1.7rem] px-5 py-5 ${isSelected ? "border-[rgba(215,182,125,0.18)]" : ""}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`${getResultTone(game.result)} inline-flex rounded-full px-3 py-1 text-xs font-semibold`}>
                              {game.result === "1/2-1/2" ? "1/2-1/2" : game.result || "*"}
                            </span>
                            <span className="text-xs uppercase tracking-[0.28em] text-white/28">
                              {formatDate(game.playedAt)}
                            </span>
                          </div>

                          <h2 className="mt-3 text-xl font-semibold text-white">
                            {game.whitePlayer} <span className="text-white/28">vs</span> {game.blackPlayer}
                          </h2>
                          <p className="mt-3 font-mono text-xs leading-7 text-white/58">
                            {game.moves.slice(0, 12).join(" ")}
                            {game.moves.length > 12 ? " ..." : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-white/42">
                          <span>{game.moves.length} moves</span>
                          {isSelected && <span className="lux-badge-gold inline-flex rounded-full px-3 py-1 text-xs font-semibold">Selected</span>}
                        </div>
                      </div>
                    </article>
                  </button>
                );
              })
            )}
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="lux-panel-strong rounded-[1.9rem] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="lux-kicker">Selected game</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">PGN detail</h2>
                </div>
                {selected && (
                  <span className={`${getResultTone(selected.result)} inline-flex rounded-full px-3 py-1 text-xs font-semibold`}>
                    {selected.result === "1/2-1/2" ? "Draw" : selected.result}
                  </span>
                )}
              </div>

              {!selected ? (
                <p className="mt-6 text-sm leading-7 text-white/52">
                  Select a saved game to inspect its notation.
                </p>
              ) : (
                <>
                  <div className="mt-6 rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-sm text-white/72">
                      {selected.whitePlayer} <span className="text-white/28">vs</span> {selected.blackPlayer}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.28em] text-white/28">
                      {formatDate(selected.playedAt)}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => copyPgn(selected.pgn)}
                      className="lux-button-secondary flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      Copy PGN
                    </button>
                    <button
                      onClick={() => downloadPgn(selected.pgn, selected._id)}
                      className="lux-button-muted flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      Download
                    </button>
                  </div>

                  <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-[rgba(8,8,12,0.8)] p-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">PGN</p>
                    <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-[1rem] border border-white/6 bg-black/20 p-4">
                      <p className="font-mono text-[11px] leading-6 text-white/64 whitespace-pre-wrap break-all">
                        {selected.pgn}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
