import jwt from "jsonwebtoken";
import errorResponse from "../../utils/errorResponse.mjs";
// import User from "../../schemas/sql//User/User.mjs";
import { getCtx } from "../../utils/context.mjs";
import { logger } from "../../utils/logger.mjs";
import env from "../../config/env.mjs";

export const socketAuth = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1] ||
      socket.handshake.query?.token;

    if (!token) {
      logger.warn({
        event: "socket_auth_missing_token",
        path: socket.handshake.url,
        ...getCtx(),
      });
      return next(
        new errorResponse(
          "Not authorized to access this route, token missing",
          401,
        ),
      );
    }

    const decode = jwt.verify(token, env.JWT_SECRET);

    socket.user = decode.sub;

    next();
  } catch (err) {
    logger.error({
      event: "socket_auth_error",
      err,
      stack: err.stack,
      ...getCtx(),
    });
    return next(new errorResponse("socket authentication error", 401));
  }
};
