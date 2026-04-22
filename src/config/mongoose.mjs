import mongoose from "mongoose";
import env from "./env.mjs";
import logSlowQueries from "./logSlowQueries.mjs";
import { logger } from "../utils/logger.mjs";

mongoose.plugin(logSlowQueries(Number(env.SLOW_QUERY_MS || 200)));
export async function initMongoose() {
  mongoose.set("strictQuery", true);

  try {
    if (!env.MONGO_URI) {
      throw new Error(
        "MongoDB connection string is missing. Set MONGO_URI or MONGODB_URI in your .env file.",
      );
    }

    await mongoose.connect(env.MONGO_URI, {
      autoIndex: env.NODE_ENV === "development" ? true : false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info("[mongoose_connected] MongoDB connection established");
  } catch (err) {
    logger.error({
      event: "mongoose_connection_failed",
      error: err.message,
      stack: err.stack,
      message: "MongoDB failed to connect. Retrying in 5 seconds...",
    });
    if (env.NODE_ENV !== "production") {
      setTimeout(initMongoose, 5000);
    } else {
      process.exit(1);
    }
  }
}

// Handle process termination and close the connection gracefully
const handleExit = (signal) => {
  logger.info(
    "[mongoose_connection_close] Received %s. Closing MongoDB connection...",
    signal,
  );
  mongoose.connection
    .close()
    .then(() => {
      logger.info(
        "[mongoose_connection_closed] MongoDB connection closed. Process exiting...",
      );
      process.exit(0);
    })
    .catch((err) => {
      logger.error({
        event: "mongoose_connection_close_error",
        error: err.message,
        stack: err.stack,
        message:
          "Error closing MongoDB connection. Process exiting with error...",
      });
      process.exit(1);
    });
};

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
