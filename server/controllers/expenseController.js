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
    return next(new AppError());
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
    return next(new AppError());
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
    return next(new AppError()); 
  }

  // Validate category if provided
  if (category && !EXPENSE_CATEGORIES.includes(category)) {
    return next(new AppError());
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
    return next(new AppError());
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
    return next(new AppError());
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
