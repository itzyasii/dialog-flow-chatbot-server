import pino from "pino";
import env from "../config/env.mjs";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: {
    service: "api",
    env: env.NODE_ENV,
    commit: env.COMMIT_SHA, // optional
  },
  // Never keep secrets/PII in logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "req.body.password",
      "req.body.resetToken",
      "token",
      "otp",
      "verification_code",
      "reset_password_token",
    ],
    remove: true,
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined,
  serializers: { err: pino.stdSerializers.err },
  timestamp: pino.stdTimeFunctions.isoTime,
});
