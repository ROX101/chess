"use client";

import { useRef, useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { io, Socket } from "socket.io-client";
import type { CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type PlayerColor      = "w" | "b";
type BoardOrientation = "white" | "black";
type LobbyStatus      = "idle" | "waiting" | "playing" | "finished";

interface LastMove { from: string; to: string; }

// ── Highlight styles ──────────────────────────────────────────────────────────

const STYLE_LAST_FROM: CSSProperties     = { background: "rgba(255,255,100,0.20)" };
const STYLE_LAST_TO: CSSProperties       = { background: "rgba(255,255,100,0.30)" };
const STYLE_SELECTED: CSSProperties      = { background: "rgba(99,102,241,0.55)", borderRadius: "4px" };
const STYLE_LEGAL_EMPTY: CSSProperties   = { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)", borderRadius: "50%" };
const STYLE_LEGAL_CAPTURE: CSSProperties = { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)", borderRadius: "50%" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSquareStyles(
  lastMove: LastMove | null,
  sel: Square | null,
  legal: Record<string, CSSProperties>,
): Record<string, CSSProperties> {
  const s: Record<string, CSSProperties> = {};
  if (lastMove) { s[lastMove.from] = STYLE_LAST_FROM; s[lastMove.to] = STYLE_LAST_TO; }
  Object.entries(legal).forEach(([sq, st]) => { s[sq] = st; });
  if (sel) s[sel] = STYLE_SELECTED;
  return s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MultiplayerGame() {
  const gameRef    = useRef<Chess>(new Chess());
  const socketRef  = useRef<Socket | null>(null);

  // ✅ Turbopack-safe initial variables
  const initialLastMove: LastMove | null                   = null;
  const initialColor: PlayerColor                          = "w";
  const initialOrientation: BoardOrientation               = "white";
  const initialLobby: LobbyStatus                          = "idle";
  const initialLegalSquares: Record<string, CSSProperties> = {};
  const initialSelectedSquare: Square | null               = null;

  const [fen,             setFen]             = useState(gameRef.current.fen());
  const [roomId,          setRoomId]          = useState("");
  const [inputRoomId,     setInputRoomId]     = useState("");
  const [playerColor,     setPlayerColor]     = useState(initialColor);
  const [orientation,     setOrientation]     = useState(initialOrientation);
  const [lobbyStatus,     setLobbyStatus]     = useState(initialLobby);
  const [statusText,      setStatusText]      = useState("");
  const [lastMove,        setLastMove]        = useState(initialLastMove);
  const [selectedSquare,  setSelectedSquare]  = useState(initialSelectedSquare);
  const [legalSquares,    setLegalSquares]    = useState(initialLegalSquares);
  const [drawOffered,     setDrawOffered]     = useState(false);
  const [gameResult,      setGameResult]      = useState("");
  const [copiedRoom,      setCopiedRoom]      = useState(false);
  const [moveHistory,     setMoveHistory]     = useState<string[]>([]);
  const historyContainerRef = useRef<HTMLDivElement>(null);

  const playerColorRef = useRef<PlayerColor>("w");
  const roomIdRef      = useRef("");

  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);
  useEffect(() => { roomIdRef.current      = roomId;      }, [roomId]);

  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [moveHistory]);

  // ── Socket setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("assignColor", ({ color, roomId: rid }: { color: PlayerColor; roomId: string }) => {
      setPlayerColor(color);
      playerColorRef.current = color;
      setRoomId(rid);
      roomIdRef.current = rid;
      setOrientation(color === "w" ? "white" : "black");
    });

    socket.on("waitingForOpponent", ({ roomId: rid }: { roomId: string }) => {
      setRoomId(rid);
      roomIdRef.current = rid;
      setLobbyStatus("waiting");
      setStatusText("Waiting for opponent to join…");
    });

    socket.on("gameStart", () => {
      setLobbyStatus("playing");
      setStatusText("");
      gameRef.current = new Chess();
      setFen(gameRef.current.fen());
      setLastMove(null);
      setMoveHistory([]);
    });

    socket.on("opponentMove", ({ move, fen }: { move: string; fen: string }) => {
      const g = gameRef.current;
      try {
        const result = g.move(move);
        if (result) {
          setFen(g.fen());
          setLastMove({ from: result.from, to: result.to });
          setMoveHistory(g.history());
          checkGameOver(g);
        }
      } catch { /* invalid move from server */ }
    });

    socket.on("gameEnded", ({ result, reason }: { result: string; reason?: string }) => {
      setLobbyStatus("finished");
      setGameResult(result);
      const msg = reason === "resignation"
        ? `${result === "1-0" ? "Black" : "White"} resigned. ${result === "1-0" ? "White" : "Black"} wins!`
        : result === "1/2-1/2" ? "Draw agreed!"
        : `Game over — ${result}`;
      setStatusText(msg);
    });

    socket.on("opponentDisconnected", () => {
      setLobbyStatus("finished");
      setStatusText("Opponent disconnected. You win!");
      setGameResult(playerColorRef.current === "w" ? "1-0" : "0-1");
    });

    socket.on("drawOffered", () => { setDrawOffered(true); });
    socket.on("drawDeclined", () => {
      setStatusText("Draw offer declined.");
      setTimeout(() => setStatusText(""), 3000);
    });

    socket.on("roomError", (msg: string) => {
      setStatusText(msg);
      setLobbyStatus("idle");
    });

    return () => { socket.disconnect(); };
  }, []);

  // ── Game over check ───────────────────────────────────────────────────────

  function checkGameOver(g: Chess) {
    if (!g.isGameOver()) return;
    let result = "*";
    let msg    = "";
    if (g.isCheckmate()) {
      result = g.turn() === "b" ? "1-0" : "0-1";
      msg    = `Checkmate! ${result === "1-0" ? "White" : "Black"} wins!`;
    } else if (g.isStalemate())            { result = "1/2-1/2"; msg = "Stalemate — draw!"; }
    else if (g.isThreefoldRepetition())    { result = "1/2-1/2"; msg = "Threefold repetition — draw!"; }
    else if (g.isInsufficientMaterial())   { result = "1/2-1/2"; msg = "Insufficient material — draw!"; }
    else if (g.isDraw())                   { result = "1/2-1/2"; msg = "50-move rule — draw!"; }

    setGameResult(result);
    setStatusText(msg);
    setLobbyStatus("finished");
    socketRef.current?.emit("gameOver", { roomId: roomIdRef.current, result });
  }

  // ── Move handling ─────────────────────────────────────────────────────────

  function attemptMove(from: Square, to: Square): boolean {
    const g = gameRef.current;
    if (g.turn() !== playerColorRef.current) return false;
    if (lobbyStatus !== "playing") return false;

    try {
      const move = g.move({ from, to, promotion: "q" });
      if (!move) return false;

      setFen(g.fen());
      setLastMove({ from, to });
      setMoveHistory(g.history());
      clearSelection();

      socketRef.current?.emit("makeMove", {
        roomId: roomIdRef.current,
        move:   move.san,
        fen:    g.fen(),
        turn:   playerColorRef.current,
      });

      checkGameOver(g);
      return true;
    } catch { return false; }
  }

  function onPieceDrop(source: Square, target: Square): boolean {
    return attemptMove(source, target);
  }

  // ── Square click ──────────────────────────────────────────────────────────

  function onSquareClick(square: Square) {
    const g = gameRef.current;
    if (lobbyStatus !== "playing") return;
    if (g.turn() !== playerColorRef.current) return;

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

  function clearSelection() { setSelectedSquare(null); setLegalSquares({}); }

  // ── Lobby actions ─────────────────────────────────────────────────────────

  function handleQuickMatch() {
    setLobbyStatus("waiting");
    setStatusText("Finding a game…");
    socketRef.current?.emit("joinGame");
  }

  function handleJoinRoom() {
    if (!inputRoomId.trim()) return;
    setLobbyStatus("waiting");
    setStatusText(`Joining room ${inputRoomId.toUpperCase()}…`);
    socketRef.current?.emit("joinGame", inputRoomId.toUpperCase());
  }

  function handleCopyRoomId() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 2000);
    });
  }

  // ── In-game actions ───────────────────────────────────────────────────────

  function handleResign() {
    socketRef.current?.emit("resign", { roomId, color: playerColor });
  }

  function handleOfferDraw() {
    socketRef.current?.emit("offerDraw", { roomId });
    setStatusText("Draw offered…");
  }

  function handleAcceptDraw() {
    setDrawOffered(false);
    socketRef.current?.emit("acceptDraw", { roomId });
  }

  function handleDeclineDraw() {
    setDrawOffered(false);
    socketRef.current?.emit("declineDraw", { roomId });
  }

  function handlePlayAgain() {
    setLobbyStatus("idle");
    setGameResult("");
    setStatusText("");
    setDrawOffered(false);
    setMoveHistory([]);
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setLastMove(null);
    clearSelection();
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const isMyTurn        = gameRef.current.turn() === playerColor && lobbyStatus === "playing";
  const customStyles    = buildSquareStyles(lastMove, selectedSquare, legalSquares);
  const colorLabel      = playerColor === "w" ? "White" : "Black";

  const pairedMovesInit: [string, string | undefined][] = [];
  const pairedMoves = moveHistory.reduce((acc, move, i) => {
    if (i % 2 === 0) acc.push([move, undefined]);
    else acc[acc.length - 1][1] = move;
    return acc;
  }, pairedMovesInit);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

        {/* ── Board ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 items-center w-full">

          {/* Opponent label */}
          <div className="w-full max-w-[600px] flex items-center justify-between min-h-[36px] px-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${lobbyStatus === "playing" ? "bg-green-400" : "bg-zinc-600"}`} />
              <span className="text-[11px] text-zinc-500 uppercase tracking-widest">
                {playerColor === "w" ? "Black" : "White"}
              </span>
            </div>
            {lobbyStatus === "playing" && !isMyTurn && (
              <span className="text-[11px] text-indigo-400 animate-pulse">thinking…</span>
            )}
          </div>

          {/* Board */}
          <div className="w-full max-w-[600px]">
            <Chessboard
              id="MultiplayerBoard"
              position={fen}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              boardOrientation={orientation}
              arePiecesDraggable={isMyTurn && lobbyStatus === "playing"}
              customSquareStyles={customStyles}
              customBoardStyle={{
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                opacity: !isMyTurn && lobbyStatus === "playing" ? 0.85 : 1,
                transition: "opacity 0.2s ease",
              }}
            />
          </div>

          {/* Your label */}
          <div className="w-full max-w-[600px] flex items-center justify-between min-h-[36px] px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-[11px] text-zinc-400 uppercase tracking-widest">
                You ({colorLabel})
              </span>
            </div>
            {isMyTurn && (
              <span className="text-[11px] text-emerald-400 font-semibold">Your turn</span>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Multiplayer</h1>
            <a href="/play"
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
              ← Solo
            </a>
          </div>

          {/* ── LOBBY ─────────────────────────────────────────────── */}
          {lobbyStatus === "idle" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Play chess against a real opponent in real time.
              </p>

              {/* Quick match */}
              <button
                onClick={handleQuickMatch}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold transition-all"
              >
                ⚡ Quick Match
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[11px] text-zinc-600">or join with code</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {/* Join by room ID */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") handleJoinRoom(); }}
                  placeholder="Room code (e.g. AB12CD)"
                  maxLength={6}
                  className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!inputRoomId.trim()}
                  className="px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-white text-sm font-semibold transition-all"
                >
                  Join
                </button>
              </div>

              {statusText && (
                <p className="text-sm text-red-400 text-center">{statusText}</p>
              )}
            </div>
          )}

          {/* ── WAITING ───────────────────────────────────────────── */}
          {lobbyStatus === "waiting" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-center space-y-3">
                <div className="flex justify-center gap-1">
                  {[0,1,2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm text-zinc-300 font-medium">{statusText}</p>
              </div>

              {/* Room code to share */}
              {roomId && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Share room code
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 font-mono text-lg text-white text-center tracking-widest">
                      {roomId}
                    </div>
                    <button
                      onClick={handleCopyRoomId}
                      className="px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold transition-all"
                    >
                      {copiedRoom ? "✓" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-600 text-center">
                    Share this code with your opponent
                  </p>
                </div>
              )}

              <button
                onClick={handlePlayAgain}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── PLAYING ───────────────────────────────────────────── */}
          {lobbyStatus === "playing" && (
            <div className="space-y-4">

              {/* Room ID */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 uppercase tracking-widest">Room</span>
                <span className="font-mono text-sm text-zinc-300 tracking-widest">{roomId}</span>
              </div>

              {/* Status */}
              <div className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                isMyTurn
                  ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400"
              }`}>
                {isMyTurn ? "⚡ Your turn" : "⏳ Opponent's turn"}
              </div>

              {/* Draw offer received */}
              {drawOffered && (
                <div className="rounded-xl border border-yellow-500/40 bg-yellow-950/20 p-4 space-y-3">
                  <p className="text-sm text-yellow-300 font-medium text-center">
                    Opponent offers a draw
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleAcceptDraw}
                      className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-all">
                      Accept
                    </button>
                    <button onClick={handleDeclineDraw}
                      className="flex-1 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-all">
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {statusText && !drawOffered && (
                <p className="text-[11px] text-zinc-500 text-center">{statusText}</p>
              )}

              {/* In-game actions */}
              <div className="flex gap-2">
                <button onClick={handleOfferDraw}
                  className="flex-1 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-all">
                  ½ Draw
                </button>
                <button onClick={handleResign}
                  className="flex-1 py-2 rounded-xl bg-red-900/50 hover:bg-red-800/60 text-red-300 text-xs font-semibold transition-all border border-red-800/40">
                  🏳 Resign
                </button>
              </div>

              {/* Move history */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Moves
                  </p>
                  {moveHistory.length > 0 && (
                    <span className="text-[11px] text-zinc-600 tabular-nums">
                      {moveHistory.length}
                    </span>
                  )}
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
            </div>
          )}

          {/* ── FINISHED ──────────────────────────────────────────── */}
          {lobbyStatus === "finished" && (
            <div className="space-y-4">
              <div className={`rounded-xl border px-4 py-4 text-center space-y-1 ${
                gameResult === "1/2-1/2"
                  ? "border-blue-500/40 bg-blue-950/20 text-blue-300"
                  : (gameResult === "1-0" && playerColor === "w") || (gameResult === "0-1" && playerColor === "b")
                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                  : "border-red-500/40 bg-red-950/20 text-red-300"
              }`}>
                <p className="text-2xl font-bold">
                  {gameResult === "1/2-1/2"
                    ? "½ Draw"
                    : (gameResult === "1-0" && playerColor === "w") || (gameResult === "0-1" && playerColor === "b")
                    ? "🏆 You Won!"
                    : "You Lost"}
                </p>
                <p className="text-sm opacity-80">{statusText}</p>
              </div>

              {/* Move history after game */}
              {pairedMoves.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                    Game moves
                  </p>
                  <div ref={historyContainerRef} className="max-h-40 overflow-y-auto pr-1 space-y-0.5">
                    {pairedMoves.map(([white, black], idx) => (
                      <div key={idx} className="grid grid-cols-[28px_1fr_1fr] gap-1 text-sm rounded px-1 py-0.5 hover:bg-zinc-900">
                        <span className="text-zinc-600 tabular-nums">{idx + 1}.</span>
                        <span className="text-zinc-200 font-mono">{white}</span>
                        <span className="text-zinc-400 font-mono">{black ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handlePlayAgain}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold transition-all"
              >
                Play Again
              </button>
              <a href="/play"
                className="block w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold text-center transition-all">
                Back to Solo
              </a>
            </div>
          )}

          {/* Legend */}
          {lobbyStatus === "playing" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Legend</p>
              {[
                { style: { background: "rgba(99,102,241,0.55)" },           label: "Selected",      round: false },
                { style: { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)" }, label: "Legal move",  round: true },
                { style: { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)" }, label: "Capture",     round: true },
                { style: { background: "rgba(255,255,100,0.30)" },           label: "Last move",     round: false },
              ].map(({ style, label, round }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className={`w-4 h-4 shrink-0 ${round ? "rounded-full" : "rounded-sm"}`} style={style} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}