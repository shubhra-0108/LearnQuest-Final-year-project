import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../config.js';

export function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    logger.error('Unhandled Server Error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  res.status(status).json({
    error: message,
    status,
    ...(err.details ? { details: err.details } : {}),
    ...(!isProd && err.stack ? { stack: err.stack } : {}),
  });
}
