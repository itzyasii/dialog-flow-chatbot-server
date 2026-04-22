import { logger } from "../../utils/logger.mjs";
import { getCtx } from "../../utils/context.mjs";

const SOCKET_ERROR_EVENT = "socket:error"; // prefer a namespaced error event

// Track registrations per socket to avoid double-binding listeners
const REGISTERED = Symbol("handlers_registered");

const safeEmitInitError = (socket, err, meta = {}) => {
  try {
    socket.emit(SOCKET_ERROR_EVENT, {
      message: "Socket initialization error",
      code: "SOCKET_INIT_ERROR",
      detail: err?.message || "Unknown error during handler setup",
      ...meta,
    });
  } catch {
    // ignore emit failures
  }
};

const runSafely = async ({ name, fn, socket }) => {
  try {
    await fn();
    return { name, ok: true };
  } catch (err) {
    logger.error({
      event: "SOCKET_HANDLER_REGISTRATION_ERROR",
      handler: name,
      message: "Failed to register socket handler",
      err,
      stack: err?.stack,
      socketId: socket?.id,
      userId: socket?.user,
      ...getCtx(),
    });

    safeEmitInitError(socket, err, { handler: name });
    return { name, ok: false, err };
  }
};

export const registerSocketHandler = async (io, socket, onlineUsers) => {
  // Prevent double-registration
  if (socket[REGISTERED]) {
    logger.warn({
      event: "SOCKET_HANDLER_ALREADY_REGISTERED",
      socketId: socket?.id,
      userId: socket?.user,
      ...getCtx(),
    });
    return;
  }
  socket[REGISTERED] = true;

  // Register event listeners
  const registrations = [
    { name: "roomHandler", fn: () => roomHandler(io, socket, onlineUsers) },
  ];

  const results = await Promise.all(
    registrations.map((h) => runSafely({ name: h.name, fn: h.fn, socket })),
  );

  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  if (failed.length) {
    logger.warn({
      event: "SOCKET_HANDLER_REGISTRATION_PARTIAL",
      message: "Some socket handlers failed to register",
      failed,
      socketId: socket?.id,
      userId: socket?.user,
      ...getCtx(),
    });
  }

  // Optional: log success state
  logger.info({
    event: "SOCKET_HANDLERS_REGISTERED",
    socketId: socket?.id,
    userId: socket?.user,
    registered: results.filter((r) => r.ok).map((r) => r.name),
    failed,
    ...getCtx(),
  });
};
