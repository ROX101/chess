"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess, Move, Square } from "chess.js";
import { Chessboard } from "react-chessboard";

interface SavedGame {
  _id: string;
  whitePlayer: string;
  blackPlayer: string;
  moves: string[];
  result: string;
  pgn: string;
  playedAt: string;
}

type MoveClassification =
  | "Best"
  | "Excellent"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder";

interface EvalState {
  type: "cp" | "mate" | null;
  value: number;
}

interface EngineResult {
  bestMove: string;
  eval: EvalState;
}

interface ReviewMove {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  playedSan: string;
  playedUci: string;
  bestMoveUci: string;
  bestMoveSan: string;
  evalBefore: EvalState;
  evalAfter: EvalState;
  loss: number;
  classification: MoveClassification;
  fenBefore: string;
  fenAfter: string;
}

interface EngineRequest {
  resolve: (value: EngineResult) => void;
  reject: (reason?: unknown) => void;
  turn: "w" | "b";
  latestEval: EvalState;
}

const ANALYSIS_MOVETIME = 450;

function parseEvalLine(line: string, turnToMove: "w" | "b"): EvalState | null {
  if (!line.includes("score")) return null;

  const mateMatch = line.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const raw = parseInt(mateMatch[1], 10);
    return { type: "mate", value: turnToMove === "w" ? raw : -raw };
  }

  const cpMatch = line.match(/score cp (-?\d+)/);
  if (cpMatch) {
    const raw = parseInt(cpMatch[1], 10);
    return { type: "cp", value: turnToMove === "w" ? raw : -raw };
  }

  return null;
}

function evalToPawns(evalState: EvalState): number {
  if (evalState.type === null) return 0;
  if (evalState.type === "mate") {
    const magnitude = Math.max(0, 10 - Math.abs(evalState.value)) + 10;
    return evalState.value > 0 ? magnitude : -magnitude;
  }
  return evalState.value / 100;
}

function formatEval(evalState: EvalState): string {
  if (evalState.type === null) return "0.0";
  if (evalState.type === "mate") {
    const abs = Math.abs(evalState.value);
    return evalState.value > 0 ? `M${abs}` : `-M${abs}`;
  }
  const pawns = evalState.value / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function classifyMove(loss: number, isBestMove: boolean): MoveClassification {
  if (isBestMove || loss <= 0.05) return "Best";
  if (loss <= 0.3) return "Excellent";
  if (loss <= 0.8) return "Good";
  if (loss <= 1.5) return "Inaccuracy";
  if (loss <= 3.0) return "Mistake";
  return "Blunder";
}

function getClassificationTone(classification: MoveClassification): string {
  if (classification === "Best") return "lux-badge-gold";
  if (classification === "Excellent") return "lux-badge-emerald";
  if (classification === "Good") return "lux-badge-indigo";
  if (classification === "Inaccuracy") {
    return "border border-[rgba(215,182,125,0.22)] bg-[rgba(92,71,34,0.28)] text-[rgba(245,226,191,0.92)]";
  }
  if (classification === "Mistake") {
    return "border border-[rgba(242,125,125,0.22)] bg-[rgba(110,41,41,0.28)] text-[rgba(255,205,205,0.92)]";
  }
  return "border border-[rgba(255,92,92,0.3)] bg-[rgba(122,24,24,0.36)] text-[rgba(255,215,215,0.94)]";
}

function getResultTone(result: string): string {
  if (result === "1-0") return "lux-badge-emerald";
  if (result === "0-1") {
    return "border border-[rgba(242,125,125,0.25)] bg-[rgba(116,27,27,0.24)] text-[rgba(255,192,192,0.92)]";
  }
  if (result === "1/2-1/2") return "lux-badge-indigo";
  return "lux-badge";
}

function buildPlayedUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function reconstructMoves(game: SavedGame): Move[] {
  const chess = new Chess();

  if (game.moves.length > 0) {
    const verboseMoves: Move[] = [];
    for (const san of game.moves) {
      const move = chess.move(san);
      if (!move) throw new Error(`Failed to reconstruct move: ${san}`);
      verboseMoves.push(move);
    }
    return verboseMoves;
  }

  if (game.pgn) {
    chess.loadPgn(game.pgn);
    return chess.history({ verbose: true });
  }

  return [];
}

export default function ReviewGame({ id }: { id: string }) {
  const router = useRouter();

  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<EngineRequest | null>(null);

  const [game, setGame] = useState<SavedGame | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [gameError, setGameError] = useState("");
  const [analysis, setAnalysis] = useState<ReviewMove[]>([]);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPly, setSelectedPly] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    fetch(`/api/games/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string; game?: SavedGame };
        if (!res.ok || data.error || !data.game) {
          throw new Error(data.error ?? "Failed to load game.");
        }
        setGame(data.game);
      })
      .catch((err: unknown) => {
        setGameError(err instanceof Error ? err.message : "Failed to load game.");
      })
      .finally(() => setLoadingGame(false));
  }, [id, router]);

  useEffect(() => {
    const worker = new Worker("/stockfish-worker.js");
    worker.postMessage("uci");
    worker.onmessage = (event: MessageEvent) => {
      const line = typeof event.data === "string" ? event.data : String(event.data);
      const currentRequest = requestRef.current;
      if (!currentRequest) return;

      const parsedEval = parseEvalLine(line, currentRequest.turn);
      if (parsedEval) {
        currentRequest.latestEval = parsedEval;
      }

      if (!line.startsWith("bestmove")) return;

      requestRef.current = null;
      const bestMove = line.split(" ")[1] ?? "(none)";
      currentRequest.resolve({
        bestMove,
        eval: currentRequest.latestEval,
      });
    };
    worker.onerror = (event) => {
      requestRef.current?.reject(event.message || "Stockfish worker error.");
      requestRef.current = null;
    };
    workerRef.current = worker;

    return () => {
      requestRef.current?.reject("Worker disposed.");
      requestRef.current = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!game || !workerRef.current) return;

    const currentGame = game;
    let cancelled = false;

    async function analyzeGame() {
      setIsAnalyzing(true);
      setAnalysis([]);
      setAnalysisError("");
      setAnalysisProgress(0);

      try {
        const verboseMoves = reconstructMoves(currentGame);
        const chess = new Chess();
        const nextAnalysis: ReviewMove[] = [];

        for (let index = 0; index < verboseMoves.length; index += 1) {
          if (cancelled) return;

          const playedMoveSource = verboseMoves[index];
          const fenBefore = chess.fen();
          const bestBefore = await runEngineEvaluation(fenBefore, chess.turn());
          if (cancelled) return;

          const playedMove = chess.move(playedMoveSource.san);
          if (!playedMove) {
            throw new Error(`Unable to replay move ${playedMoveSource.san}.`);
          }

          const fenAfter = chess.fen();
          const afterEvalFromOpponent = await runEngineEvaluation(fenAfter, chess.turn());
          if (cancelled) return;

          const bestMoveSan = convertBestMoveToSan(fenBefore, bestBefore.bestMove);
          const playedEvalPawns = -evalToPawns(afterEvalFromOpponent.eval);
          const bestEvalPawns = evalToPawns(bestBefore.eval);
          const loss = Math.max(0, bestEvalPawns - playedEvalPawns);
          const playedUci = buildPlayedUci(playedMove);

          nextAnalysis.push({
            ply: index + 1,
            moveNumber: Math.floor(index / 2) + 1,
            color: playedMove.color,
            playedSan: playedMove.san,
            playedUci,
            bestMoveUci: bestBefore.bestMove,
            bestMoveSan,
            evalBefore: bestBefore.eval,
            evalAfter: {
              type: afterEvalFromOpponent.eval.type,
              value:
                afterEvalFromOpponent.eval.type === null
                  ? 0
                  : -afterEvalFromOpponent.eval.value,
            },
            loss,
            classification: classifyMove(loss, playedUci === bestBefore.bestMove),
            fenBefore,
            fenAfter,
          });

          setAnalysis([...nextAnalysis]);
          setAnalysisProgress(index + 1);
        }
      } catch (err) {
        if (!cancelled) {
          setAnalysisError(
            err instanceof Error ? err.message : "Analysis failed.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    }

    void analyzeGame();

    return () => {
      cancelled = true;
      if (workerRef.current) {
        workerRef.current.postMessage("stop");
      }
      requestRef.current = null;
    };
  }, [game]);

  function runEngineEvaluation(fen: string, turn: "w" | "b"): Promise<EngineResult> {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Stockfish worker unavailable."));
    }

    worker.postMessage("stop");

    return new Promise<EngineResult>((resolve, reject) => {
      requestRef.current = {
        resolve,
        reject,
        turn,
        latestEval: { type: null, value: 0 },
      };

      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${ANALYSIS_MOVETIME}`);
    });
  }

  function convertBestMoveToSan(fen: string, bestMove: string): string {
    if (!bestMove || bestMove === "(none)") return "none";

    try {
      const chess = new Chess(fen);
      const from = bestMove.slice(0, 2) as Square;
      const to = bestMove.slice(2, 4) as Square;
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
      const move = chess.move({ from, to, promotion });
      return move?.san ?? bestMove;
    } catch {
      return bestMove;
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const displayedFen = useMemo(() => {
    if (!analysis.length || selectedPly <= 0) return game ? new Chess().fen() : new Chess().fen();
    return analysis[Math.min(selectedPly - 1, analysis.length - 1)]?.fenAfter ?? new Chess().fen();
  }, [analysis, game, selectedPly]);

  const selectedMove = selectedPly > 0 ? analysis[selectedPly - 1] ?? null : null;

  const summary = useMemo(() => {
    const counts: Record<MoveClassification, number> = {
      Best: 0,
      Excellent: 0,
      Good: 0,
      Inaccuracy: 0,
      Mistake: 0,
      Blunder: 0,
    };

    analysis.forEach((move) => {
      counts[move.classification] += 1;
    });

    return counts;
  }, [analysis]);

  const pairedMoves = useMemo(() => {
    const pairs: Array<{ white: ReviewMove; black?: ReviewMove }> = [];
    for (let index = 0; index < analysis.length; index += 2) {
      pairs.push({ white: analysis[index], black: analysis[index + 1] });
    }
    return pairs;
  }, [analysis]);

  if (loadingGame) {
    return (
      <main className="lux-shell min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="lux-panel rounded-[1.8rem] px-6 py-14 text-center text-sm text-white/54">
            Loading saved game...
          </div>
        </div>
      </main>
    );
  }

  if (gameError || !game) {
    return (
      <main className="lux-shell min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-[1.6rem] border border-[rgba(242,125,125,0.25)] bg-[rgba(116,27,27,0.24)] px-5 py-4 text-sm text-[rgba(255,192,192,0.92)]">
            {gameError || "Game not found."}
          </div>
          <button
            onClick={() => router.push("/games")}
            className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
          >
            Back to archive
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="lux-shell min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="lux-ambient-orb left-[8%] top-18 h-56 w-56 bg-[rgba(124,130,255,0.12)]" />
      <div className="lux-ambient-orb right-[12%] top-10 h-56 w-56 bg-[rgba(215,182,125,0.14)]" />

      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="lux-panel rounded-[1.8rem] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="lux-kicker">Review</p>
              <h1 className="lux-display mt-3 text-4xl text-white sm:text-5xl">Game analysis</h1>
              <p className="mt-3 text-sm leading-7 text-white/54">
                Move-by-move browser review powered by your existing Stockfish worker.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className={`${getResultTone(game.result)} inline-flex rounded-full px-4 py-2 text-sm font-semibold`}>
                {game.result === "1/2-1/2" ? "Draw" : game.result}
              </span>
              <button
                onClick={() => router.push(`/games`)}
                className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Archive
              </button>
              <button
                onClick={() => router.push("/play")}
                className="lux-button-primary rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Play
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_390px]">
          <div className="space-y-5">
            <section className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,20,0.86),rgba(7,7,11,0.94))] p-4 shadow-[0_36px_92px_rgba(0,0,0,0.54),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
              <div className="pointer-events-none absolute inset-x-[18%] top-8 h-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_72%)] blur-3xl" />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="mx-auto w-full max-w-[650px] space-y-4">
                  <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">
                      {game.whitePlayer} vs {game.blackPlayer}
                    </p>
                    <p className="mt-2 text-sm text-white/74">{formatDate(game.playedAt)}</p>
                  </div>

                  <div className="lux-board-frame">
                    <div className="rounded-[1.45rem] border border-white/8 bg-[rgba(6,6,10,0.72)] p-3 sm:p-4">
                      <Chessboard
                        id="ReviewBoard"
                        position={displayedFen}
                        arePiecesDraggable={false}
                        boardOrientation="white"
                        customBoardStyle={{
                          borderRadius: "20px",
                          boxShadow: "0 32px 92px rgba(0,0,0,0.48)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">Position</p>
                      <p className="mt-2 text-sm text-white/82">
                        {selectedMove
                          ? `After ${selectedMove.moveNumber}${selectedMove.color === "w" ? ". " : "... "}${selectedMove.playedSan}`
                          : "Starting position"}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedPly((prev) => Math.max(0, prev - 1))}
                        className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setSelectedPly((prev) => Math.min(analysis.length, prev + 1))}
                        className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="lux-kicker">Analysis status</p>
                    <div className="mt-4 rounded-full border border-white/8 bg-black/20 px-3 py-3">
                      <div className="h-2 rounded-full bg-white/8">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#d7b67d,#7c82ff)] transition-all duration-300"
                          style={{
                            width: `${analysis.length === 0 ? 0 : (analysisProgress / Math.max(analysis.length, game.moves.length || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-white/64">
                        {isAnalyzing
                          ? `Analysing move ${Math.min(analysisProgress + 1, Math.max(game.moves.length, analysis.length || 1))} of ${Math.max(game.moves.length, analysis.length || 1)}`
                          : analysis.length > 0
                            ? `Analysis complete for ${analysis.length} plies`
                            : "Preparing analysis"}
                      </p>
                    </div>
                    {analysisError && (
                      <p className="mt-4 rounded-[1rem] border border-[rgba(242,125,125,0.24)] bg-[rgba(116,27,27,0.24)] px-3 py-3 text-sm text-[rgba(255,192,192,0.92)]">
                        {analysisError}
                      </p>
                    )}
                  </div>

                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="lux-kicker">Selected move</p>
                    {!selectedMove ? (
                      <p className="mt-4 text-sm leading-7 text-white/54">
                        Select a move from the notation to see its evaluation and best-move suggestion.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`${getClassificationTone(selectedMove.classification)} inline-flex rounded-full px-3 py-1 text-xs font-semibold`}>
                            {selectedMove.classification}
                          </span>
                          <span className="text-sm text-white/58">
                            Loss {selectedMove.loss.toFixed(2)}
                          </span>
                        </div>

                        <div className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">Played</p>
                          <p className="mt-2 text-base font-semibold text-white">{selectedMove.playedSan}</p>
                        </div>

                        <div className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">Best move</p>
                          <p className="mt-2 text-base font-semibold text-[var(--gold-soft)]">{selectedMove.bestMoveSan}</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">Before</p>
                            <p className="mt-2 font-mono text-lg text-white/88">{formatEval(selectedMove.evalBefore)}</p>
                          </div>
                          <div className="rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">After</p>
                            <p className="mt-2 font-mono text-lg text-white/88">{formatEval(selectedMove.evalAfter)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="lux-kicker">Summary</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {Object.entries(summary).map(([label, count]) => (
                        <div key={label} className="rounded-[1.05rem] border border-white/8 bg-black/20 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-white/34">{label}</p>
                          <p className="mt-2 text-lg font-semibold text-white">{count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="lux-panel-strong rounded-[1.9rem] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="lux-kicker">Notation</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Move list</h2>
                </div>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-white/44">
                  {analysis.length} plies
                </span>
              </div>

              <div className="mt-5 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {pairedMoves.length === 0 ? (
                  <p className="text-sm leading-7 text-white/52">
                    {isAnalyzing ? "Building review..." : "No moves available for review."}
                  </p>
                ) : (
                  pairedMoves.map(({ white, black }) => (
                    <div key={white.ply} className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/28">
                        {white.moveNumber}.
                      </p>

                      <div className="mt-3 space-y-2">
                        <button
                          onClick={() => setSelectedPly(white.ply)}
                          className={`flex w-full items-center justify-between gap-3 rounded-[1rem] px-3 py-2 text-left transition-colors ${
                            selectedPly === white.ply ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className="font-mono text-sm text-white/86">{white.playedSan}</span>
                          <span className={`${getClassificationTone(white.classification)} inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold`}>
                            {white.classification}
                          </span>
                        </button>

                        {black && (
                          <button
                            onClick={() => setSelectedPly(black.ply)}
                            className={`flex w-full items-center justify-between gap-3 rounded-[1rem] px-3 py-2 text-left transition-colors ${
                              selectedPly === black.ply ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                            }`}
                          >
                            <span className="font-mono text-sm text-white/72">{black.playedSan}</span>
                            <span className={`${getClassificationTone(black.classification)} inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold`}>
                              {black.classification}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
