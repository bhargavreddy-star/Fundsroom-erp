/**
 * Global centralized error handler
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // PostgreSQL specific error code handling
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          success: false,
          message: err.detail || 'A duplicate record already exists with this unique identifier.',
          errorCode: 'DUPLICATE_RESOURCE',
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({
          success: false,
          message: err.detail || 'Referenced entity does not exist.',
          errorCode: 'FOREIGN_KEY_VIOLATION',
        });
      case '23514': // check_violation
        return res.status(400).json({
          success: false,
          message: err.message || 'Data integrity check constraint failed.',
          errorCode: 'CHECK_CONSTRAINT_VIOLATION',
        });
      case 'ECONNREFUSED':
        return res.status(503).json({
          success: false,
          message: 'Unable to connect to the PostgreSQL database. Please ensure the database service is running.',
          errorCode: 'DB_CONNECTION_REFUSED',
        });
    }
  }

  // Custom business logic errors with status codes
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred.';
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Route Not Found Handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint '${req.method} ${req.originalUrl}' not found.`,
    errorCode: 'NOT_FOUND',
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
