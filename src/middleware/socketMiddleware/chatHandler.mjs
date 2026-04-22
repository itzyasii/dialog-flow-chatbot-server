import { logger } from "../../utils/logger.mjs";
import { getCtx } from "../../utils/context.mjs";
import { isValidUUIDv4 } from "../../utils/validateUUID.mjs";
import errorResponse from "../../utils/errorResponse.mjs";
import { sendMessageSchema } from "../../module/Chat/chat.validation.mjs";
import {
  appendChatMessage,
  getOrCreateDirectChat,
} from "../../module/Chat/chat.service.mjs";

export const SOCKET_EVENTS = {
  ERROR: "socket:error",
  CHAT_JOIN: "chat:join",
  CHAT_JOINED: "chat:joined",
  CHAT_MESSAGE_SEND: "chat:message:send",
  CHAT_MESSAGE_CREATED: "chat:message:created",
};

const toStrId = (value) =>
  typeof value === "string" ? value.trim() : String(value ?? "").trim();

const safeParsePayload = (value) => {
  if (typeof value !== "string") {
    return value ?? {};
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new errorResponse("Invalid socket payload JSON", 400);
  }
};

const emitSocketError = (socket, event, error) => {
  socket.emit(SOCKET_EVENTS.ERROR, {
    event,
    message: error.message || "Socket error",
    code: error.code || "SOCKET_ERROR",
  });

  logger.error({
    event: "socket_chat_error",
    socketEvent: event,
    message: error.message,
    stack: error.stack,
    socketId: socket.id,
    userId: socket.user,
    ...getCtx(),
  });
};

export const emitChatMessageToUser = (io, userId, payload) => {
  if (!io || !userId) {
    return;
  }

  io.to(userId).emit(SOCKET_EVENTS.CHAT_MESSAGE_CREATED, payload);
};

export const roomHandler = async (_io, socket) => {
  socket.on(SOCKET_EVENTS.CHAT_JOIN, async (payload, ack) => {
    try {
      const parsedPayload = safeParsePayload(payload);
      const userId = toStrId(parsedPayload.userId || socket.user);

      if (!isValidUUIDv4(userId) || userId !== socket.user) {
        throw new errorResponse("Unauthorized room join", 401);
      }

      const { chat } = await getOrCreateDirectChat({
        clientExternalId: userId,
        profile: parsedPayload.profile || {},
      });

      socket.join(userId);

      const response = {
        roomId: userId,
        chatId: chat.id,
        sessionId: chat.sessionId,
        messages: chat.messages,
      };

      socket.emit(SOCKET_EVENTS.CHAT_JOINED, response);

      if (typeof ack === "function") {
        ack({ ok: true, data: response });
      }
    } catch (error) {
      emitSocketError(socket, SOCKET_EVENTS.CHAT_JOIN, error);
      if (typeof ack === "function") {
        ack({ ok: false, error: { message: error.message } });
      }
    }
  });
};

export const singleChatHandler = async (io, socket) => {
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE_SEND, async (payload, ack) => {
    try {
      const userId = toStrId(socket.user);
      if (!isValidUUIDv4(userId)) {
        throw new errorResponse("Unauthorized socket user", 401);
      }

      const parsedPayload = sendMessageSchema.parse(safeParsePayload(payload));
      const result = await appendChatMessage({
        clientExternalId: userId,
        senderRole: "client",
        text: parsedPayload.text,
        source: "socket",
        profile: parsedPayload.profile,
        metadata: parsedPayload.metadata,
      });

      const response = {
        chatId: result.chat.id,
        sessionId: result.sessionId,
        message: result.message,
      };

      emitChatMessageToUser(io, userId, response);

      if (typeof ack === "function") {
        ack({ ok: true, data: response });
      }
    } catch (error) {
      emitSocketError(socket, SOCKET_EVENTS.CHAT_MESSAGE_SEND, error);
      if (typeof ack === "function") {
        ack({ ok: false, error: { message: error.message } });
      }
    }
  });
};
