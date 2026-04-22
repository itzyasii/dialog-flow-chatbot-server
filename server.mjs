import env from "./src/config/env.mjs";
import { initMongoose } from "./src/config/mongoose.mjs";
import { logger } from "./src/utils/logger.mjs";
import { initSocket } from "./src/config/socket.mjs";
import app, { server } from "./src/app.mjs";

try {
  const io = initSocket(server);
  app.set("io", io);
} catch (error) {
  logger.error({
    event: "Socket initialization error",
    reason: error.message,
    stack: error.stack,
  });
}

await initMongoose();

process.on("unhandledRejection", (reason) => {
  logger.error({ event: "unhandled_rejection", reason });
});

process.on("uncaughtException", (err) => {
  logger.fatal({ event: "uncaught_exception", err, stack: err.stack });
  process.exit(1);
});

server.listen(env.PORT || 5000, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
