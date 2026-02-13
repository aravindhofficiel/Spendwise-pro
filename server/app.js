/**
 * Express Application Setup
 * Main app configuration with all middleware and routes
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xssClean from 'xss-clean';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - App: ${message}`, data);
  }
};

// Initialize Express app
const app = express();

/**
 * Security Middleware Configuration
 */

// Helmet - Set security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable for development
}));

// CORS - Allow cross-origin requests with credentials
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
 allowedHeaders: [
  'Content-Type',
  'Authorization',
  'Refresh-Token',
  'X-Requested-With'
],
};

app.use(cors(corsOptions));

// Body parser - Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10kb' })); // Limit body size for security
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser - Parse cookies from headers
app.use(cookieParser());

// MongoDB Sanitize - Prevent NoSQL injection
app.use(mongoSanitize());

// XSS Clean - Prevent XSS attacks
app.use(xssClean());

/**
 * Rate Limiting Configuration
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
// app.use('/api', limiter);
if (process.env.NODE_ENV === 'production') {
  app.use('/api', limiter);
}

// Stricter rate limit for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

// app.use('/api/auth/login', authLimiter);
// app.use('/api/auth/register', authLimiter);
if (process.env.NODE_ENV === 'production') {
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}


/**
 * API Routes
 */

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SpendWise Pro API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount expense routes
app.use('/api/expenses', expenseRoutes);

/**
 * Error Handling
 */

// 404 handler for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

// Debug: Log all requests in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    DEBUG_LOG(`${req.method} ${req.path}`, {
      query: req.query,
      body: req.body ? Object.keys(req.body) : undefined, // Don't log sensitive data
    });
    next();
  });
}

export default app;
