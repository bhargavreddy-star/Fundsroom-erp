const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware: Validates Bearer JWT Token
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
      errorCode: 'AUTH_TOKEN_MISSING',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_erp_2026');
    req.user = decoded; // { id, username, role, full_name }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please login again.',
        errorCode: 'AUTH_TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
      errorCode: 'AUTH_TOKEN_INVALID',
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} allowedRoles - Array or list of allowed roles ('ADMIN', 'SALES_USER')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User is not authenticated.',
        errorCode: 'UNAUTHENTICATED',
      });
    }

    // Flatten array arguments in case roles passed as an array
    const roles = allowedRoles.flat();

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to perform this operation. Required: [${roles.join(', ')}]`,
        errorCode: 'FORBIDDEN_INSUFFICIENT_ROLE',
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
