"use client";

import { useRef, useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { CSSProperties } from "react";

// -- Types --------------------------------------------------------------------

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

// -- Opening book --------------------------------------------------------------

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

// -- Constants ----------------------------------------------------------------

const TIME_OPTIONS: TimeOption[] = [
  { label: "8",     seconds: 0   },
  { label: "1 min", seconds: 60  },
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 m",  seconds: 600 },
];

const VARIANT_STYLES: Record<StatusVariant, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-white/88",
  check:   "border-[rgba(215,182,125,0.28)] bg-[rgba(104,81,39,0.18)] text-[rgba(244,228,193,0.94)]",
  draw:    "border-[rgba(124,130,255,0.24)] bg-[rgba(52,57,112,0.18)] text-[rgba(226,229,255,0.92)]",
  over:    "border-[rgba(214,103,103,0.22)] bg-[rgba(122,38,38,0.2)] text-[rgba(255,214,214,0.92)]",
};

const PIECE_SYMBOLS: Record<string, string> = {
  p: "?", n: "?", b: "?", r: "?", q: "?",
  P: "?", N: "?", B: "?", R: "?", Q: "?",
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

// -- Eval helpers --------------------------------------------------------------

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

// -- Sub-components ------------------------------------------------------------

interface ClockBadgeProps { time: number; isActive: boolean; isTimedOut: boolean; }
function ClockBadge({ time, isActive, isTimedOut }: ClockBadgeProps) {
  const m = Math.floor(time / 60);
  const s = time % 60;
  return (
    <div className={`tabular-nums rounded-full border px-3.5 py-1.5 font-mono text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all ${
      isTimedOut
        ? "border-[rgba(214,103,103,0.28)] bg-[rgba(122,38,38,0.24)] text-[rgba(255,215,215,0.94)]"
        : isActive
          ? "border-[rgba(124,130,255,0.34)] bg-[rgba(62,67,131,0.26)] text-[rgba(236,238,255,0.96)]"
          : "border-white/10 bg-white/[0.04] text-white/46"
    }`}>
      {m}:{s.toString().padStart(2, "0")}
    </div>
  );
}

interface EvalBarProps { whitePercent: number; display: string; orientation: BoardOrientation; }
function EvalBar({ whitePercent, display, orientation }: EvalBarProps) {
  const flipped = orientation === "black";
  return (
    <div className="relative w-5 flex-shrink-0 self-stretch cursor-default select-none overflow-hidden rounded-full border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        className="absolute left-0 right-0 bg-[rgba(242,236,225,0.9)] transition-all duration-500 ease-out"
        style={flipped ? { top: 0, height: `${whitePercent}%` } : { bottom: 0, height: `${whitePercent}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <span className="font-mono font-bold leading-none text-white/45" style={{ fontSize: "7px", writingMode: "vertical-lr" }}>
          {display}
        </span>
      </div>
    </div>
  );
}

// -- PGN helpers ---------------------------------------------------------------

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

// -- Bot helpers ---------------------------------------------------------------

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

// -- Game helpers --------------------------------------------------------------

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

// -- Component ----------------------------------------------------------------

export default function ChessGame() {
  const gameRef = useRef<Chess>(new Chess());

  // ? Turbopack-safe: all complex types on initial variables
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

  // -- Refs ------------------------------------------------------------------
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

  // -- Effects ---------------------------------------------------------------

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

  // -- Sound -----------------------------------------------------------------

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

  // -- Helpers ---------------------------------------------------------------

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

  // -- Expert bot ------------------------------------------------------------

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

  // -- Random / heuristic bot ------------------------------------------------

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

  // -- Move execution --------------------------------------------------------

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

  // -- Square click ----------------------------------------------------------

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

  // -- Controls --------------------------------------------------------------

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

  // -- Auth ------------------------------------------------------------------

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setUserEmail("");
  }

  // -- Save game -------------------------------------------------------------

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

  // -- PGN / FEN export ------------------------------------------------------

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

  // -- Derived ---------------------------------------------------------------

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

  const topCaptured    = boardOrientation === "white" ? captured.black : captured.white;
  const bottomCaptured = boardOrientation === "white" ? captured.white : captured.black;
  const topColor: "w" | "b"    = boardOrientation === "white" ? "b" : "w";
  const bottomColor: "w" | "b" = boardOrientation === "white" ? "w" : "b";
  const thinkingLabel  = isBookMove ? "Playing book move…" : "Computer thinking…";
  const topSeatLabel = boardOrientation === "white"
    ? (gameMode === "vs-computer" ? (playerColor === "w" ? "Computer · Black" : "You · Black") : "Black pieces")
    : (gameMode === "vs-computer" ? (playerColor === "w" ? "You · White" : "Computer · White") : "White pieces");
  const bottomSeatLabel = boardOrientation === "white"
    ? (gameMode === "vs-computer" ? (playerColor === "w" ? "You · White" : "Computer · White") : "White pieces")
    : (gameMode === "vs-computer" ? (playerColor === "w" ? "Computer · Black" : "You · Black") : "Black pieces");
  const sessionLabel = gameMode === "local" ? "Local board" : `${difficultyLabel[difficulty]} engine`;
  const sessionTone = gameMode === "local" ? "lux-badge" : difficulty === "expert" ? "lux-badge-gold" : "lux-badge-indigo";
  const railShell = "rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.78),rgba(8,8,11,0.9))] shadow-[0_30px_90px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl";
  const insetShell = "rounded-[1.45rem] border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
  const sectionLabel = "text-[10px] uppercase tracking-[0.34em] text-white/32";
  const utilityButton = "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/82 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.08]";
  const optionButton = "rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/76 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.08]";
  const optionButtonActive = "rounded-full border border-[rgba(215,182,125,0.3)] bg-[linear-gradient(180deg,rgba(215,182,125,0.24),rgba(138,104,56,0.18))] px-4 py-3 text-sm font-semibold text-[rgba(249,237,214,0.94)] shadow-[0_14px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all duration-300";
  const optionButtonIndigo = "rounded-full border border-[rgba(124,130,255,0.28)] bg-[rgba(66,71,141,0.24)] px-4 py-3 text-sm font-semibold text-[rgba(231,234,255,0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300";

  // -- Render ----------------------------------------------------------------

  return (
    <main className="lux-shell relative min-h-screen overflow-hidden bg-[#050507] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(216,187,136,0.12),rgba(83,90,165,0.08)_42%,transparent_72%)] blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[44rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_68%)] blur-[120px]" />
        <span aria-hidden className="absolute left-1/2 top-[6%] -translate-x-1/2 text-[28rem] font-serif leading-none text-white/[0.03] blur-[8px]">
          ♞
        </span>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_38%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      <section className="relative mx-auto flex w-full max-w-[1540px] flex-col gap-5 xl:grid xl:grid-cols-[232px_minmax(0,1fr)_360px] xl:items-start">
        <header className="order-1 xl:col-span-3">
          <div className="flex flex-col gap-4 rounded-[999px] border border-white/10 bg-[rgba(10,10,14,0.68)] px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className={sectionLabel}>chess</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/50">
                <span>{userEmail || "Guest session"}</span>
                <span className="h-1 w-1 rounded-full bg-white/18" />
                <span>{boardOrientation === "white" ? "White at base" : "Black at base"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`${sessionTone} inline-flex rounded-full px-4 py-2 text-sm font-semibold`}>
                {sessionLabel}
              </span>
              {timeControl > 0 && (
                <span className="lux-badge inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                  {Math.floor(timeControl / 60)} min clock
                </span>
              )}
              {showEvalBar && (
                <span className="lux-badge-gold inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                  Live evaluation
                </span>
              )}
              <a href="/" className={utilityButton}>
                Home
              </a>
              <a href="/multiplayer" className={utilityButton}>
                Multiplayer
              </a>
            </div>
          </div>
        </header>

        <aside className={`order-2 p-5 xl:order-2 ${railShell}`}>
          <div className="space-y-5">
            <div>
              <p className={sectionLabel}>Player rail</p>
              <p className="mt-4 text-lg font-medium tracking-tight text-white/92">{userEmail || "Guest session"}</p>
              <p className="mt-1 text-sm text-white/44">
                {boardOrientation === "white" ? "White at base" : "Black at base"}
              </p>
            </div>

            <div className="border-t border-white/8 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={sectionLabel}>Upper</p>
                  <p className="mt-3 text-sm text-white/78">{topSeatLabel}</p>
                </div>
                {timeControl > 0 ? (
                  <ClockBadge
                    time={topColor === "w" ? whiteTime : blackTime}
                    isActive={clockActive && currentTurn === topColor}
                    isTimedOut={timedOutColor === topColor}
                  />
                ) : (
                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/36">Untimed</span>
                )}
              </div>
              <div className="mt-4 min-h-7 text-lg leading-none text-[var(--gold-soft)]">
                {topCaptured.length > 0 ? topCaptured.join("") : <span className="text-xs text-white/34">No captures</span>}
              </div>
            </div>

            <div className="border-t border-white/8 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={sectionLabel}>Lower</p>
                  <p className="mt-3 text-sm text-white/78">{bottomSeatLabel}</p>
                </div>
                {timeControl > 0 ? (
                  <ClockBadge
                    time={bottomColor === "w" ? whiteTime : blackTime}
                    isActive={clockActive && currentTurn === bottomColor}
                    isTimedOut={timedOutColor === bottomColor}
                  />
                ) : (
                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/36">Untimed</span>
                )}
              </div>
              <div className="mt-4 min-h-7 text-lg leading-none text-[var(--gold-soft)]">
                {bottomCaptured.length > 0 ? bottomCaptured.join("") : <span className="text-xs text-white/34">No captures</span>}
              </div>
            </div>

            <div className="border-t border-white/8 pt-5">
              <div className={`rounded-[1.4rem] border px-4 py-4 text-sm transition-colors ${VARIANT_STYLES[statusState.variant]}`}>
                <div className="flex items-center gap-2">
                  {isBotThinking && <span className="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white/70" />}
                  <span className="font-medium">{isBotThinking ? thinkingLabel : statusState.text}</span>
                </div>
                {showEvalBar && (
                  <div className="mt-4 flex items-center justify-between rounded-full border border-white/8 bg-black/10 px-3 py-2">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-white/34">{isBookMove ? "Book" : "Eval"}</span>
                    <span className="font-mono text-sm text-[var(--gold-soft)]">{isBookMove ? "Booked" : evalDisplay}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="order-3 xl:order-3">
          <div className="relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,13,0.86),rgba(6,6,8,0.94))] px-3 py-4 shadow-[0_44px_120px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-5 sm:py-5">
            <div className="pointer-events-none absolute inset-x-[16%] top-8 h-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_72%)] blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[68%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(218,189,138,0.12),rgba(77,84,150,0.08)_48%,transparent_72%)] blur-[90px]" />
            <div className={`relative mx-auto w-full ${boardMaxW} space-y-4`}>
              <div className={`${insetShell} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
                <div>
                  <p className={sectionLabel}>{topSeatLabel}</p>
                  <div className="mt-2 min-h-6 text-lg leading-none text-[var(--gold-soft)]">
                    {topCaptured.length > 0 ? topCaptured.join("") : <span className="text-xs italic text-white/34">No captures yet</span>}
                  </div>
                </div>
                {timeControl > 0 && (
                  <ClockBadge
                    time={topColor === "w" ? whiteTime : blackTime}
                    isActive={clockActive && currentTurn === topColor}
                    isTimedOut={timedOutColor === topColor}
                  />
                )}
              </div>

              <div className="flex items-stretch gap-3 sm:gap-4">
                {showEvalBar && <EvalBar whitePercent={whitePercent} display={evalDisplay} orientation={boardOrientation} />}
                <div className="relative min-w-0 flex-1">
                  <div className="pointer-events-none absolute inset-[7%] rounded-[2rem] bg-[radial-gradient(circle,rgba(255,255,255,0.1),rgba(218,189,138,0.06)_36%,transparent_72%)] blur-[58px]" />
                  <div className="pointer-events-none absolute inset-x-[8%] -bottom-10 h-24 rounded-full bg-black/70 blur-3xl" />
                  <div className="relative rounded-[2.25rem] border border-white/12 bg-[linear-gradient(160deg,rgba(29,29,37,0.76),rgba(10,10,13,0.92))] p-3 shadow-[0_36px_100px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                    <div className="rounded-[1.9rem] border border-white/10 bg-[#09090c] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
                      <Chessboard
                        id="MainBoard"
                        position={fen}
                        onPieceDrop={onPieceDrop}
                        onSquareClick={onSquareClick}
                        arePiecesDraggable={!boardLocked}
                        boardOrientation={boardOrientation}
                        customSquareStyles={customSquareStyles}
                        customBoardStyle={{
                          borderRadius: "22px",
                          boxShadow: "0 42px 110px rgba(0,0,0,0.56)",
                          opacity: isBotThinking ? 0.88 : 1,
                          transition: "opacity 0.2s ease, transform 0.2s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${insetShell} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
                <div>
                  <p className={sectionLabel}>{bottomSeatLabel}</p>
                  <div className="mt-2 min-h-6 text-lg leading-none text-[var(--gold-soft)]">
                    {bottomCaptured.length > 0 ? bottomCaptured.join("") : <span className="text-xs italic text-white/34">No captures yet</span>}
                  </div>
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
          </div>
        </section>

        <aside className="order-4 space-y-4 xl:order-4">

          <section className={`p-5 ${railShell}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={sectionLabel}>Control rail</p>
                <p className="mt-4 text-lg font-medium tracking-tight text-white/92">Match settings</p>
                <p className="mt-2 text-sm leading-6 text-white/48">
                  Quiet controls for mode, clocks, notation, and board actions.
                </p>
              </div>
              <button
                onClick={handleToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className={utilityButton}
              >
                {isMuted ? "Muted" : "Sound"}
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3 text-sm">
              <a href="/games" className="text-[var(--indigo-soft)] transition-colors hover:text-white">
                History
              </a>
              {userEmail ? (
                <button onClick={handleLogout} className="text-white/42 transition-colors hover:text-white/78">
                  Logout
                </button>
              ) : (
                <a href="/auth" className="text-white/42 transition-colors hover:text-white/78">
                  Sign in
                </a>
              )}
            </div>

            <div className="mt-5 border-t border-white/8 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`${insetShell} px-4 py-3`}>
                  <p className={sectionLabel}>Mode</p>
                  <p className="mt-2 text-sm text-white/84">{gameMode === "local" ? "Local board" : "Engine match"}</p>
                </div>
                <div className={`${insetShell} px-4 py-3`}>
                  <p className={sectionLabel}>Clock</p>
                  <p className="mt-2 text-sm text-white/84">{timeControl > 0 ? `${Math.floor(timeControl / 60)} min selected` : "Untimed session"}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-white/8 pt-5">
              <p className={sectionLabel}>Mode</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["local", "vs-computer"] as GameMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={gameMode === mode ? optionButtonActive : optionButton}
                  >
                    {mode === "local" ? "Local" : "Vs Computer"}
                  </button>
                ))}
              </div>
            </div>

            {gameMode === "vs-computer" && (
              <>
                <div className="mt-5 border-t border-white/8 pt-5">
                  <p className={sectionLabel}>Seat</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePlayerColorChange("w")}
                      className={playerColor === "w" ? optionButtonActive : optionButton}
                    >
                      White
                    </button>
                    <button
                      onClick={() => handlePlayerColorChange("b")}
                      className={playerColor === "b" ? optionButtonActive : optionButton}
                    >
                      Black
                    </button>
                  </div>
                </div>

                <div className="mt-5 border-t border-white/8 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className={sectionLabel}>Engine</p>
                    <span className={`${difficulty === "expert" ? "lux-badge-gold" : "lux-badge-indigo"} inline-flex rounded-full px-3 py-1 text-xs font-semibold`}>
                      {difficultyLabel[difficulty]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(["easy", "medium", "hard", "expert"] as BotDifficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => handleDifficultyChange(d)}
                        className={difficulty === d ? optionButtonIndigo : optionButton}
                      >
                        {difficultyLabel[d]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/50">{difficultyDesc[difficulty]}</p>
                </div>
              </>
            )}

            <div className="mt-5 border-t border-white/8 pt-5">
              <p className={sectionLabel}>Clock</p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => handleTimeControlChange(opt.seconds)}
                    className={timeControl === opt.seconds ? optionButtonIndigo : optionButton}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {timeControl > 0 && (
                <p className="mt-3 text-xs leading-6 text-white/40">Undo is disabled while a live clock is active.</p>
              )}
            </div>

            <div className="mt-5 border-t border-white/8 pt-5">
              <p className={sectionLabel}>Actions</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleRestart}
                  className="lux-button-primary flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
                >
                  Restart
                </button>
                <button
                  onClick={handleFlipBoard}
                  className={utilityButton}
                  title="Flip board"
                >
                  Flip
                </button>
                <button
                  onClick={handleUndo}
                  disabled={!hasMoves || isGameOver || isBotThinking || timeControl > 0}
                  className={`${utilityButton} flex-1 disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  Undo
                </button>
              </div>
            </div>
          </section>

          <section className={`p-5 ${railShell}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={sectionLabel}>Notation</p>
                <p className="mt-4 text-lg font-medium tracking-tight text-white/92">Move history</p>
              </div>
              {hasMoves && (
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/36">
                  {moveHistory.length} move{moveHistory.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {pairedMoves.length === 0 ? (
              <p className="mt-4 text-sm italic text-white/34">No moves yet.</p>
            ) : (
              <div ref={historyContainerRef} className="mt-4 max-h-64 space-y-1 overflow-y-auto pr-1">
                {pairedMoves.map(([white, black], idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[34px_1fr_1fr] gap-2 rounded-[1rem] px-3 py-2 text-sm transition-colors ${
                      idx === pairedMoves.length - 1 ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="font-mono text-white/32">{idx + 1}.</span>
                    <span className="font-mono text-white/82">{white}</span>
                    <span className="font-mono text-white/54">{black ?? ""}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-white/8 pt-5">
              <p className={sectionLabel}>Export</p>
              {hasMoves ? (
                <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-[rgba(8,8,12,0.76)] p-3">
                  <div className="max-h-32 overflow-y-auto pr-1">
                    <p className="font-mono text-[11px] leading-6 text-white/50 whitespace-pre-wrap break-all">
                      {buildPgn(gameRef.current, gameMode, playerColor, timedOutRef.current)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/38">Play a few moves to enable PGN and FEN export.</p>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={handleCopyPgn}
                  disabled={!hasMoves}
                  className={`${optionButtonIndigo} disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  {copyPgnState === "copied" ? "PGN copied" : "Copy PGN"}
                </button>
                <button
                  onClick={handleDownloadPgn}
                  disabled={!hasMoves}
                  className={`${optionButton} disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  Download PGN
                </button>
              </div>
              <button
                onClick={handleCopyFen}
                className={`${utilityButton} mt-2 w-full`}
              >
                {copyFenState === "copied" ? "FEN copied" : "Copy FEN"}
              </button>
            </div>

            {isGameOver && (
              <div className="mt-6 border-t border-white/8 pt-5">
                <div className={`${insetShell} px-4 py-4 text-sm text-white/66`}>
                  Game over. Restart to open a fresh board.
                </div>
                {userEmail && (
                  <button
                    onClick={handleSaveGame}
                    disabled={gameSaving || gameSaved}
                    className="lux-button-primary mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {gameSaved ? "Game saved" : gameSaving ? "Saving..." : "Save game"}
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-white/8 pt-5">
              <p className={sectionLabel}>Board guide</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  { style: { background: "rgba(99,102,241,0.55)" }, label: "Selected piece", round: false },
                  { style: { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)" }, label: "Legal move", round: true },
                  { style: { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)" }, label: "Legal capture", round: true },
                  { style: { background: "rgba(255,255,100,0.30)" }, label: "Last move", round: false },
                ].map(({ style, label, round }) => (
                  <div key={label} className="flex items-center gap-3 text-sm text-white/56">
                    <span className={`h-4 w-4 shrink-0 ${round ? "rounded-full" : "rounded-sm"}`} style={style} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-white/52 transition-colors hover:text-white">
                FEN debug
              </summary>
              <p className="mt-4 rounded-[1.2rem] border border-white/8 bg-[rgba(8,8,12,0.76)] px-4 py-3 font-mono text-[11px] leading-6 text-white/44 break-all">
                {fen}
              </p>
            </details>
          </section>
        </aside>
      </section>
    </main>
  );
}

