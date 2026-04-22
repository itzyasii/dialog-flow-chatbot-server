import { logger } from "../utils/logger.mjs";
import { getCtx } from "../utils/context.mjs";

export default function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;

  logger.info({ event: "request_start", method, url: originalUrl, ...getCtx() });

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({
      event: "request_end",
      method,
      url: originalUrl,
      status: res.statusCode,
      ms: Math.round(ms),
      contentLength: res.getHeader("content-length"),
      ...getCtx(),
    });
  });

  next();
}
