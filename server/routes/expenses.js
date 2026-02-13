/**
 * Expense Routes
 * Handles CRUD operations for expenses
 */

import express from 'express';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpenseSummary,
} from '../controllers/expenseController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/expenses
 * @desc    Get all expenses for current user
 * @access  Private
 * @query   page, limit, category, startDate, endDate, sortBy, sortOrder
 */
router.get('/', getExpenses);

/**
 * @route   GET /api/expenses/stats
 * @desc    Get expense statistics
 * @access  Private
 * @query   period (week, month, year)
 */
router.get('/stats', getExpenseStats);

/**
 * @route   GET /api/expenses/summary
 * @desc    Get expense summary by date range
 * @access  Private
 * @query   startDate, endDate
 */
router.get('/summary', getExpenseSummary);

/**
 * @route   GET /api/expenses/:id
 * @desc    Get single expense
 * @access  Private
 */
router.get('/:id', getExpense);

/**
 * @route   POST /api/expenses
 * @desc    Create new expense
 * @access  Private
 * @body    amount, category, description, date, paymentMethod, isRecurring
 */
router.post('/', createExpense);

/**
 * @route   PUT /api/expenses/:id
 * @desc    Update expense
 * @access  Private
 */
router.put('/:id', updateExpense);

/**
 * @route   DELETE /api/expenses/:id
 * @desc    Delete expense
 * @access  Private
 */
router.delete('/:id', deleteExpense);

export default router;
