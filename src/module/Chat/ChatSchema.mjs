import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const ChatMessageSchema = new Schema(
  {
    senderRole: {
      type: String,
      enum: ["client", "server"],
      required: true,
    },
    senderUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    source: {
      type: String,
      enum: ["socket", "webhook", "api"],
      default: "socket",
    },
    dialogflow: {
      intent: { type: String, trim: true },
      action: { type: String, trim: true },
      confidence: { type: Number, min: 0, max: 1 },
      responseId: { type: String, trim: true },
      session: { type: String, trim: true },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const ChatSchema = new Schema(
  {
    clientUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    serverUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

ChatSchema.index({ clientUser: 1, serverUser: 1 }, { unique: true });

const Chat = models.Chat || model("Chat", ChatSchema);

export default Chat;
