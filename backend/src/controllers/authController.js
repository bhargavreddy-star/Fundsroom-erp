const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * User Login
 * Returns JWT token and sanitized user profile
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const result = await db.query(
      'SELECT id, username, password_hash, full_name, role FROM users WHERE username = $1',
      [username.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret_erp_2026', {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: payload,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated User Profile
 */
const getMe = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, username, full_name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (Client-side token disposal confirmation)
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please clear your authentication token.',
  });
};

module.exports = {
  login,
  getMe,
  logout,
};
