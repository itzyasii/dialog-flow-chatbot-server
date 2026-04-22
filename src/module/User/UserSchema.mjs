import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const UserSchema = new Schema(
  {
    externalId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["client", "server"],
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

const User = models.User || model("User", UserSchema);

export default User;
