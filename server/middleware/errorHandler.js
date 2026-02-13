/**
 * Centralized Error Handler Middleware
 * Handles all errors in one place with proper logging
 */

import mongoose from 'mongoose';

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - ErrorHandler: ${message}`, data);
  }
};

/**
 * Error logger - Logs errors with appropriate detail level
 */
const ERROR_LOG = (message, error) => {
  const logData = {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    name: error.name,
  };
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}:`, logData);
};

/**
 * Custom Application Error Class
 * Allows structured error responses
 */
export class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true; // Known errors vs programming errors

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware - Handle Mongoose validation errors
 */
const handleValidationError = (error) => {
  const messages = Object.values(error.errors).map((err) => err.message);
  const message = messages.join('. ');
  
  DEBUG_LOG('Mongoose validation error', { errors: messages });

  return new AppError(message, 400, 'VALIDATION_ERROR');
};

/**
 * Middleware - Handle Mongoose duplicate key errors
 */
const handleDuplicateKeyError = (error) => {
  // Extract field name from error message
  const field = error.message.match(/index: (\w+)/)?.[1] || 'field';
  const message = `A record with this ${field} already exists.`;

  DEBUG_LOG('Duplicate key error', { field });

  return new AppError(message, 400, 'DUPLICATE_KEY');
};

/**
 * Middleware - Handle Mongoose Cast errors (invalid ObjectId)
 */
const handleCastError = (error) => {
  const message = 'Invalid resource ID provided.';

  DEBUG_LOG('Cast error', { error: error.message });

  return new AppError(message, 400, 'INVALID_ID');
};

/**
 * Middleware - Handle JWT errors
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please login again.', 401, 'INVALID_TOKEN');
};

/**
 * Middleware - Handle JWT expiration
 */
const handleJWTExpiration = () => {
  return new AppError('Session expired. Please login again.', 401, 'TOKEN_EXPIRED');
};

/**
 * Main Error Handler Middleware
 * Processes all errors and sends appropriate response
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  DEBUG_LOG('Processing error', {
    path: req.path,
    method: req.method,
    statusCode: err.statusCode,
  });

  // Log the error
  ERROR_LOG('Request error', err);

  // Handle Mongoose-specific errors
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiration();
  }

  // Send error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    code: error.code || 'SERVER_ERROR',
    // Include stack trace only in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async Handler Wrapper
 * Catches async errors and passes to error handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Handler - Catch undefined routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

export default {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  AppError,
};
