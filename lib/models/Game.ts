import mongoose, { Schema, Document, Model } from "mongoose";

export interface IGame extends Document {
  whitePlayer: string;
  blackPlayer: string;
  moves:       string[];
  result:      string;
  pgn:         string;
  userId:      mongoose.Types.ObjectId;
  playedAt:    Date;
}

const GameSchema = new Schema<IGame>(
  {
    whitePlayer: { type: String, required: true },
    blackPlayer: { type: String, required: true },
    moves:       { type: [String], default: [] },
    result:      { type: String, required: true, enum: ["1-0", "0-1", "1/2-1/2", "*"] },
    pgn:         { type: String, default: "" },
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    playedAt:    { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Game: Model<IGame> =
  mongoose.models.Game ?? mongoose.model<IGame>("Game", GameSchema);

export default Game;