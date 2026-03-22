import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { extractToken, verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Game from "@/lib/models/Game";

function authenticate(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid game id." }, { status: 400 });
    }

    await connectDB();

    const game = await Game.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(user.userId),
    }).lean();

    if (!game) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    return NextResponse.json({ game }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/games/:id]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
