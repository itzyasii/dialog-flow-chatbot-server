import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const als = new AsyncLocalStorage();

export const getCtx = () => als.getStore() || {};

/** Attach request-scoped context (requestId, ip, ua) */
export function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || randomUUID();
  const ctx = {
    requestId,
    ip: req.ip,
    ua: req.get('user-agent'),
  };

  als.run(ctx, () => {
    res.setHeader('x-request-id', requestId);
    next();
  });
}

/** Add/override context later (e.g., after auth) */
export function bindToContext(patch = {}) {
  const store = als.getStore();
  if (store) Object.assign(store, patch);
}
