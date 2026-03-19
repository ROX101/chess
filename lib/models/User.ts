import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  email:     string;
  password:  string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;