"use client";

import { useRef, useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { io, Socket } from "socket.io-client";
import type { CSSProperties } from "react";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PlayerColor      = "w" | "b";
type BoardOrientation = "white" | "black";
type LobbyStatus      = "idle" | "waiting" | "playing" | "finished";

interface LastMove { from: string; to: string; }

// â”€â”€ Highlight styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STYLE_LAST_FROM: CSSProperties     = { background: "rgba(255,255,100,0.20)" };
const STYLE_LAST_TO: CSSProperties       = { background: "rgba(255,255,100,0.30)" };
const STYLE_SELECTED: CSSProperties      = { background: "rgba(99,102,241,0.55)", borderRadius: "4px" };
const STYLE_LEGAL_EMPTY: CSSProperties   = { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)", borderRadius: "50%" };
const STYLE_LEGAL_CAPTURE: CSSProperties = { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)", borderRadius: "50%" };

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MultiplayerGame() {
  const gameRef    = useRef<Chess>(new Chess());
  const socketRef  = useRef<Socket | null>(null);

  // âœ… Turbopack-safe initial variables
  const initialLastMove: LastMove | null                   = null;
  const initialColor: PlayerColor                          = "w";
  const initialOrientation: BoardOrientation               = "white";
  const initialLobby: LobbyStatus                          = "idle";
  const initialLegalSquares: Record<string, CSSProperties> = {};
  const initialSelectedSquare: Square | null               = null;

  const [fen,             setFen]             = useState<string>(gameRef.current.fen());
  const [roomId,          setRoomId]          = useState<string>("");
  const [inputRoomId,     setInputRoomId]     = useState<string>("");
  const [playerColor,     setPlayerColor]     = useState<PlayerColor>(initialColor);
  const [orientation,     setOrientation]     = useState<BoardOrientation>(initialOrientation);
  const [lobbyStatus,     setLobbyStatus]     = useState<LobbyStatus>(initialLobby);
  const [statusText,      setStatusText]      = useState<string>("");
  const [lastMove,        setLastMove]        = useState<LastMove | null>(initialLastMove);
  const [selectedSquare,  setSelectedSquare]  = useState<Square | null>(initialSelectedSquare);
  const [legalSquares,    setLegalSquares]    = useState<Record<string, CSSProperties>>(initialLegalSquares);
  const [drawOffered,     setDrawOffered]     = useState<boolean>(false);
  const [gameResult,      setGameResult]      = useState<string>("");
  const [copiedRoom,      setCopiedRoom]      = useState<boolean>(false);
  const [isMuted,         setIsMuted]         = useState<boolean>(false);
  const [moveHistory,     setMoveHistory]     = useState<string[]>([]);
  const historyContainerRef = useRef<HTMLDivElement>(null);

  const playerColorRef = useRef<PlayerColor>("w");
  const roomIdRef      = useRef("");
  const isMutedRef     = useRef(false);
  const sndMove        = useRef<HTMLAudioElement | null>(null);
  const sndCapture     = useRef<HTMLAudioElement | null>(null);
  const sndCheck       = useRef<HTMLAudioElement | null>(null);
  const sndCheckmate   = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);
  useEffect(() => { roomIdRef.current      = roomId;      }, [roomId]);
  useEffect(() => { isMutedRef.current     = isMuted;     }, [isMuted]);

  useEffect(() => {
    sndMove.current      = new Audio("/move.mp3");
    sndCapture.current   = new Audio("/capture.mp3");
    sndCheck.current     = new Audio("/check.mp3");
    sndCheckmate.current = new Audio("/checkmate.mp3");

    [sndMove, sndCapture, sndCheck, sndCheckmate].forEach((ref) => {
      if (!ref.current) return;
      ref.current.preload = "auto";
      ref.current.load();
    });
  }, []);

  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [moveHistory]);

  // â”€â”€ Socket setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      setStatusText("Waiting for opponent to joinâ€¦");
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
          playMoveSound(result.flags.includes("c") || result.flags.includes("e"), g);
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
        : `Game over â€” ${result}`;
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

  // â”€â”€ Game over check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function checkGameOver(g: Chess) {
    if (!g.isGameOver()) return;
    let result = "*";
    let msg    = "";
    if (g.isCheckmate()) {
      result = g.turn() === "b" ? "1-0" : "0-1";
      msg    = `Checkmate! ${result === "1-0" ? "White" : "Black"} wins!`;
    } else if (g.isStalemate())            { result = "1/2-1/2"; msg = "Stalemate â€” draw!"; }
    else if (g.isThreefoldRepetition())    { result = "1/2-1/2"; msg = "Threefold repetition â€” draw!"; }
    else if (g.isInsufficientMaterial())   { result = "1/2-1/2"; msg = "Insufficient material â€” draw!"; }
    else if (g.isDraw())                   { result = "1/2-1/2"; msg = "50-move rule â€” draw!"; }

    setGameResult(result);
    setStatusText(msg);
    setLobbyStatus("finished");
    socketRef.current?.emit("gameOver", { roomId: roomIdRef.current, result });
  }

  function playMoveSound(isCapture: boolean, afterGame: Chess) {
    if (isMutedRef.current) return;

    let target: HTMLAudioElement | null = null;
    if (afterGame.isCheckmate()) target = sndCheckmate.current;
    else if (afterGame.inCheck()) target = sndCheck.current;
    else if (isCapture) target = sndCapture.current;
    else target = sndMove.current;

    if (!target) return;
    target.currentTime = 0;
    target.play().catch(() => {});
  }

  // â”€â”€ Move handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      playMoveSound(move.flags.includes("c") || move.flags.includes("e"), g);

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

  // â”€â”€ Square click â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Lobby actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function handleQuickMatch() {
    setLobbyStatus("waiting");
    setStatusText("Finding a gameâ€¦");
    socketRef.current?.emit("joinGame");
  }

  function handleJoinRoom() {
    if (!inputRoomId.trim()) return;
    setLobbyStatus("waiting");
    setStatusText(`Joining room ${inputRoomId.toUpperCase()}â€¦`);
    socketRef.current?.emit("joinGame", inputRoomId.toUpperCase());
  }

  function handleCopyRoomId() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 2000);
    });
  }

  function handleToggleMute() {
    setIsMuted((prev) => !prev);
  }

  // â”€â”€ In-game actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function handleResign() {
    socketRef.current?.emit("resign", { roomId, color: playerColor });
  }

  function handleOfferDraw() {
    socketRef.current?.emit("offerDraw", { roomId });
    setStatusText("Draw offeredâ€¦");
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

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const isMyTurn        = gameRef.current.turn() === playerColor && lobbyStatus === "playing";
  const customStyles    = buildSquareStyles(lastMove, selectedSquare, legalSquares);
  const colorLabel      = playerColor === "w" ? "White" : "Black";

  const pairedMovesInit: [string, string | undefined][] = [];
  const pairedMoves = moveHistory.reduce((acc, move, i) => {
    if (i % 2 === 0) acc.push([move, undefined]);
    else acc[acc.length - 1][1] = move;
    return acc;
  }, pairedMovesInit);

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <main className="lux-shell min-h-screen px-4 py-5 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1.12fr)_380px] lg:items-start">

        <div className="space-y-5">
          <header className="lux-panel-strong rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <p className="lux-kicker">Live rooms</p>
                <h1 className="lux-display mt-4 text-5xl text-white sm:text-6xl">Match room.</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/58 sm:text-base">
                  Join, share a code, and play live with the board kept in focus.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className={`${lobbyStatus === "playing" ? "lux-badge-emerald" : lobbyStatus === "waiting" ? "lux-badge-indigo" : "lux-badge"} inline-flex rounded-full px-4 py-2 text-sm font-semibold`}>
                  {lobbyStatus === "playing" ? "Match live" : lobbyStatus === "waiting" ? "Finding opponent" : "Lobby"}
                </span>
                <a href="/" className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5">
                  Home
                </a>
                <a href="/play" className="lux-button-secondary rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5">
                  Solo
                </a>
              </div>
            </div>
          </header>

          <section className="lux-stage p-4 sm:p-5">
            <div className="mx-auto max-w-[612px] space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">Opponent</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${lobbyStatus === "playing" ? "bg-emerald-400" : "bg-white/24"}`} />
                    <span className="text-sm text-white/78">{playerColor === "w" ? "Black pieces" : "White pieces"}</span>
                  </div>
                </div>
                {!isMyTurn && lobbyStatus === "playing" && (
                  <span className="lux-badge-indigo inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                    Opponent thinking
                  </span>
                )}
              </div>

              <div className="lux-board-frame">
                <div className="rounded-[1.45rem] border border-white/8 bg-[rgba(6,6,10,0.72)] p-3 sm:p-4">
                  <Chessboard
                    id="MultiplayerBoard"
                    position={fen}
                    onPieceDrop={onPieceDrop}
                    onSquareClick={onSquareClick}
                    boardOrientation={orientation}
                    arePiecesDraggable={isMyTurn && lobbyStatus === "playing"}
                    customSquareStyles={customStyles}
                    customBoardStyle={{
                      borderRadius: "18px",
                      boxShadow: "0 30px 80px rgba(0,0,0,0.42)",
                      opacity: !isMyTurn && lobbyStatus === "playing" ? 0.88 : 1,
                      transition: "opacity 0.2s ease, transform 0.2s ease",
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">You</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--gold-soft)]" />
                    <span className="text-sm text-white/82">{colorLabel} pieces</span>
                  </div>
                </div>
                {isMyTurn && (
                  <span className="lux-badge-gold inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                    Your move
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">

          <section className="lux-panel-strong rounded-[2rem] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="lux-kicker">Room console</p>
                <h2 className="mt-4 text-2xl font-semibold text-white">Multiplayer controls</h2>
                <p className="mt-2 text-sm leading-6 text-white/56">
                  Create a room, join by code, and manage the match from one quiet rail.
                </p>
              </div>
              <button
                onClick={handleToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className="lux-button-muted rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                {isMuted ? "Muted" : "Sound"}
              </button>
            </div>
          </section>

          {lobbyStatus === "idle" && (
            <section className="lux-panel rounded-[1.8rem] p-4">
              <p className="lux-kicker">Start a room</p>
              <p className="mt-4 text-sm leading-7 text-white/60">
                Quick match drops you into the queue. Room code entry lets you jump straight into a private game.
              </p>

              <button
                onClick={handleQuickMatch}
                className="lux-button-primary mt-5 w-full rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Quick Match
              </button>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/28">Room code</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>

              <div className="mt-5 flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") handleJoinRoom(); }}
                  placeholder="AB12CD"
                  maxLength={6}
                  className="lux-input flex-1 rounded-[1.2rem] px-4 py-3 text-sm font-mono text-white placeholder:text-white/30"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!inputRoomId.trim()}
                  className="lux-button-secondary rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Join
                </button>
              </div>

              {statusText && (
                <p className="mt-4 text-sm text-[rgba(255,192,192,0.92)]">{statusText}</p>
              )}
            </section>
          )}

          {lobbyStatus === "waiting" && (
            <section className="lux-panel rounded-[1.8rem] p-4">
              <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-center">
                <div className="mx-auto flex w-fit gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2.5 w-2.5 rounded-full bg-[var(--indigo-soft)] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm font-medium text-white/82">{statusText}</p>
              </div>

              {roomId && (
                <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-[rgba(8,8,12,0.76)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">Share room code</p>
                  <div className="mt-4 flex gap-2">
                    <div className="lux-input flex-1 rounded-[1.2rem] px-4 py-3 text-center font-mono text-lg tracking-[0.25em] text-white">
                      {roomId}
                    </div>
                    <button
                      onClick={handleCopyRoomId}
                      className="lux-button-secondary rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                    >
                      {copiedRoom ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handlePlayAgain}
                className="lux-button-muted mt-4 w-full rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Cancel
              </button>
            </section>
          )}

          {lobbyStatus === "playing" && (
            <>
              <section className="lux-panel rounded-[1.8rem] p-4">
                <div className="flex items-center justify-between">
                  <p className="lux-kicker">Live room</p>
                  <span className="lux-badge-emerald inline-flex rounded-full px-3 py-1 text-xs font-semibold">Active</span>
                </div>
                <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">Room code</p>
                  <p className="mt-2 font-mono text-lg tracking-[0.24em] text-white/82">{roomId}</p>
                </div>
                <div className={`mt-4 rounded-[1.35rem] border px-4 py-4 text-sm font-medium transition-colors ${
                  isMyTurn
                    ? "border-[rgba(70,196,153,0.25)] bg-[rgba(70,196,153,0.12)] text-[rgba(189,246,227,0.94)]"
                    : "border-white/8 bg-white/[0.03] text-white/62"
                }`}>
                  {isMyTurn ? "Your turn" : "Opponent's turn"}
                </div>

                {drawOffered && (
                  <div className="mt-4 rounded-[1.35rem] border border-[rgba(215,182,125,0.22)] bg-[rgba(215,182,125,0.1)] p-4">
                    <p className="text-sm font-medium text-[var(--gold-soft)]">Opponent offers a draw.</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={handleAcceptDraw}
                        className="lux-button-primary flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      >
                        Accept
                      </button>
                      <button
                        onClick={handleDeclineDraw}
                        className="lux-button-muted flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {statusText && !drawOffered && (
                  <p className="mt-4 text-sm text-white/48">{statusText}</p>
                )}
              </section>

              <section className="lux-panel rounded-[1.8rem] p-4">
                <p className="lux-kicker">Match actions</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleOfferDraw}
                    className="lux-button-secondary flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  >
                    Offer draw
                  </button>
                  <button
                    onClick={handleResign}
                    className="rounded-full border border-[rgba(242,125,125,0.24)] bg-[rgba(116,27,27,0.24)] px-4 py-3 text-sm font-semibold text-[rgba(255,196,196,0.92)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[rgba(116,27,27,0.34)]"
                  >
                    Resign
                  </button>
                </div>
              </section>

              <section className="lux-panel rounded-[1.8rem] p-4">
                <div className="flex items-center justify-between">
                  <p className="lux-kicker">Move history</p>
                  {moveHistory.length > 0 && <span className="text-xs text-white/36">{moveHistory.length} moves</span>}
                </div>
                {pairedMoves.length === 0 ? (
                  <p className="mt-4 text-sm italic text-white/34">No moves yet.</p>
                ) : (
                  <div ref={historyContainerRef} className="mt-4 max-h-60 space-y-1 overflow-y-auto pr-1">
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
              </section>

              <section className="lux-panel rounded-[1.8rem] p-4">
                <p className="lux-kicker">Legend</p>
                <div className="mt-4 space-y-2">
                  {[
                    { style: { background: "rgba(99,102,241,0.55)" }, label: "Selected", round: false },
                    { style: { background: "radial-gradient(circle, rgba(99,102,241,0.55) 25%, transparent 26%)" }, label: "Legal move", round: true },
                    { style: { background: "radial-gradient(circle, transparent 60%, rgba(99,102,241,0.55) 61%)" }, label: "Capture", round: true },
                    { style: { background: "rgba(255,255,100,0.30)" }, label: "Last move", round: false },
                  ].map(({ style, label, round }) => (
                    <div key={label} className="flex items-center gap-3 text-sm text-white/56">
                      <span className={`h-4 w-4 shrink-0 ${round ? "rounded-full" : "rounded-sm"}`} style={style} />
                      {label}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {lobbyStatus === "finished" && (
            <section className="lux-panel rounded-[1.8rem] p-4">
              <div className={`rounded-[1.35rem] border px-4 py-5 text-center ${
                gameResult === "1/2-1/2"
                  ? "border-[rgba(124,130,255,0.28)] bg-[rgba(124,130,255,0.12)] text-[rgba(229,232,255,0.94)]"
                  : (gameResult === "1-0" && playerColor === "w") || (gameResult === "0-1" && playerColor === "b")
                    ? "border-[rgba(70,196,153,0.25)] bg-[rgba(70,196,153,0.12)] text-[rgba(189,246,227,0.94)]"
                    : "border-[rgba(242,125,125,0.24)] bg-[rgba(116,27,27,0.24)] text-[rgba(255,196,196,0.92)]"
              }`}>
                <p className="lux-display text-4xl">
                  {gameResult === "1/2-1/2"
                    ? "Draw"
                    : (gameResult === "1-0" && playerColor === "w") || (gameResult === "0-1" && playerColor === "b")
                      ? "Victory"
                      : "Defeat"}
                </p>
                <p className="mt-3 text-sm opacity-80">{statusText}</p>
              </div>

              {pairedMoves.length > 0 && (
                <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-[rgba(8,8,12,0.76)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/34">Final moves</p>
                  <div ref={historyContainerRef} className="mt-4 max-h-44 space-y-1 overflow-y-auto pr-1">
                    {pairedMoves.map(([white, black], idx) => (
                      <div key={idx} className="grid grid-cols-[34px_1fr_1fr] gap-2 rounded-[1rem] px-3 py-2 text-sm hover:bg-white/[0.04]">
                        <span className="font-mono text-white/32">{idx + 1}.</span>
                        <span className="font-mono text-white/82">{white}</span>
                        <span className="font-mono text-white/54">{black ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handlePlayAgain}
                className="lux-button-primary mt-4 w-full rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Play Again
              </button>
              <a
                href="/play"
                className="lux-button-muted mt-2 block w-full rounded-full px-5 py-3 text-center text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              >
                Back to Solo
              </a>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

