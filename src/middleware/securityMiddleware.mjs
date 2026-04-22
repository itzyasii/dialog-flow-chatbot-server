import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { getCtx } from "../utils/context.mjs";
import { logger } from "../utils/logger.mjs";
import env from "../config/env.mjs";
// import swaggerDocs from "../config/swaggerConfig.mjs";

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = "http://localhost:3000";

    // Allow same-origin/no-origin (mobile apps, curl) and dev
    if (!origin || env.NODE_ENV === "development") {
      return callback(null, true);
    }

    const allowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return origin === allowed;
    });

    if (allowed) {
      return callback(null, true);
    } else {
      // Log blocked origin for diagnostics
      logger.warn({ event: "cors_blocked", origin, ...getCtx() });
      return callback(new Error("Blocked by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "ngrok-skip-browser-warning",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

const customSanitizerMiddleware = (req, res, next) => {
  const sanitize = mongoSanitize.sanitize;
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  next();
};

const securityMiddleware = (app) => {
  // 1. CORS FIRST - Handle preflight requests early
  app.use(cors(corsOptions));

  // Cookie parser – so req.cookies is populated
  app.use(cookieParser());

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://cdnjs.cloudflare.com",
            "'strict-dynamic'",
          ], // Removed 'unsafe-inline'
          styleSrc: ["'self'", "https://fonts.googleapis.com"], // Removed 'unsafe-inline'
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", process.env.IMAGE_BASE_URL],
          connectSrc: [
            "'self'",
            "http://localhost:5000",
            "http://192.168.18.235:5000",
            "https://192.168.18.235:5000",
            "https://hippo-sure-firstly.ngrok-free.app/",
            "https://selectable-deandra-earless.ngrok-free.dev",
            "https://*.ngrok-free.app",
          ],
          upgradeInsecureRequests: [], // Ensure all requests are made over HTTPS
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin" }, // Added to mitigate cross-origin vulnerabilities
      referrerPolicy: { policy: "strict-origin" }, // Added to control referrer information
    }),
  );

  // 3. Body Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    // Grab the existing property descriptor for req.query…
    const descriptor = Object.getOwnPropertyDescriptor(req, "query");
    Object.defineProperty(req, "query", {
      ...descriptor,
      value: req.query, // keep the current value
      writable: true, // now allow reassignment
    });
    next();
  });

  // 4. Data Sanitization (After body parsers!)
  app.use(customSanitizerMiddleware);

  // 5. HTTP Parameter Pollution
  app.use(hpp({ whitelist: ["category", "price"] }));

  // 6. Trust proxy when using ngrok or production
  app.set("trust proxy", 1);

  // 7. Rate Limiting (Last security layer)
  app.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 10000 }));

  // 8. Swagger UI
  // if (process.env.NODE_ENV !== "production") {
  //   swaggerDocs(app);
  // }
};

export default securityMiddleware;
