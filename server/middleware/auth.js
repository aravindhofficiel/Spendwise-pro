/**
 * Authentication Middleware
 * Validates JWT tokens from HttpOnly cookies
 * Handles token verification and user attachment
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - Auth: ${message}`, data);
  }
};

/**
 * Error logger
 */
const ERROR_LOG = (message, error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - Auth: ${message}`, error);
};

/**
 * Middleware - Verify JWT token from cookie
 * Expects 'token' cookie set by login/register endpoints
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies.token;

    DEBUG_LOG('Authenticating request', {
      hasToken: !!token,
      path: req.path,
    });

    if (!token) {
      DEBUG_LOG('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    DEBUG_LOG('Token verified', { userId: decoded.id });

    // Get user from database (exclude password)
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      DEBUG_LOG('User not found for token', { userId: decoded.id });
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.',
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;

    DEBUG_LOG('User authenticated', { email: user.email });

    next();
  } catch (error) {
    ERROR_LOG('Authentication failed', error.message);

    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        code: 'INVALID_TOKEN',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please login.',
    });
  }
};

/**
 * Middleware - Optional authentication
 * Attaches user if token exists, but doesn't require it
 * Useful for public endpoints that need user context if available
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user) {
        req.user = user;
        req.userId = user._id;
        DEBUG_LOG('Optional auth - user attached', { email: user.email });
      }
    }

    next();
  } catch (error) {
    // Ignore errors - optional auth
    DEBUG_LOG('Optional auth failed, continuing without user');
    next();
  }
};

/**
 * Middleware - Check if user is active
 * Additional check after authentication
 */
export const requireActiveUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  // You could add additional checks here like:
  // - Check if user email is verified
  // - Check if user account is not banned
  // - Check subscription status

  next();
};

export default { authenticate, optionalAuth, requireActiveUser };
