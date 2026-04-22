import { logger } from "../utils/logger.mjs";
import { getCtx } from "../utils/context.mjs";

export default function logSlowQueries(thresholdMs = 200) {
  return function (schema) {
    // Query ops (find, findOne, update, delete, aggregate)
    schema.pre(/^find|count|update|delete|aggregate|findById|findOneAnd|insertMany/, function () {
      this._startAt = Date.now();
    });
    schema.post(/^find|count|update|delete|aggregate|findById|findOneAnd|insertMany/, function (docs) {
      const ms = Date.now() - (this._startAt || Date.now());

      // logger.debug({
      //   event: "db_query",
      //   model: this.model?.modelName,
      //   op: this.op,
      //   cond: this.getQuery?.(),
      //   options: this.getOptions?.(),
      //   count: Array.isArray(docs) ? docs.length : undefined,
      //   ms,
      //   ...getCtx(),
      // });

      if (ms > thresholdMs) {
        logger.warn({
          event: "db_slow_query",
          model: this.model?.modelName,
          op: this.op,
          cond: this.getQuery?.(),
          options: this.getOptions?.(),
          ms,
          ...getCtx(),
        });
      }
    });

    // Save hooks
    schema.pre("save", function () {
      this._startAt = Date.now();
    });
    schema.post("save", function (doc) {
      const ms = Date.now() - (this._startAt || Date.now());

      // logger.debug({
      //   event: "db_save",
      //   model: this.constructor?.modelName,
      //   id: doc?._id,
      //   data: doc?.toObject?.(),
      //   ms,
      //   ...getCtx(),
      // });

      if (ms > thresholdMs) {
        logger.warn({
          event: "db_slow_save",
          model: this.constructor?.modelName,
          id: this._id,
          ms,
          ...getCtx(),
        });
      }
    });
  };
}
