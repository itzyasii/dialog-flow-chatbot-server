import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketMiddleware/socketAuth.mjs";
import { registerSocketHandler } from "../middleware/socketMiddleware/socketWrapper.mjs";
import { logger } from "../utils/logger.mjs";
import { getCtx } from "../utils/context.mjs";

let ioInstance = null;
export const onlineUsers = new Map(); // userId -> Set(socketId)

const SOCKET_ERROR_EVENT = "socket:error";

// Prevent double-flush when multiple sockets for same user disconnect around same time
const flushInFlight = new Map(); // userId -> Promise

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => {
  if (!ioInstance) throw new Error("Socket.IO not initialized yet");
  return ioInstance;
};

const toUserId = (v) =>
  typeof v === "string" ? v.trim() : String(v ?? "").trim();

const safeEmit = (socket, event, payload) => {
  try {
    socket.emit(event, payload);
  } catch {
    // ignore
  }
};

const trackOnline = ({ userId, socketId }) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

const untrackOnline = ({ userId, socketId }) => {
  const set = onlineUsers.get(userId);
  if (!set) return { removedUser: false, remaining: 0 };
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return { removedUser: true, remaining: 0 };
  }
  return { removedUser: false, remaining: set.size };
};

export const initSocket = (server) => {
  let io;

  try {
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },

      // Production-friendly defaults (adjust as needed)
      serveClient: false,
      transports: ["websocket", "polling"],
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    setIO(io);

    // Auth middleware
    io.use(async (socket, next) => {
      try {
        await socketAuth(socket, next);
      } catch (err) {
        logger.warn({
          event: "SOCKET_AUTH_MIDDLEWARE_ERROR",
          err,
          stack: err?.stack,
          socketId: socket?.id,
          ...getCtx(),
        });
        next(err);
      }
    });

    io.on("connection", async (socket) => {
      const userId = toUserId(socket.user);

      // Hard guard: don’t run handlers if auth didn’t populate user
      if (!userId) {
        logger.warn({
          event: "SOCKET_CONNECTED_WITHOUT_USER",
          socketId: socket.id,
          ...getCtx(),
        });
        safeEmit(socket, SOCKET_ERROR_EVENT, {
          code: "UNAUTHORIZED",
          message: "Unauthorized socket connection",
        });
        // Disconnect quickly; avoid leaving a zombie socket
        try {
          socket.disconnect(true);
        } catch {}
        return;
      }

      try {
        logger.info({
          event: "USER_CONNECTED",
          userId,
          socketId: socket.id,
          transport: socket.conn?.transport?.name,
          ...getCtx(),
        });

        // Join personal room for direct messages
        socket.join(userId);

        // Track multi-socket connections per user
        trackOnline({ userId, socketId: socket.id });

        // Register all socket handlers safely
        await registerSocketHandler(io, socket, onlineUsers);

        // Prefer "disconnecting" to access rooms etc. before leave
        socket.on("disconnecting", (reason) => {
          logger.info({
            event: "SOCKET_DISCONNECTING",
            userId,
            socketId: socket.id,
            reason,
            ...getCtx(),
          });
        });

        socket.on("disconnect", async (reason) => {
          try {
            const { removedUser, remaining } = untrackOnline({
              userId,
              socketId: socket.id,
            });

            logger.info({
              event: "SOCKET_DISCONNECTED",
              userId,
              socketId: socket.id,
              reason,
              remainingSocketsForUser: remaining,
              ...getCtx(),
            });

            if (removedUser) {
              logger.info({
                event: "USER_OFFLINE",
                userId,
                ...getCtx(),
              });

              logger.info({
                event: "ONLINE_USERS_UPDATED",
                count: onlineUsers.size,
                users: Array.from(onlineUsers.keys()),
                ...getCtx(),
              });
            }
          } catch (err) {
            logger.error({
              event: "SOCKET_DISCONNECT_ERROR",
              userId,
              socketId: socket.id,
              err,
              stack: err?.stack,
              ...getCtx(),
            });
          }
        });

        // surface socket-level errors
        socket.on("error", (err) => {
          logger.warn({
            event: "SOCKET_NATIVE_ERROR_EVENT",
            userId,
            socketId: socket.id,
            err,
            ...getCtx(),
          });
        });
      } catch (err) {
        logger.error({
          event: "SOCKET_CONNECTION_ERROR",
          userId,
          socketId: socket.id,
          err,
          stack: err?.stack,
          ...getCtx(),
        });

        safeEmit(socket, SOCKET_ERROR_EVENT, {
          code: "SOCKET_CONNECTION_ERROR",
          message: "Socket connection error",
        });

        try {
          socket.disconnect(true);
        } catch {}
      }
    });
  } catch (err) {
    logger.error({
      event: "SOCKET_INIT_ERROR",
      err,
      stack: err?.stack,
      ...getCtx(),
    });
  }

  if (!io) {
    logger.fatal({
      event: "SOCKET_NOT_INITIALIZED",
      message: "Socket.io failed to initialize",
      ...getCtx(),
    });
    return null;
  }

  return io;
};
