import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Game from "@/lib/models/Game";
import { verifyToken, extractToken } from "@/lib/auth";
import mongoose from "mongoose";

function authenticate(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { whitePlayer, blackPlayer, moves, result, pgn } =
      body as {
        whitePlayer?: string;
        blackPlayer?: string;
        moves?:       string[];
        result?:      string;
        pgn?:         string;
      };

    if (!whitePlayer || !blackPlayer || !result) {
      return NextResponse.json(
        { error: "whitePlayer, blackPlayer, and result are required." },
        { status: 400 }
      );
    }

    const validResults = ["1-0", "0-1", "1/2-1/2", "*"];
    if (!validResults.includes(result)) {
      return NextResponse.json({ error: "Invalid result value." }, { status: 400 });
    }

    await connectDB();

    const game = await Game.create({
      whitePlayer,
      blackPlayer,
      moves:  moves  ?? [],
      result,
      pgn:   pgn    ?? "",
      userId: new mongoose.Types.ObjectId(user.userId),
    });

    return NextResponse.json({ message: "Game saved.", game }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/games]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
    const skip  = (page - 1) * limit;

    const [games, total] = await Promise.all([
      Game.find({ userId: new mongoose.Types.ObjectId(user.userId) })
        .sort({ playedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Game.countDocuments({ userId: new mongoose.Types.ObjectId(user.userId) }),
    ]);

    return NextResponse.json(
      { games, total, page, pages: Math.ceil(total / limit) },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/games]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}