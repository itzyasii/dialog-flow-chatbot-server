import { logger } from "../../utils/logger.mjs";
import { getCtx } from "../../utils/context.mjs";

import { isValidUUIDv4, isValidObjectId } from "../../utils/validateUUID.mjs";
// ---------------------------------------------
// Config / helpers
// ---------------------------------------------

const EVENTS = {
  ERROR: "socket:error",
  PRIVATE: {
    SEND: "private-message:send",
    RECEIVE: "private-message:receive",
    SEEN: "private-message:seen",
    SEEN_ACK: "private-message:seen-ack",
    EDIT: "private-message:edit",
    EDITED: "private-message:edited",
    DELETE: "private-message:delete",
    DELETED: "private-message:deleted",
    REACT: "private-message:react",
    REACTION_UPDATE: "private-message:reaction:update",
    DELIVERED: "private-message:delivered",
    DELIVERED_ACK: "private-message:delivered-ack",
  },
  ROOM: {
    JOIN_ROOM: "join-room",
    JOIN_PRIVATE_ROOM: "join-private-room",
    PRIVATE_JOINED: "private-room-joined",
  },
};

const LIMITS = {
  MESSAGE_TEXT_MAX: 5000,
  REACTION_MAX: 32,
};

class ClientError extends Error {
  constructor(message, code = "BAD_REQUEST", status = 400, details) {
    super(message);
    this.name = "ClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const toStrId = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  // ObjectId / other objects:
  if (typeof v === "object" && typeof v.toString === "function") {
    return String(v.toString()).trim();
  }
  return String(v).trim();
};

const safeJsonParse = (v) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      throw new ClientError("Invalid JSON payload", "INVALID_JSON", 400);
    }
  }
  return v;
};

const requireAuth = (socket) => {
  const userId = toStrId(socket?.user);
  if (!isValidUUIDv4(userId))
    throw new ClientError("Unauthorized", "UNAUTHORIZED", 401);
  return userId;
};

const emitError = (socket, err, meta = {}) => {
  const isClient = err instanceof ClientError;

  // User-facing error (don’t leak stack)
  socket.emit(EVENTS.ERROR, {
    message: isClient ? err.message : "Something went wrong",
    code: isClient ? err.code : "INTERNAL_ERROR",
    ...(isClient && err.details ? { details: err.details } : {}),
    ...meta,
  });

  // Server logs (full context)
  logger.error({
    event: meta.event || "socket_error",
    code: isClient ? err.code : "INTERNAL_ERROR",
    message: err?.message,
    err,
    stack: err?.stack,
    ...getCtx(),
  });
};

const onSafe = (socket, event, { validator, handler }) => {
  socket.on(event, async (payload, ack) => {
    const hasAck = typeof ack === "function";
    try {
      const userId = requireAuth(socket);

      const raw = safeJsonParse(payload);
      const clean = validator ? validator(raw) : raw;

      const result = await handler(clean, { userId });
      if (hasAck) ack({ ok: true, data: result ?? null });
    } catch (err) {
      emitError(socket, err, { event, ...(isPlainObject(payload) ? {} : {}) });
      if (typeof ack === "function") {
        const isClient = err instanceof ClientError;
        ack({
          ok: false,
          error: {
            message: isClient ? err.message : "Something went wrong",
            code: isClient ? err.code : "INTERNAL_ERROR",
          },
        });
      }
    }
  });
};

// Validators (minimal but strict)
const vJoinPrivateRoom = (p) => {
  if (!isPlainObject(p)) throw new ClientError("Payload must be an object");
  const userId = toStrId(p.userId);
  if (!isValidUUIDv4(userId)) throw new ClientError("userId is required");
  return { userId };
};

const vPrivateSend = (p) => {
  if (!isPlainObject(p)) throw new ClientError("Payload must be an object");
  const chatId = toStrId(p.chatId);
  const receiverId = toStrId(p.receiverId);
  const message = typeof p.message === "string" ? p.message.trim() : p.message;

  if (!isValidUUIDv4(receiverId))
    throw new ClientError("receiverId is required");
  if (typeof message !== "string" || !message)
    throw new ClientError("message is required");
  if (message.length > LIMITS.MESSAGE_TEXT_MAX)
    throw new ClientError("message too long", "MESSAGE_TOO_LONG", 400, {
      max: LIMITS.MESSAGE_TEXT_MAX,
    });

  return { chatId, receiverId, message };
};

const vPrivateSeen = (p) => {
  if (!isPlainObject(p)) throw new ClientError("Payload must be an object");
  const chatId = toStrId(p.chatId);
  const receiverId = toStrId(p.receiverId);
  if (!isValidUUIDv4(receiverId))
    throw new ClientError("receiverId is required");
  return { chatId, receiverId };
};

const vPrivateDelete = (p) => {
  if (!isPlainObject(p)) throw new ClientError("Payload must be an object");
  const messageId = toStrId(p.messageId);
  const receiverId = toStrId(p.receiverId);
  if (!isValidObjectId(messageId))
    throw new ClientError("messageId is required");
  if (!isValidUUIDv4(receiverId))
    throw new ClientError("receiverId is required");
  return { messageId, receiverId };
};

const vPrivateEdit = (p) => {
  if (!isPlainObject(p)) throw new ClientError("Payload must be an object");
  const receiverId = toStrId(p.receiverId);
  const messageId = toStrId(p.messageId);
  const updatedMessage =
    typeof p.updatedMessage === "string"
      ? p.updatedMessage.trim()
      : p.updatedMessage;
  if (!isValidUUIDv4(receiverId))
    throw new ClientError("receiverId is required");
  if (!isValidObjectId(messageId))
    throw new ClientError("messageId is required");
  if (!updatedMessage) throw new ClientError("updatedMessage is required");
  return { receiverId, messageId, updatedMessage };
};

// ROOM HANDLER
export const roomHandler = async (io, socket, onlineUsers) => {
  onSafe(socket, EVENTS.ROOM.JOIN_PRIVATE_ROOM, {
    validator: vJoinPrivateRoom,
    handler: async ({ userId }) => {
      socket.join(userId);
      socket.emit(EVENTS.ROOM.PRIVATE_JOINED, { roomId: userId });
      return { roomId: userId };
    },
  });
};

// SINGLE CHAT HANDLER
export const singleChatHandler = async (io, socket) => {
  onSafe(socket, EVENTS.PRIVATE.SEND, {
    validator: vPrivateSend,
    handler: async (
      { chatId: _chatId, receiverId, message },
      { userId: senderId },
    ) => {
      let chatId = _chatId;
      if (!chatId) {
        const chat = await checkExistingChatORCreate(senderId, receiverId);
        chatId = chat._id;
      }
      const saved = await createSingleMessageService(
        senderId,
        receiverId,
        message,
      );

      const messageData = saved?.data?.message ?? saved?.message ?? saved;
      if (!messageData) {
        throw new Error("createSingleMessageService returned no message");
      }

      io.to(receiverId).emit(EVENTS.PRIVATE.RECEIVE, { message: messageData });
      // unread count update could be handled here
      const isOnline =
        (io.sockets.adapter.rooms.get(receiverId)?.size || 0) > 0;
      if (!isOnline) {
        return { message: messageData };
      }

      const delivered = await markMessageDeliveredService(
        saved?.data?.message?.id,
      );
      if (!delivered) {
        throw new Error("markMessageDeliveredService returned no message");
      }
      io.to(senderId).emit(EVENTS.PRIVATE.DELIVERED_ACK, {
        chatId: delivered.data.chatId,
        messageId: delivered.data.id,
        deliveredAt: delivered.data.deliveredAt,
      });
    },
  });

  onSafe(socket, EVENTS.PRIVATE.SEEN, {
    validator: vPrivateSeen,
    handler: async ({ chatId, receiverId }, { userId }) => {
      await markMessageSeenService(chatId, userId);

      const seenAt = Date.now();
      io.to(receiverId).emit(EVENTS.PRIVATE.SEEN_ACK, { chatId, seenAt });
      // unread count update could be handled here 0
      return { chatId, seenAt };
    },
  });

  onSafe(socket, EVENTS.PRIVATE.EDIT, {
    validator: vPrivateEdit,
    handler: async ({ receiverId, messageId, updatedMessage }, { userId }) => {
      await updateChatMessageService(userId, messageId, {
        message: updatedMessage,
      });
      io.to(userId).emit(EVENTS.PRIVATE.EDITED, { messageId, updatedMessage }); // notify self
      io.to(receiverId).emit(EVENTS.PRIVATE.EDITED, {
        messageId,
        updatedMessage,
      });
      return { messageId, updatedMessage };
    },
  });

  onSafe(socket, EVENTS.PRIVATE.DELETE, {
    validator: vPrivateDelete,
    handler: async ({ messageId, receiverId }, { userId }) => {
      await deleteChatMessageService(messageId, userId);
      io.to(receiverId).emit(EVENTS.PRIVATE.DELETED, { messageId });
      return { messageId };
    },
  });

  onSafe(socket, EVENTS.PRIVATE.REACT, {
    validator: (p) => {
      const r = vReaction(p);
      const receiverId = toStrId(r.receiverId);
      if (!receiverId) throw new ClientError("receiverId is required");
      return { ...r, receiverId };
    },
    handler: async (
      { receiverId, messageType, messageId, reaction },
      { userId },
    ) => {
      await createMessageReactionService(
        userId,
        messageType,
        messageId,
        reaction,
      );

      io.to(receiverId).emit(EVENTS.PRIVATE.REACTION_UPDATE, {
        messageId,
        userId,
        reaction,
      });

      return { messageId };
    },
  });
};
