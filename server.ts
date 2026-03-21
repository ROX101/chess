import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app  = next({ dev });
const handle = app.getRequestHandler();

// ── Game room state ───────────────────────────────────────────────────────────

interface GameRoom {
  players: string[];
  fen:     string;
  turn:    "w" | "b";
  moves:   string[];
  status:  "waiting" | "playing" | "finished";
}

const rooms = new Map<string, GameRoom>();

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findWaitingRoom(): string | null {
  for (const [id, room] of rooms.entries()) {
    if (room.status === "waiting" && room.players.length === 1) return id;
  }
  return null;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin:  "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── Join matchmaking ──────────────────────────────────────────────────────
    socket.on("joinGame", (preferredRoomId?: string) => {
      let roomId: string;

      if (preferredRoomId && rooms.has(preferredRoomId)) {
        const room = rooms.get(preferredRoomId)!;
        if (room.status === "waiting" && room.players.length === 1) {
          roomId = preferredRoomId;
        } else {
          socket.emit("roomError", "Room is full or already started.");
          return;
        }
      } else {
        const existing = findWaitingRoom();
        if (existing) {
          roomId = existing;
        } else {
          roomId = generateRoomId();
          rooms.set(roomId, {
            players: [],
            fen:     "start",
            turn:    "w",
            moves:   [],
            status:  "waiting",
          });
        }
      }

      const room = rooms.get(roomId)!;
      room.players.push(socket.id);
      socket.join(roomId);

      const color = room.players.length === 1 ? "w" : "b";
      socket.emit("assignColor", { color, roomId });
      console.log(`[socket] ${socket.id} joined room ${roomId} as ${color}`);

      if (room.players.length === 2) {
        room.status = "playing";
        io.to(roomId).emit("gameStart", {
          roomId,
          fen:   room.fen,
          turn:  room.turn,
          white: room.players[0],
          black: room.players[1],
        });
        console.log(`[socket] game started in room ${roomId}`);
      } else {
        socket.emit("waitingForOpponent", { roomId });
      }
    });

    // ── Player makes a move ───────────────────────────────────────────────────
    socket.on("makeMove", ({ roomId, move, fen, turn }: {
      roomId: string;
      move:   string;
      fen:    string;
      turn:   "w" | "b";
    }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== "playing") return;

      const expectedSocketId = turn === "w" ? room.players[0] : room.players[1];
      if (socket.id !== expectedSocketId) return;

      room.fen  = fen;
      room.turn = turn === "w" ? "b" : "w";
      room.moves.push(move);

      socket.to(roomId).emit("opponentMove", { move, fen, turn: room.turn });
      console.log(`[socket] move ${move} in room ${roomId}`);
    });

    // ── Game over ─────────────────────────────────────────────────────────────
    socket.on("gameOver", ({ roomId, result }: {
      roomId: string;
      result: string;
    }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.status = "finished";
      io.to(roomId).emit("gameEnded", { result });
      console.log(`[socket] game over in room ${roomId}: ${result}`);
    });

    // ── Draw ──────────────────────────────────────────────────────────────────
    socket.on("offerDraw", ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit("drawOffered");
    });

    socket.on("acceptDraw", ({ roomId }: { roomId: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.status = "finished";
      io.to(roomId).emit("gameEnded", { result: "1/2-1/2" });
    });

    socket.on("declineDraw", ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit("drawDeclined");
    });

    // ── Resign ────────────────────────────────────────────────────────────────
    socket.on("resign", ({ roomId, color }: {
      roomId: string;
      color:  "w" | "b";
    }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.status = "finished";
      const result = color === "w" ? "0-1" : "1-0";
      io.to(roomId).emit("gameEnded", { result, reason: "resignation" });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      for (const [roomId, room] of rooms.entries()) {
        if (room.players.includes(socket.id)) {
          if (room.status === "playing") {
            room.status = "finished";
            socket.to(roomId).emit("opponentDisconnected");
          }
          setTimeout(() => { rooms.delete(roomId); }, 30000);
          break;
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});