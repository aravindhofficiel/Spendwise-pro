/**
 * Authentication Controller
 * Handles user registration, login, logout, and token refresh
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - AuthController: ${message}`, data);
  }
};

const ERROR_LOG = (message, error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - AuthController: ${message}`, error);
};

/**
 * Generate JWT Access Token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

/**
 * Generate JWT Refresh Token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

/**
 * Send token response with cookies
 */
const sendTokenResponse = async (user, statusCode, refreshToken, req, res) => {
  // Generate access token
  const accessToken = generateAccessToken(user._id);

  // Calculate cookie expiration
  const accessTokenExpiry = new Date(
    Date.now() + parseInt(process.env.JWT_EXPIRE_MINUTES || '15') * 60 * 1000
  );

  const isProduction = process.env.NODE_ENV === 'production';

  // Cookie options
  const cookieOptions = {
    expires: accessTokenExpiry,
    httpOnly: true, // Critical for security - prevents XSS
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // CSRF protection
  };

  DEBUG_LOG('Sending token response', {
    userId: user._id,
    isProduction,
  });

  // Save refresh token to database (hashed)
  if (refreshToken) {
    try {
      // Hash the refresh token before storing
      const hashedToken = jwt.sign(
        { token: refreshToken },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await RefreshToken.create({
        token: hashedToken,
        user: user._id,
        expiresAt,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      });

      DEBUG_LOG('Refresh token saved to database');
    } catch (error) {
      ERROR_LOG('Failed to save refresh token', error);
      // Continue anyway - the user can still use access token
    }
  }

  // Update user's last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Send response with cookie
  res
    .status(statusCode)
    .cookie('token', accessToken, cookieOptions)
    .json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: user.getPublicProfile(),
        accessToken, // Also send in body for mobile compatibility
      },
    });
};

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res, next) => {
  const { email, password, name } = req.body;

  DEBUG_LOG('Register request', { email, name });

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('Email already registered', 400, 'EMAIL_EXISTS')));
  }

  // Create user
  const user = await User.create({
    email,
    password,
    name,
  });

  // Generate refresh token
  const refreshToken = generateRefreshToken(user._id);

  // Send response
  await sendTokenResponse(user, 201, refreshToken, req, res);
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  DEBUG_LOG('Login request', { email });

  // Validate input
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400, 'MISSING_CREDENTIALS')));
  }

  // Check if user exists (include password for comparison)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    DEBUG_LOG('User not found', { email });
    return next(new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')));
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    DEBUG_LOG('Password mismatch', { email });
    return next(new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')));
  }

  // Generate refresh token
  const refreshToken = generateRefreshToken(user._id);

  DEBUG_LOG('Login successful', { userId: user._id });

  // Send response
  await sendTokenResponse(user, 200, refreshToken, req, res);
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res, next) => {
  const token = req.cookies.token;

  DEBUG_LOG('Logout request', { userId: req.userId });

  // Get refresh token from header (sent with request)
  const refreshTokenValue = req.headers['x-refresh-token'];

  if (refreshTokenValue) {
    try {
      // Find and revoke the refresh token
      const decoded = jwt.verify(refreshTokenValue, process.env.JWT_REFRESH_SECRET);
      await RefreshToken.revokeAllUserTokens(req.userId);
      DEBUG_LOG('Refresh tokens revoked');
    } catch (error) {
      DEBUG_LOG('Could not revoke refresh token', { error: error.message });
    }
  }

  // Clear the cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public (with refresh token)
 */
export const refreshToken = asyncHandler(async (req, res, next) => {
  const refreshTokenValue = req.cookies.refreshToken || req.body.refreshToken;

  DEBUG_LOG('Refresh token request', { hasToken: !!refreshTokenValue });

  if (!refreshTokenValue) {
    return next(new AppError('Refresh token required', 400, 'REFRESH_TOKEN_REQUIRED')));
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshTokenValue, process.env.JWT_REFRESH_SECRET);

    // Check if token exists in database and is not revoked
    const storedToken = await RefreshToken.findOne({
      user: decoded.id,
      isRevoked: false,
    }).populate('user');

    if (!storedToken) {
      DEBUG_LOG('Refresh token not found or revoked', { userId: decoded.id });
     return next(new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')));
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return next(new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED')));
    }

    // Rotate refresh token - generate new one
    const newRefreshToken = generateRefreshToken(decoded.id);

    // Revoke old refresh token
    storedToken.isRevoked = true;
    await storedToken.save();

    // Generate new access token
    const accessToken = generateAccessToken(decoded.id);

    // Save new refresh token
    const hashedToken = jwt.sign(
      { token: newRefreshToken },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      token: hashedToken,
      user: decoded.id,
      expiresAt,
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
    });

    DEBUG_LOG('Token refresh successful', { userId: decoded.id });

    // Set new access token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const accessTokenExpiry = new Date(
      Date.now() + parseInt(process.env.JWT_EXPIRE_MINUTES || '15') * 60 * 1000
    );

    res
      .status(200)
      .cookie('token', accessToken, {
        expires: accessTokenExpiry,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      })
      .json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken,
        },
      });
  } catch (error) {
    ERROR_LOG('Token refresh failed', error);
    return next(new AppError('Invalid or expired refresh token', 401, 'REFRESH_TOKEN_INVALID')));
  }
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res, next) => {
  DEBUG_LOG('Get current user', { userId: req.userId });

  const user = await User.findById(req.userId);

  res.status(200).json({
    success: true,
    data: {
      user: user.getPublicProfile(),
    },
  });
});

export default {
  register,
  login,
  logout,
  refreshToken,
  getMe,
};
/**
 * Expense Controller
 * Handles CRUD operations for expenses
 */

import Expense, { EXPENSE_CATEGORIES } from '../models/Expense.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - ExpenseController: ${message}`, data);
  }
};

const ERROR_LOG = (message, error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ExpenseController: ${message}`, error);
};

/**
 * @desc    Get all expenses for user
 * @route   GET /api/expenses
 * @access  Private
 */
export const getExpenses = asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  
  // Parse query parameters
  const {
    page = 1,
    limit = 20,
    category,
    startDate,
    endDate,
    sortBy = 'date',
    sortOrder = 'desc',
  } = req.query;

  DEBUG_LOG('Get expenses request', {
    userId,
    page,
    limit,
    category,
    startDate,
    endDate,
  });

  // Build query
  const query = { user: userId };

  // Add category filter
  if (category) {
    query.category = category;
  }

  // Add date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // Calculate pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Validate sort fields
  const validSortFields = ['date', 'amount', 'category', 'createdAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  // Execute queries in parallel
  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Expense.countDocuments(query),
  ]);

  DEBUG_LOG('Expenses retrieved', {
    userId,
    count: expenses.length,
    total,
  });

  res.status(200).json({
    success: true,
    data: {
      expenses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * @desc    Get single expense
 * @route   GET /api/expenses/:id
 * @access  Private
 */
export const getExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;

  DEBUG_LOG('Get expense request', { id, userId });

  const expense = await Expense.findOne({ _id: id, user: userId });

  if (!expense) {
    return next(new AppError('Expense not found', 404, 'EXPENSE_NOT_FOUND')));
  }

  res.status(200).json({
    success: true,
    data: {
      expense,
    },
  });
});

/**
 * @desc    Create new expense
 * @route   POST /api/expenses
 * @access  Private
 */
export const createExpense = asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  const { amount, category, description, date, paymentMethod, isRecurring } = req.body;

  DEBUG_LOG('Create expense request', {
    userId,
    amount,
    category,
    date,
  });

  // Validate category
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return next(new AppError('Invalid category', 400, 'INVALID_CATEGORY')));
  }

  // Create expense
  const expense = await Expense.create({
    user: userId,
    amount,
    category,
    description: description || '',
    date: date || new Date(),
    paymentMethod: paymentMethod || 'Other',
    isRecurring: isRecurring || false,
  });

  DEBUG_LOG('Expense created', { id: expense._id });

  res.status(201).json({
    success: true,
    message: 'Expense created successfully',
    data: {
      expense,
    },
  });
});

/**
 * @desc    Update expense
 * @route   PUT /api/expenses/:id
 * @access  Private
 */
export const updateExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;
  const { amount, category, description, date, paymentMethod, isRecurring } = req.body;

  DEBUG_LOG('Update expense request', { id, userId, updates: req.body });

  // Find expense (must belong to user)
  let expense = await Expense.findOne({ _id: id, user: userId });

  if (!expense) {
    return next(new AppError('Expense not found', 404, 'EXPENSE_NOT_FOUND'))); 
  }

  // Validate category if provided
  if (category && !EXPENSE_CATEGORIES.includes(category)) {
    return next(new AppError('Invalid category', 400, 'INVALID_CATEGORY')));
  }

  // Update fields
  if (amount !== undefined) expense.amount = amount;
  if (category) expense.category = category;
  if (description !== undefined) expense.description = description;
  if (date) expense.date = new Date(date);
  if (paymentMethod) expense.paymentMethod = paymentMethod;
  if (isRecurring !== undefined) expense.isRecurring = isRecurring;

  // Save
  await expense.save();

  DEBUG_LOG('Expense updated', { id: expense._id });

  res.status(200).json({
    success: true,
    message: 'Expense updated successfully',
    data: {
      expense,
    },
  });
});

/**
 * @desc    Delete expense
 * @route   DELETE /api/expenses/:id
 * @access  Private
 */
export const deleteExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;

  DEBUG_LOG('Delete expense request', { id, userId });

  const expense = await Expense.findOneAndDelete({ _id: id, user: userId });

  if (!expense) {
    return next(new AppError('Expense not found', 404, 'EXPENSE_NOT_FOUND')));
  }

  DEBUG_LOG('Expense deleted', { id });

  res.status(200).json({
    success: true,
    message: 'Expense deleted successfully',
    data: {},
  });
});

/**
 * @desc    Get expense statistics
 * @route   GET /api/expenses/stats
 * @access  Private
 */
export const getExpenseStats = asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  const { period = 'month' } = req.query;

  DEBUG_LOG('Get expense stats request', { userId, period });

  // Calculate date range based on period
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }

  // Get statistics
  const stats = await Expense.getStatistics(userId, startDate, now);

  // Get monthly totals for chart
  const monthlyTotals = await Expense.getMonthlyTotals(userId, 6);

  // Get today's spending
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayTotal = await Expense.aggregate([
    {
      $match: {
        user: userId,
        date: { $gte: todayStart, $lte: todayEnd },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  DEBUG_LOG('Stats computed', {
    userId,
    categoriesCount: stats.byCategory.length,
    monthlyDataPoints: monthlyTotals.length,
  });

  res.status(200).json({
    success: true,
    data: {
      statistics: stats,
      monthlyTotals,
      todayTotal: todayTotal[0]?.total || 0,
      categories: EXPENSE_CATEGORIES,
    },
  });
});

/**
 * @desc    Get expense summary by date range
 * @route   GET /api/expenses/summary
 * @access  Private
 */
export const getExpenseSummary = asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  const { startDate, endDate } = req.query;

  DEBUG_LOG('Get expense summary request', { userId, startDate, endDate });

  if (!startDate || !endDate) {
    return next(new AppError('Please provide start and end dates', 400, 'DATES_REQUIRED')));
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get summary by category
  const byCategory = await Expense.aggregate([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Get daily breakdown
  const byDay = await Expense.aggregate([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' },
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get overall total
  const overall = await Expense.aggregate([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avg: { $avg: '$amount' },
      },
    },
  ]);

  DEBUG_LOG('Summary computed', {
    userId: byCategory.length,
    categories: byCategory.length,
    days: byDay.length,
  });

  res.status(200).json({
    success: true,
    data: {
      byCategory,
      byDay,
      overall: overall[0] || { total: 0, count: 0, avg: 0 },
    },
  });
});

export default {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpenseSummary,
};
