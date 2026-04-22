import multer from "multer";
import env from "../config/env.mjs";
import { getCtx } from "../utils/context.mjs";
import { logger } from "../utils/logger.mjs";

const formatSequelizeItems = (err) =>
  Array.isArray(err?.errors)
    ? err.errors.map((e) => ({
        field: e.path ?? null,
        message: e.message ?? "Validation failed",
        value: e.value,
        type: e.type,
        validatorKey: e.validatorKey,
      }))
    : [];

export const errorHandler = (err, req, res, next) => {
  // Defaults
  let status = err.status || 500;
  let message = err.message || err.code || "Internal Server Error";
  let data = err.data || {};

  // Log stack (only in dev ideally)
  if (env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    status = 404;
    message = `Resource not found with id ${err.value}`;
    data = { type: "CastError", value: err.value };
  }

  // Mongoose duplicate key
  if (err.code === 11000 || err.code === "DuplicateKey") {
    const keys = Object.keys(err.keyValue || {});
    const values = Object.values(err.keyValue || {});
    status = 400;
    // message = `Duplicate field value entered: ${keys.join(", ")} (${values.join(", ")})`;
    message =
      "A record with the same information already exists. Please try again with different values.";
    data = { type: "DuplicateKeyError", keys, values };
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((val) => val.message);
    const fields = Object.keys(err.errors || {});
    status = 400;
    message = messages.join(", ");
    data = { type: "MongooseDBValidationError", fields };
  }

  if (typeof err?.name === "string" && err.name.startsWith("Sequelize")) {
    const items = formatSequelizeItems(err);

    switch (err.name) {
      case "SequelizeValidationError": {
        status = 400;
        message = items.map((i) => i.message).join(", ") || "Validation failed";
        data = {
          type: "SequelizeValidationError",
          field: items[0]?.field ?? null,
          errors: items,
        };
        break;
      }

      case "SequelizeUniqueConstraintError": {
        status = 409; // conflict
        // Prefer a friendly message over raw DB text
        message =
          "A record with the same information already exists. Please try again with different values.";
        data = {
          type: "SequelizeUniqueConstraintError",
          errors: items,
          fields: items.map((i) => i.field).filter(Boolean),
        };
        break;
      }

      case "SequelizeForeignKeyConstraintError": {
        status = 409; // constraint conflict
        message =
          "This operation violates a relationship constraint. Check linked records and try again.";
        data = {
          type: "SequelizeForeignKeyConstraintError",
          table: err.table,
          fields: err.fields,
          index: err.index,
        };
        break;
      }

      case "SequelizeDatabaseError": {
        status = 400;
        message = "Database error. Please verify input and try again.";

        data = {
          type: "SequelizeDatabaseError",
          code: err?.parent?.code || err?.original?.code,
          errno: err?.parent?.errno || err?.original?.errno,
          sqlState: err?.parent?.sqlState || err?.original?.sqlState,
          sqlMessage: err?.parent?.sqlMessage || err?.original?.sqlMessage,
          message: err?.message,
          sql: err?.sql, // IMPORTANT: helps pinpoint missing column/table
        };

        break;
      }

      default: {
        // Generic Sequelize error
        status = err.status || 400;
        message = err.message || "Database error";
        data = {
          type: "SequelizeDatabaseError",
          code: err?.parent?.code || err?.original?.code,
          errno: err?.parent?.errno || err?.original?.errno,
          sqlState: err?.parent?.sqlState || err?.original?.sqlState,
          sqlMessage: err?.parent?.sqlMessage || err?.original?.sqlMessage,
          message: err?.message,
          sql: err?.sql, // IMPORTANT: helps pinpoint missing column/table
        };
      }
    }
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Invalid token";
    data = { type: "JsonWebTokenError" };
  }
  if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Token expired";
    data = { type: "TokenExpiredError" };
  }

  if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.message || "Upload failed";
    data = { type: "MulterError", code: err.code };
  }

  if (err.code && !data.type) {
    data = { ...data, type: "UploadError", code: err.code };
    if (!err.status) status = 400;
  }

  // Common FS errors (ENOENT, EACCES, EPERM)
  if (err.code === "ENOENT") {
    status = 400;
    message = "Upload directory does not exist on the server.";
    data = {
      ...data,
      type: "FsError",
      code: err.code,
      reason: "PATH_NOT_FOUND",
    };
  } else if (err.code === "EACCES") {
    status = 403;
    message =
      "The server does not have permission to write to the upload directory.";
    data = {
      ...data,
      type: "FsError",
      code: err.code,
      reason: "INSUFFICIENT_PERMISSIONS",
    };
  } else if (err.code === "EPERM") {
    status = 403;
    message = "Operation not permitted on the upload directory.";
    data = {
      ...data,
      type: "FsError",
      code: err.code,
      reason: "OPERATION_NOT_PERMITTED",
    };
  }

  // CORS callback errors
  if (message === "Blocked by CORS") {
    status = 403;
    data = { ...data, type: "CorsError", origin: req.headers.origin };
  }

  // Log once, centrally. Use level by status.
  const level = status >= 500 ? "error" : "warn";
  logger[level]({
    event: "http_error",
    status,
    name: err.name,
    message,
    code: err.code,
    path: req.originalUrl,
    method: req.method,
    dataType: data?.type,
    // stack only in non-prod
    stack: env.NODE_ENV !== "production" ? err.stack : undefined,
    ...getCtx(),
  });

  res.status(status).json({
    success: false,
    status,
    message,
    data,
  });
};
