"use client";

import { useRef, useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type StatusVariant    = "neutral" | "check" | "draw" | "over";
type GameMode         = "local" | "vs-computer";
type BotDifficulty    = "easy" | "medium" | "hard" | "expert";
type TimedOut         = "w" | "b" | null;
type CopyState        = "idle" | "copied";
type PlayerColor      = "w" | "b";
type BoardOrientation = "white" | "black";

interface StatusState    { text: string; variant: StatusVariant; }
interface CapturedPieces { white: string[]; black: string[]; }
interface LastMove       { from: string; to: string; }
interface TimeOption     { label: string; seconds: number; }
interface EvalState      { type: "cp" | "mate" | null; value: number; }

// ── Opening book ──────────────────────────────────────────────────────────────

const OPENING_BOOK: Record<string, string[]> = {
  "e4":               ["e5", "c5", "e6", "c6", "d6", "d5"],
  "e4 c5":            ["Nf3", "Nc3"],
  "e4 c5 Nf3":        ["d6", "Nc6", "e6"],
  "e4 c5 Nf3 d6":     ["d4"],
  "e4 c5 Nf3 Nc6":    ["d4", "Bb5"],
  "e4 e5":            ["Nf3", "Nc3", "f4"],
  "e4 e5 Nf3":        ["Nc6", "Nf6", "d6"],
  "e4 e5 Nf3 Nc6":    ["Bb5", "Bc4", "d4"],
  "e4 e5 Nf3 Nc6 Bb5":["a6", "Nf6", "d6"],
  "e4 e5 Nf3 Nc6 Bc4":["Bc5", "Nf6", "d6"],
  "e4 e5 Nf3 Nf6":    ["Nxe5", "Nc3", "d3"],
  "e4 d5":            ["exd5", "Nc3", "d4"],
  "e4 d5 exd5":       ["Qxd5", "Nf6"],
  "e4 e6":            ["d4", "Nf3"],
  "e4 e6 d4":         ["d5"],
  "e4 e6 d4 d5":      ["Nc3", "Nd2", "e5"],
  "e4 c6":            ["d4", "Nf3"],
  "e4 c6 d4":         ["d5"],
  "e4 c6 d4 d5":      ["Nc3", "e5", "exd5"],
  "d4":               ["d5", "Nf6", "e6", "c5", "f5"],
  "d4 d5":            ["c4", "Nf3", "Bf4"],
  "d4 d5 c4":         ["e6", "c6", "dxc4", "Nf6"],
  "d4 d5 c4 e6":      ["Nc3", "Nf3"],
  "d4 d5 c4 c6":      ["Nf3", "Nc3"],
  "d4 Nf6":           ["c4", "Nf3", "Bf4"],
  "d4 Nf6 c4":        ["e6", "g6", "c5"],
  "d4 Nf6 c4 e6":     ["Nc3", "Nf3"],
  "d4 Nf6 c4 g6":     ["Nc3", "Nf3", "g3"],
  "d4 Nf6 c4 g6 Nc3": ["Bg7"],
  "d4 c5":            ["d5", "Nf3", "c3"],
  "Nf3":              ["d5", "Nf6", "c5", "e6"],
  "Nf3 d5":           ["d4", "c4", "g3"],
  "Nf3 Nf6":          ["d4", "c4", "g3"],
  "c4":               ["e5", "c5", "Nf6", "e6", "c6"],
  "c4 e5":            ["Nc3", "g3", "Nf3"],
  "c4 Nf6":           ["Nc3", "g3", "d4"],
};

function getBookMove(g: Chess): string | null {
  const key     = g.history().join(" ");
  const entries = OPENING_BOOK[key];
  if (!entries || entries.length === 0) return null;
  const legal   = new Set(g.moves());
  const options = entries.filter((m) => legal.has(m));
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TIME_OPTIONS: TimeOption[] = [
  { label: "∞",     seconds: 0   },
  { label: "1 min", seconds: 60  },
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 m",  seconds: 600 },
];

const VARIANT_STYLES: Record<StatusVariant, string> = {
  neutral: "border-zinc-700 bg-zinc-950 text-zinc-100",
  check:   "border-yellow-500/60 bg-yellow-950/40 text-yellow-300",
  draw:    "border-blue-500/60 bg-blue-950/40 text-blue-300",
  over:    "border-red-500/60 bg-red-950/40 text-red-300",
};

const PIECE_SYMBOLS: Record<string, string> = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛",
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕",
};

const MATERIAL_VALUE: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

const STYLE_LAST_FROM: CSSProperties     = { background: "rgba(255,255,100,0.20)" };
const STYLE_LAST_TO: CSSProperties       = { background: "rgba(255,255,100,0.30)" };
const STYLE_SELECTED: CSSProperties      = { background: "rgba(99,102,241,0.55)", borderRadius: "4px" };
const STYLE_LEGAL_EMPTY: CSSProperties   = { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)", borderRadius: "50%" };
const STYLE_LEGAL_CAPTURE: CSSProperties = { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)", borderRadius: "50%" };

const BOT_DELAY_MS    = 500;
const EXPERT_MOVETIME = 1500;

// ── Eval helpers ──────────────────────────────────────────────────────────────

function parseEvalLine(line: string, turnToMove: "w" | "b"): EvalState | null {
  if (!line.includes("score")) return null;
  const mateMatch = line.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const raw = parseInt(mateMatch[1]);
    return { type: "mate", value: turnToMove === "w" ? raw : -raw };
  }
  const cpMatch = line.match(/score cp (-?\d+)/);
  if (cpMatch) {
    const raw = parseInt(cpMatch[1]);
    return { type: "cp", value: turnToMove === "w" ? raw : -raw };
  }
  return null;
}

function getWhitePercent(ev: EvalState): number {
  if (ev.type === null)   return 50;
  if (ev.type === "mate") return ev.value > 0 ? 95 : 5;
  const clamped = Math.max(-1000, Math.min(1000, ev.value));
  return 5 + ((clamped + 1000) / 2000) * 90;
}

function getEvalDisplay(ev: EvalState): string {
  if (ev.type === null)   return "0.0";
  if (ev.type === "mate") {
    const abs = Math.abs(ev.value);
    return ev.value > 0 ? `M${abs}` : `-M${abs}`;
  }
  const pawns = ev.value / 100;
  return (pawns >= 0 ? "+" : "") + pawns.toFixed(1);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ClockBadgeProps { time: number; isActive: boolean; isTimedOut: boolean; }
function ClockBadge({ time, isActive, isTimedOut }: ClockBadgeProps) {
  const m = Math.floor(time / 60);
  const s = time % 60;
  return (
    <div className={`tabular-nums font-mono text-sm font-bold px-3 py-1 rounded-lg border transition-all ${
      isTimedOut  ? "border-red-500/60 bg-red-950/40 text-red-400"
      : isActive  ? "border-indigo-500/60 bg-indigo-950/40 text-indigo-200"
      :             "border-zinc-800 bg-zinc-900 text-zinc-500"
    }`}>
      {m}:{s.toString().padStart(2, "0")}
    </div>
  );
}

interface EvalBarProps { whitePercent: number; display: string; orientation: BoardOrientation; }
function EvalBar({ whitePercent, display, orientation }: EvalBarProps) {
  const flipped = orientation === "black";
  return (
    <div className="w-5 self-stretch flex-shrink-0 rounded-lg overflow-hidden border border-zinc-700 relative bg-zinc-800 cursor-default select-none">
      <div
        className="absolute left-0 right-0 bg-zinc-200 transition-all duration-500 ease-out"
        style={flipped ? { top: 0, height: `${whitePercent}%` } : { bottom: 0, height: `${whitePercent}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <span className="font-mono font-bold text-zinc-500 leading-none" style={{ fontSize: "7px", writingMode: "vertical-lr" }}>
          {display}
        </span>
      </div>
    </div>
  );
}

// ── PGN helpers ───────────────────────────────────────────────────────────────

function getTodayPgnDate(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function deriveResult(g: Chess, timedOut: TimedOut): string {
  if (timedOut === "w") return "0-1";
  if (timedOut === "b") return "1-0";
  if (g.isCheckmate()) return g.turn() === "b" ? "1-0" : "0-1";
  if (g.isDraw() || g.isStalemate()) return "1/2-1/2";
  return "*";
}

function buildPgn(g: Chess, gameMode: GameMode, playerColor: PlayerColor, timedOut: TimedOut): string {
  const clone = new Chess();
  g.history({ verbose: true }).forEach((m) => clone.move(m.san));
  const whiteName = gameMode === "vs-computer" ? (playerColor === "w" ? "Player" : "Computer") : "Player";
  const blackName = gameMode === "vs-computer" ? (playerColor === "b" ? "Player" : "Computer") : "Player 2";
  clone.header("Event","Chess Website Game","Site","Local","Date",getTodayPgnDate(),
    "White",whiteName,"Black",blackName,"Result",deriveResult(g, timedOut));
  return clone.pgn();
}

function downloadPgn(pgn: string) {
  const blob = new Blob([pgn], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `chess-game-${getTodayPgnDate()}.pgn`;
  a.click(); URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta); return true;
    } catch { return false; }
  }
}

// ── Bot helpers ───────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function scoreBoardForColor(g: Chess, playerColor: PlayerColor): number {
  const botColor = playerColor === "w" ? "b" : "w";
  let score = 0;
  g.board().forEach((row) => row.forEach((sq) => {
    if (!sq) return;
    score += sq.color === botColor ? (MATERIAL_VALUE[sq.type] ?? 0) : -(MATERIAL_VALUE[sq.type] ?? 0);
  }));
  return score;
}

function pickEasyMove(g: Chess): string { return pickRandom(g.moves()); }

function pickMediumMove(g: Chess): string {
  const moves = g.moves({ verbose: true });
  const promo  = moves.filter((m) => m.flags.includes("p"));
  if (promo.length > 0) return pickRandom(promo).san;
  const caps = moves.filter((m) => m.flags.includes("c") || m.flags.includes("e"));
  if (caps.length > 0) return pickRandom(caps).san;
  const checks = moves.filter((m) => { const t = new Chess(g.fen()); t.move(m.san); return t.inCheck(); });
  if (checks.length > 0) return pickRandom(checks).san;
  return pickRandom(moves).san;
}

function pickHardMove(g: Chess, playerColor: PlayerColor): string {
  const moves = g.moves();
  if (moves.length === 0) return "";
  let best = -Infinity; let bestMoves: string[] = [];
  moves.forEach((san) => {
    const tmp = new Chess(g.fen()); tmp.move(san);
    const score = scoreBoardForColor(tmp, playerColor);
    if (score > best)        { best = score; bestMoves = [san]; }
    else if (score === best) { bestMoves.push(san); }
  });
  return pickRandom(bestMoves);
}

function pickBotMove(g: Chess, difficulty: BotDifficulty, playerColor: PlayerColor): string {
  if (difficulty === "easy")   return pickEasyMove(g);
  if (difficulty === "medium") return pickMediumMove(g);
  if (difficulty === "hard")   return pickHardMove(g, playerColor);
  return "";
}

// ── Game helpers ──────────────────────────────────────────────────────────────

function deriveStatus(
  g: Chess, isBotThinking: boolean, timedOut: TimedOut,
  gameMode: GameMode, playerColor: PlayerColor,
): StatusState {
  if (timedOut === "w") return { text: "White ran out of time — Black wins!", variant: "over"    };
  if (timedOut === "b") return { text: "Black ran out of time — White wins!", variant: "over"    };
  const turn = g.turn() === "w" ? "White" : "Black";
  const opp  = turn === "White" ? "Black" : "White";
  if (g.isCheckmate())            return { text: `Checkmate — ${opp} wins!`,    variant: "over"    };
  if (g.isStalemate())            return { text: "Stalemate — it's a draw!",    variant: "draw"    };
  if (g.isThreefoldRepetition())  return { text: "Draw — threefold repetition", variant: "draw"    };
  if (g.isInsufficientMaterial()) return { text: "Draw — insufficient material",variant: "draw"    };
  if (g.isDraw())                 return { text: "Draw — 50 move rule",         variant: "draw"    };
  if (isBotThinking)              return { text: "Computer thinking…",          variant: "neutral" };
  if (g.inCheck())                return { text: `${turn} is in check!`,        variant: "check"   };
  if (gameMode === "vs-computer")
    return { text: g.turn() === playerColor ? "Your turn" : `${turn}'s turn`, variant: "neutral" };
  return { text: `${turn}'s turn`, variant: "neutral" };
}

function deriveCaptured(g: Chess): CapturedPieces {
  const start: Record<string, number> = { p:8,n:2,b:2,r:2,q:1,P:8,N:2,B:2,R:2,Q:1 };
  const curr: Record<string, number>  = {};
  g.board().forEach((row) => row.forEach((sq) => {
    if (!sq) return;
    const key = sq.color === "w" ? sq.type.toUpperCase() : sq.type;
    curr[key] = (curr[key] ?? 0) + 1;
  }));
  const byWhite: string[] = []; const byBlack: string[] = [];
  Object.entries(start).forEach(([p, count]) => {
    const lost = count - (curr[p] ?? 0);
    const sym  = PIECE_SYMBOLS[p] ?? p;
    for (let i = 0; i < lost; i++) {
      if (p === p.toLowerCase()) byWhite.push(sym); else byBlack.push(sym);
    }
  });
  return { white: byWhite, black: byBlack };
}

function buildSquareStyles(
  lastMove: LastMove | null, sel: Square | null, legal: Record<string, CSSProperties>,
): Record<string, CSSProperties> {
  const s: Record<string, CSSProperties> = {};
  if (lastMove) { s[lastMove.from] = STYLE_LAST_FROM; s[lastMove.to] = STYLE_LAST_TO; }
  Object.entries(legal).forEach(([sq, st]) => { s[sq] = st; });
  if (sel) s[sel] = STYLE_SELECTED;
  return s;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ChessGame() {
  const gameRef = useRef<Chess>(new Chess());

  // ✅ Turbopack-safe: all complex types on initial variables
  const initialStatus: StatusState                          = { text: "White's turn", variant: "neutral" };
  const initialLastMove: LastMove | null                    = null;
  const initialCaptured: CapturedPieces                     = { white: [], black: [] };
  const initialSelectedSquare: Square | null                = null;
  const initialLegalSquares: Record<string, CSSProperties>  = {};
  const initialGameMode: GameMode                           = "local";
  const initialDifficulty: BotDifficulty                    = "easy";
  const initialTimedOut: TimedOut                           = null;
  const initialCopyPgn: CopyState                           = "idle";
  const initialCopyFen: CopyState                           = "idle";
  const initialPlayerColor: PlayerColor                     = "w";
  const initialBoardOrientation: BoardOrientation           = "white";
  const initialEval: EvalState                              = { type: null, value: 0 };

  const [fen,              setFen]              = useState<string>(gameRef.current.fen());
  const [statusState,      setStatusState]      = useState<StatusState>(initialStatus);
  const [lastMove,         setLastMove]         = useState<LastMove | null>(initialLastMove);
  const [captured,         setCaptured]         = useState<CapturedPieces>(initialCaptured);
  const [selectedSquare,   setSelectedSquare]   = useState<Square | null>(initialSelectedSquare);
  const [legalSquares,     setLegalSquares]     = useState<Record<string, CSSProperties>>(initialLegalSquares);
  const [gameMode,         setGameMode]         = useState<GameMode>(initialGameMode);
  const [difficulty,       setDifficulty]       = useState<BotDifficulty>(initialDifficulty);
  const [isBotThinking,    setIsBotThinking]    = useState<boolean>(false);
  const [timeControl,      setTimeControl]      = useState<number>(0);
  const [whiteTime,        setWhiteTime]        = useState<number>(0);
  const [blackTime,        setBlackTime]        = useState<number>(0);
  const [timedOutColor,    setTimedOutColor]    = useState<TimedOut>(initialTimedOut);
  const [copyPgnState,     setCopyPgnState]     = useState<CopyState>(initialCopyPgn);
  const [copyFenState,     setCopyFenState]     = useState<CopyState>(initialCopyFen);
  const [playerColor,      setPlayerColor]      = useState<PlayerColor>(initialPlayerColor);
  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>(initialBoardOrientation);
  const [evalState,        setEvalState]        = useState<EvalState>(initialEval);
  const [isMuted,          setIsMuted]          = useState<boolean>(false);
  const [isBookMove,       setIsBookMove]       = useState<boolean>(false);
  const [userEmail,        setUserEmail]        = useState<string>("");
  const [gameSaved,        setGameSaved]        = useState<boolean>(false);
  const [gameSaving,       setGameSaving]       = useState<boolean>(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const difficultyRef       = useRef<BotDifficulty>("easy");
  const gameModeRef         = useRef<GameMode>("local");
  const playerColorRef      = useRef<PlayerColor>("w");
  const isMutedRef          = useRef(false);
  const whiteTimeRef        = useRef(0);
  const blackTimeRef        = useRef(0);
  const timedOutRef         = useRef<TimedOut>(null);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const workerRef           = useRef<Worker | null>(null);
  const sessionRef          = useRef(0);
  const engineCallbackRef   = useRef<((line: string) => void) | null>(null);
  const onInfoRef           = useRef<((line: string) => void) | null>(null);
  const sndMove             = useRef<HTMLAudioElement | null>(null);
  const sndCapture          = useRef<HTMLAudioElement | null>(null);
  const sndCheck            = useRef<HTMLAudioElement | null>(null);
  const sndCheckmate        = useRef<HTMLAudioElement | null>(null);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    sndMove.current      = new Audio("/move.mp3");
    sndCapture.current   = new Audio("/capture.mp3");
    sndCheck.current     = new Audio("/check.mp3");
    sndCheckmate.current = new Audio("/checkmate.mp3");
    [sndMove, sndCapture, sndCheck, sndCheckmate].forEach((r) => { if (r.current) r.current.load(); });
  }, []);

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (email) setUserEmail(email);
  }, []);

  useEffect(() => { difficultyRef.current  = difficulty;  }, [difficulty]);
  useEffect(() => { gameModeRef.current    = gameMode;    }, [gameMode]);
  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);
  useEffect(() => { isMutedRef.current     = isMuted;     }, [isMuted]);

  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [fen]);

  useEffect(() => {
    const worker = new Worker("/stockfish-worker.js");
    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);
      if (line.startsWith("info")) onInfoRef.current?.(line);
      engineCallbackRef.current?.(line);
    };
    worker.onerror = () => { workerRef.current = null; };
    worker.postMessage("uci");
    workerRef.current = worker;
    return () => { worker.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeControl === 0 || timedOutRef.current !== null || gameRef.current.isGameOver()) return;

    intervalRef.current = setInterval(() => {
      const g = gameRef.current;
      if (g.isGameOver() || timedOutRef.current !== null) {
        clearInterval(intervalRef.current!); intervalRef.current = null; return;
      }
      if (g.turn() === "w") {
        whiteTimeRef.current = Math.max(0, whiteTimeRef.current - 1);
        setWhiteTime(whiteTimeRef.current);
        if (whiteTimeRef.current === 0) {
          clearInterval(intervalRef.current!); intervalRef.current = null;
          timedOutRef.current = "w"; setTimedOutColor("w");
        }
      } else {
        blackTimeRef.current = Math.max(0, blackTimeRef.current - 1);
        setBlackTime(blackTimeRef.current);
        if (blackTimeRef.current === 0) {
          clearInterval(intervalRef.current!); intervalRef.current = null;
          timedOutRef.current = "b"; setTimedOutColor("b");
        }
      }
    }, 1000);

    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [fen, timeControl]);

  useEffect(() => {
    if (timedOutColor !== null)
      setStatusState(deriveStatus(gameRef.current, false, timedOutColor, gameModeRef.current, playerColorRef.current));
  }, [timedOutColor]);

  // ── Sound ─────────────────────────────────────────────────────────────────

  function playMoveSound(isCapture: boolean, afterG: Chess) {
    if (isMutedRef.current) return;
    let target: HTMLAudioElement | null = null;
    if (afterG.isCheckmate())  target = sndCheckmate.current;
    else if (afterG.inCheck()) target = sndCheck.current;
    else if (isCapture)        target = sndCapture.current;
    else                       target = sndMove.current;
    if (!target) return;
    target.currentTime = 0;
    target.play().catch(() => {});
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function resetClocksTo(seconds: number) {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    whiteTimeRef.current = seconds; blackTimeRef.current = seconds; timedOutRef.current = null;
    setWhiteTime(seconds); setBlackTime(seconds); setTimedOutColor(null);
  }

  function clearSelection() { setSelectedSquare(null); setLegalSquares({}); }
  function clearEval()      { setEvalState(initialEval); onInfoRef.current = null; }

  function syncState(from?: string, to?: string, botThinking = false) {
    const g = gameRef.current;
    setFen(g.fen());
    setStatusState(deriveStatus(g, botThinking, timedOutRef.current, gameModeRef.current, playerColorRef.current));
    setCaptured(deriveCaptured(g));
    if (from && to) setLastMove({ from, to });
    clearSelection();
  }

  function stopEngine() {
    sessionRef.current++;
    engineCallbackRef.current = null;
    onInfoRef.current         = null;
    workerRef.current?.postMessage("stop");
  }

  function isBotTurn(): boolean {
    if (gameModeRef.current !== "vs-computer") return false;
    return gameRef.current.turn() !== playerColorRef.current;
  }

  // ── Expert bot ────────────────────────────────────────────────────────────

  function scheduleExpertMove(fenString: string) {
    const g        = gameRef.current;
    const bookMove = getBookMove(g);

    if (bookMove) {
      setIsBotThinking(true); setIsBookMove(true);
      setTimeout(() => {
        const cg = gameRef.current;
        if (cg.isGameOver() || !isBotTurn() || timedOutRef.current !== null) {
          setIsBotThinking(false); setIsBookMove(false); return;
        }
        try {
          const r = cg.move(bookMove);
          if (r) {
            playMoveSound(r.flags.includes("c") || r.flags.includes("e"), cg);
            setIsBotThinking(false); setIsBookMove(false); syncState(r.from, r.to, false);
          } else { setIsBotThinking(false); setIsBookMove(false); }
        } catch { setIsBotThinking(false); setIsBookMove(false); }
      }, BOT_DELAY_MS);
      return;
    }

    setIsBookMove(false);
    const mySession  = ++sessionRef.current;
    const searchTurn = g.turn();
    setIsBotThinking(true);

    if (!workerRef.current) {
      setTimeout(() => {
        const cg = gameRef.current;
        if (cg.isGameOver() || !isBotTurn()) { setIsBotThinking(false); return; }
        const san = pickHardMove(cg, playerColorRef.current);
        if (!san) { setIsBotThinking(false); return; }
        const r = cg.move(san);
        if (!r) { setIsBotThinking(false); return; }
        playMoveSound(r.flags.includes("c") || r.flags.includes("e"), cg);
        setIsBotThinking(false); syncState(r.from, r.to, false);
      }, BOT_DELAY_MS);
      return;
    }

    onInfoRef.current = (line: string) => {
      if (mySession !== sessionRef.current) return;
      const ev = parseEvalLine(line, searchTurn);
      if (ev) setEvalState(ev);
    };

    engineCallbackRef.current = (line: string) => {
      if (!line.startsWith("bestmove")) return;
      if (mySession !== sessionRef.current) return;
      engineCallbackRef.current = null; onInfoRef.current = null;
      const token = line.split(" ")[1];
      if (!token || token === "(none)") { setIsBotThinking(false); return; }
      const from  = token.slice(0, 2) as Square;
      const to    = token.slice(2, 4) as Square;
      const promo = token.length > 4 ? token[4] : "q";
      const cg    = gameRef.current;
      if (cg.isGameOver() || !isBotTurn() || timedOutRef.current !== null) { setIsBotThinking(false); return; }
      try {
        const r = cg.move({ from, to, promotion: promo });
        if (r) {
          playMoveSound(r.flags.includes("c") || r.flags.includes("e"), cg);
          setIsBotThinking(false); syncState(r.from, r.to, false);
        } else { setIsBotThinking(false); }
      } catch { setIsBotThinking(false); }
    };

    workerRef.current.postMessage(`position fen ${fenString}`);
    workerRef.current.postMessage(`go movetime ${EXPERT_MOVETIME}`);
  }

  // ── Random / heuristic bot ────────────────────────────────────────────────

  function scheduleRandomBotMove() {
    setIsBotThinking(true);
    setTimeout(() => {
      const g = gameRef.current;
      if (g.isGameOver() || !isBotTurn() || timedOutRef.current !== null) { setIsBotThinking(false); return; }
      const san = pickBotMove(g, difficultyRef.current, playerColorRef.current);
      if (!san) { setIsBotThinking(false); return; }
      const r = g.move(san);
      if (!r)   { setIsBotThinking(false); return; }
      playMoveSound(r.flags.includes("c") || r.flags.includes("e"), g);
      setIsBotThinking(false); syncState(r.from, r.to, false);
    }, BOT_DELAY_MS);
  }

  function scheduleBotMove() {
    if (difficultyRef.current === "expert") scheduleExpertMove(gameRef.current.fen());
    else scheduleRandomBotMove();
  }

  // ── Move execution ────────────────────────────────────────────────────────

  function attemptMove(from: Square, to: Square): boolean {
    if (timedOutRef.current !== null) return false;
    const g = gameRef.current;
    try {
      const move = g.move({ from, to, promotion: "q" });
      if (!move) return false;
      const isCapture = move.flags.includes("c") || move.flags.includes("e");
      const needsBot  = gameMode === "vs-computer" && !g.isGameOver() && g.turn() !== playerColorRef.current;
      playMoveSound(isCapture, g);
      if (needsBot) { syncState(from, to, true); scheduleBotMove(); }
      else          { syncState(from, to, false); }
      return true;
    } catch { return false; }
  }

  // ── Square click ──────────────────────────────────────────────────────────

  function onSquareClick(square: Square) {
    const g = gameRef.current;
    if (g.isGameOver() || isBotThinking || timedOutRef.current !== null) return;
    if (gameMode === "vs-computer" && g.turn() !== playerColorRef.current) return;
    if (selectedSquare) {
      const moved = attemptMove(selectedSquare, square);
      if (moved) return;
      const piece = g.get(square);
      if (piece && piece.color === g.turn()) { selectSquare(square); return; }
      clearSelection(); return;
    }
    const piece = g.get(square);
    if (!piece || piece.color !== g.turn()) return;
    selectSquare(square);
  }

  function selectSquare(square: Square) {
    const g = gameRef.current;
    setSelectedSquare(square);
    const moves = g.moves({ square, verbose: true });
    if (moves.length === 0) { setLegalSquares({}); return; }
    const nl: Record<string, CSSProperties> = {};
    moves.forEach((m) => { nl[m.to] = g.get(m.to as Square) ? STYLE_LEGAL_CAPTURE : STYLE_LEGAL_EMPTY; });
    setLegalSquares(nl);
  }

  function onPieceDrop(sourceSquare: Square, targetSquare: Square): boolean {
    if (isBotThinking || timedOutRef.current !== null) return false;
    if (gameMode === "vs-computer" && gameRef.current.turn() !== playerColorRef.current) return false;
    return attemptMove(sourceSquare, targetSquare);
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  function handleUndo() {
    if (isBotThinking || timeControl > 0) return;
    const g = gameRef.current;
    if (gameMode === "vs-computer") { g.undo(); g.undo(); } else { g.undo(); }
    const history = g.history({ verbose: true });
    const prev = history[history.length - 1];
    if (prev) { syncState(prev.from, prev.to, false); }
    else {
      setFen(g.fen());
      setStatusState(deriveStatus(g, false, timedOutRef.current, gameModeRef.current, playerColorRef.current));
      setCaptured(deriveCaptured(g)); setLastMove(null); clearSelection();
    }
  }

  function doRestart(mode: GameMode, pColor: PlayerColor, diff: BotDifficulty, tc: number) {
    stopEngine(); clearEval();
    setIsBookMove(false); setGameSaved(false);
    gameRef.current = new Chess();
    setFen(gameRef.current.fen()); setStatusState(initialStatus);
    setLastMove(null); setCaptured(initialCaptured); setIsBotThinking(false);
    clearSelection(); resetClocksTo(tc);
    if (mode === "vs-computer" && pColor === "b") {
      setTimeout(() => {
        if (gameRef.current.history().length > 0) return;
        if (diff === "expert") scheduleExpertMove(gameRef.current.fen());
        else scheduleRandomBotMove();
      }, 100);
    }
  }

  function handleRestart() { doRestart(gameMode, playerColor, difficulty, timeControl); }
  function handleModeChange(mode: GameMode) {
    setGameMode(mode); gameModeRef.current = mode;
    setPlayerColor("w"); playerColorRef.current = "w";
    setBoardOrientation("white");
    doRestart(mode, "w", difficulty, timeControl);
  }
  function handleDifficultyChange(d: BotDifficulty) {
    setDifficulty(d); difficultyRef.current = d;
    doRestart(gameMode, playerColor, d, timeControl);
  }
  function handleTimeControlChange(seconds: number) {
    setTimeControl(seconds);
    doRestart(gameMode, playerColor, difficulty, seconds);
  }
  function handlePlayerColorChange(color: PlayerColor) {
    setPlayerColor(color); playerColorRef.current = color;
    setBoardOrientation(color === "w" ? "white" : "black");
    doRestart(gameMode, color, difficulty, timeControl);
  }
  function handleFlipBoard()  { setBoardOrientation((prev) => prev === "white" ? "black" : "white"); }
  function handleToggleMute() { setIsMuted((prev) => !prev); }

  // ── Auth ──────────────────────────────────────────────────────────────────

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setUserEmail("");
  }

  // ── Save game ─────────────────────────────────────────────────────────────

  async function handleSaveGame() {
    const token = localStorage.getItem("token");
    if (!token) return;
    setGameSaving(true);
    try {
      const g = gameRef.current;
      const res = await fetch("/api/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          whitePlayer: playerColor === "w" ? (userEmail || "Player") : "Computer",
          blackPlayer: playerColor === "b" ? (userEmail || "Player") : "Computer",
          moves:  g.history(),
          result: deriveResult(g, timedOutRef.current),
          pgn:    buildPgn(g, gameMode, playerColor, timedOutRef.current),
        }),
      });
      if (res.ok) { setGameSaved(true); setTimeout(() => setGameSaved(false), 3000); }
    } catch { /* silently fail */ }
    finally  { setGameSaving(false); }
  }

  // ── PGN / FEN export ──────────────────────────────────────────────────────

  function handleCopyPgn() {
    copyToClipboard(buildPgn(gameRef.current, gameMode, playerColor, timedOutRef.current)).then(() => {
      setCopyPgnState("copied"); setTimeout(() => setCopyPgnState("idle"), 2000);
    });
  }
  function handleDownloadPgn() { downloadPgn(buildPgn(gameRef.current, gameMode, playerColor, timedOutRef.current)); }
  function handleCopyFen() {
    copyToClipboard(gameRef.current.fen()).then(() => {
      setCopyFenState("copied"); setTimeout(() => setCopyFenState("idle"), 2000);
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const moveHistory  = gameRef.current.history();
  const isGameOver   = gameRef.current.isGameOver() || timedOutColor !== null;
  const boardLocked  = isBotThinking || isGameOver;
  const currentTurn  = gameRef.current.turn();
  const clockActive  = !isGameOver && !isBotThinking;
  const hasMoves     = moveHistory.length > 0;
  const showEvalBar  = gameMode === "vs-computer" && difficulty === "expert";
  const whitePercent = getWhitePercent(evalState);
  const evalDisplay  = getEvalDisplay(evalState);
  const boardMaxW    = showEvalBar ? "max-w-[624px]" : "max-w-[600px]";

  const pairedMovesInit: [string, string | undefined][] = [];
  const pairedMoves = moveHistory.reduce((acc, move, i) => {
    if (i % 2 === 0) acc.push([move, undefined]);
    else acc[acc.length - 1][1] = move;
    return acc;
  }, pairedMovesInit);

  const customSquareStyles = buildSquareStyles(lastMove, selectedSquare, legalSquares);

  const difficultyLabel: Record<BotDifficulty, string> = { easy:"Easy", medium:"Medium", hard:"Hard", expert:"Expert" };
  const difficultyColor: Record<BotDifficulty, string> = {
    easy:"bg-emerald-600 text-white", medium:"bg-amber-500 text-white",
    hard:"bg-red-600 text-white",     expert:"bg-violet-600 text-white",
  };
  const difficultyDesc: Record<BotDifficulty, string> = {
    easy:   "Plays random legal moves.",
    medium: "Prefers captures, checks, and promotions.",
    hard:   "Picks the move with the best material gain.",
    expert: "Opening book + Stockfish engine.",
  };

  const topLabel       = boardOrientation === "white"
    ? (gameMode === "vs-computer" ? (playerColor === "b" ? "You lost" : "Computer lost") : "Black lost")
    : (gameMode === "vs-computer" ? (playerColor === "w" ? "You lost" : "Computer lost") : "White lost");
  const bottomLabel    = boardOrientation === "white"
    ? (gameMode === "vs-computer" ? (playerColor === "w" ? "You lost" : "Computer lost") : "White lost")
    : (gameMode === "vs-computer" ? (playerColor === "b" ? "You lost" : "Computer lost") : "Black lost");
  const topCaptured    = boardOrientation === "white" ? captured.black : captured.white;
  const bottomCaptured = boardOrientation === "white" ? captured.white : captured.black;
  const topColor: "w" | "b"    = boardOrientation === "white" ? "b" : "w";
  const bottomColor: "w" | "b" = boardOrientation === "white" ? "w" : "b";
  const thinkingLabel  = isBookMove ? "Playing book move…" : "Computer thinking…";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

        {/* Board column */}
        <div className="flex flex-col gap-3 items-center w-full">

          <div className={`w-full ${boardMaxW} flex items-center justify-between min-h-[36px] px-1`}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-600 uppercase tracking-widest shrink-0">{topLabel}</span>
              {topCaptured.length > 0
                ? <span className="text-lg leading-none">{topCaptured.join("")}</span>
                : <span className="text-zinc-700 text-xs italic">nothing yet</span>}
            </div>
            {timeControl > 0 && (
              <ClockBadge
                time={topColor === "w" ? whiteTime : blackTime}
                isActive={clockActive && currentTurn === topColor}
                isTimedOut={timedOutColor === topColor}
              />
            )}
          </div>

          <div className={`flex gap-2 items-stretch w-full ${boardMaxW}`}>
            {showEvalBar && <EvalBar whitePercent={whitePercent} display={evalDisplay} orientation={boardOrientation} />}
            <div className="flex-1 min-w-0">
              <Chessboard
                id="MainBoard"
                position={fen}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                arePiecesDraggable={!boardLocked}
                boardOrientation={boardOrientation}
                customSquareStyles={customSquareStyles}
                customBoardStyle={{
                  borderRadius: "8px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  opacity: isBotThinking ? 0.85 : 1,
                  transition: "opacity 0.2s ease",
                }}
              />
            </div>
          </div>

          <div className={`w-full ${boardMaxW} flex items-center justify-between min-h-[36px] px-1`}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-600 uppercase tracking-widest shrink-0">{bottomLabel}</span>
              {bottomCaptured.length > 0
                ? <span className="text-lg leading-none">{bottomCaptured.join("")}</span>
                : <span className="text-zinc-700 text-xs italic">nothing yet</span>}
            </div>
            {timeControl > 0 && (
              <ClockBadge
                time={bottomColor === "w" ? whiteTime : blackTime}
                isActive={clockActive && currentTurn === bottomColor}
                isTimedOut={timedOutColor === bottomColor}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Chess</h1>
            <button onClick={handleToggleMute} title={isMuted ? "Unmute" : "Mute"}
              className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-sm transition-all active:scale-95">
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* User info */}
          {userEmail ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-green-400 text-xs">●</span>
                <span className="text-xs text-zinc-400 truncate">{userEmail}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <a href="/games" className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
                  History
                </a>
                <button onClick={handleLogout} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors">
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-zinc-600 italic">Playing as guest</span>
              <a href="/auth" className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
                Sign in
              </a>
            </div>
          )}

          {/* Game mode */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-1 flex gap-1">
            {(["local", "vs-computer"] as GameMode[]).map((mode) => (
              <button key={mode} onClick={() => handleModeChange(mode)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  gameMode === mode ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}>
                {mode === "local" ? "Local" : "Vs Computer"}
              </button>
            ))}
          </div>

          {/* Vs Computer options */}
          {gameMode === "vs-computer" && (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Play as</p>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-1 flex gap-1">
                  <button onClick={() => handlePlayerColorChange("w")}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      playerColor === "w" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-300"
                    }`}>♔ White</button>
                  <button onClick={() => handlePlayerColorChange("b")}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      playerColor === "b" ? "bg-zinc-800 text-zinc-100 border border-zinc-600" : "text-zinc-500 hover:text-zinc-300"
                    }`}>♚ Black</button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Difficulty</p>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                  {(["easy", "medium", "hard", "expert"] as BotDifficulty[]).map((d) => (
                    <button key={d} onClick={() => handleDifficultyChange(d)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                        difficulty === d ? difficultyColor[d] : "text-zinc-500 hover:text-zinc-300"
                      }`}>
                      {difficultyLabel[d]}
                      {d === "expert" && <span className="ml-1 text-[9px] opacity-70">SF</span>}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-600 italic px-1">{difficultyDesc[difficulty]}</p>
              </div>
            </>
          )}

          {/* Time control */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Time Control</p>
            <div className="grid grid-cols-5 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
              {TIME_OPTIONS.map((opt) => (
                <button key={opt.seconds} onClick={() => handleTimeControlChange(opt.seconds)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    timeControl === opt.seconds ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {timeControl > 0 && <p className="text-[11px] text-zinc-600 italic px-1">Undo disabled with active clock.</p>}
          </div>

          {/* Status */}
          <div className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${VARIANT_STYLES[statusState.variant]}`}>
            <div className="flex items-center gap-2">
              {isBotThinking && <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 animate-pulse shrink-0" />}
              {isBotThinking ? thinkingLabel : statusState.text}
            </div>
          </div>

          {/* Eval (Expert only) */}
          {showEvalBar && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                {isBookMove ? "Book" : "Evaluation"}
              </span>
              <span className={`text-sm font-bold font-mono tabular-nums ${
                isBookMove ? "text-emerald-400"
                : evalState.type === "mate"
                  ? evalState.value > 0 ? "text-white" : "text-zinc-500"
                  : evalState.value > 50  ? "text-white"
                  : evalState.value < -50 ? "text-zinc-500"
                  : "text-zinc-300"
              }`}>
                {isBookMove ? "📖" : evalDisplay}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={handleRestart}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold transition-all">
              Restart
            </button>
            <button onClick={handleFlipBoard}
              className="px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white text-sm font-semibold transition-all"
              title="Flip board">⇅</button>
            <button onClick={handleUndo} disabled={!hasMoves || isGameOver || isBotThinking || timeControl > 0}
              className="flex-1 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all">
              Undo
            </button>
          </div>

          {/* Move history */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Move History</p>
              {hasMoves && <span className="text-[11px] text-zinc-600 tabular-nums">{moveHistory.length} move{moveHistory.length !== 1 ? "s" : ""}</span>}
            </div>
            {pairedMoves.length === 0
              ? <p className="text-xs text-zinc-600 italic">No moves yet.</p>
              : (
                <div ref={historyContainerRef} className="max-h-48 overflow-y-auto pr-1 space-y-0.5">
                  {pairedMoves.map(([white, black], idx) => (
                    <div key={idx} className={`grid grid-cols-[28px_1fr_1fr] gap-1 text-sm rounded px-1 py-0.5 ${
                      idx === pairedMoves.length - 1 ? "bg-zinc-800/60" : "hover:bg-zinc-900"
                    }`}>
                      <span className="text-zinc-600 tabular-nums">{idx + 1}.</span>
                      <span className="text-zinc-200 font-mono">{white}</span>
                      <span className="text-zinc-400 font-mono">{black ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* PGN Export */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Export</p>
            {hasMoves
              ? <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 max-h-28 overflow-y-auto">
                  <p className="text-[10px] font-mono text-zinc-500 break-all leading-relaxed whitespace-pre-wrap">
                    {buildPgn(gameRef.current, gameMode, playerColor, timedOutRef.current)}
                  </p>
                </div>
              : <p className="text-xs text-zinc-600 italic">Play some moves to enable export.</p>
            }
            <div className="flex gap-2">
              <button onClick={handleCopyPgn} disabled={!hasMoves}
                className="flex-1 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all">
                {copyPgnState === "copied" ? "✓ Copied!" : "Copy PGN"}
              </button>
              <button onClick={handleDownloadPgn} disabled={!hasMoves}
                className="flex-1 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all">
                Download
              </button>
            </div>
            <button onClick={handleCopyFen}
              className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-semibold transition-all">
              {copyFenState === "copied" ? "✓ FEN Copied!" : "Copy FEN"}
            </button>
          </div>

          {/* Game over banner */}
          {isGameOver && (
            <div className="space-y-2">
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-xs text-zinc-400">
                Game over —{" "}
                <button onClick={handleRestart}
                  className="text-white font-semibold underline underline-offset-2 hover:text-indigo-400 transition-colors">
                  Restart
                </button>{" "}to play again
              </div>
              {userEmail && (
                <button
                  onClick={handleSaveGame}
                  disabled={gameSaving || gameSaved}
                  className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all"
                >
                  {gameSaved ? "✓ Game Saved!" : gameSaving ? "Saving…" : "Save Game"}
                </button>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Legend</p>
            {[
              { style: { background: "rgba(99,102,241,0.55)" },           label: "Selected piece",  round: false },
              { style: { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)" }, label: "Legal move",    round: true  },
              { style: { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)" }, label: "Legal capture", round: true  },
              { style: { background: "rgba(255,255,100,0.30)" },           label: "Last move",       round: false },
            ].map(({ style, label, round }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className={`w-4 h-4 shrink-0 ${round ? "rounded-full" : "rounded-sm"}`} style={style} />
                {label}
              </div>
            ))}
          </div>

          {/* FEN debug */}
          <details>
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors select-none">
              FEN (debug)
            </summary>
            <p className="mt-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-mono text-zinc-500 break-all leading-relaxed">
              {fen}
            </p>
          </details>
        </aside>
      </section>
    </main>
  );
}
