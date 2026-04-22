// Core / runtime
import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

// Config
import env from "./config/env.mjs";

// Utils
import { requestContext, getCtx } from "./utils/context.mjs";
import { logger } from "./utils/logger.mjs";

// Middleware
import securityMiddleware from "./middleware/securityMiddleware.mjs";
import { errorHandler } from "./middleware/errorMiddleware.mjs";
import requestLogger from "./middleware/requestLogger.mjs";

// Services

// ----------------------------------------------------------------------------
// Bootstrap
// ----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----------------------------------------------------------------------------
// Webhook (uses raw body; must come before any JSON/urlencoded parsers if added)
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Global Security / Context / Logging
// ----------------------------------------------------------------------------

// Most security middlewares (helmet/cors/rate limiting, etc.)
securityMiddleware(app);

// Per-request context (must be before requestLogger to enrich logs)
app.use(requestContext);

// Structured request logs
app.use(requestLogger);

// Lightweight health probe early
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export const server = http.createServer(app);

// ----------------------------------------------------------------------------
// Static Assets
// ----------------------------------------------------------------------------

// Public assets
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Error Handling
// ----------------------------------------------------------------------------

app.use(errorHandler);

export default app;
