class AppError extends Error {
   constructor(status, code, message, details, { retryable = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  if (err instanceof AppError) {
    req.log.warn({ code: err.code, details: err.details }, err.message);
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  req.log.error({ err }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };