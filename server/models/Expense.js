/**
 * Expense Model
 * Schema for storing expense records with proper indexing for scaling
 */

import mongoose from 'mongoose';

/**
 * Expense Categories
 * Predefined categories for consistency
 */
export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Travel',
  'Education',
  'Personal Care',
  'Groceries',
  'Subscriptions',
  'Other',
];

/**
 * Expense Schema
 * - user: reference to User (indexed for multi-tenant queries)
 * - amount: expense amount (positive number)
 * - category: predefined category
 * - description: optional description
 * - date: when the expense occurred (indexed for date queries)
 * - createdAt/updatedAt: timestamps
 */
const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // Critical for multi-tenant scaling
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
    validate: {
      validator: function (value) {
        // Allow up to 2 decimal places
        return /^\d+(\.\d{1,2})?$/.test(value.toString());
      },
      message: 'Amount must have at most 2 decimal places',
    },
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: EXPENSE_CATEGORIES,
      message: 'Invalid category',
    },
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters'],
    default: '',
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now,
    index: true, // Indexed for date-based queries
  },
  // Payment method for additional tracking
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other'],
    default: 'Other',
  },
  // Recurring expense flag
  isRecurring: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
});

// Compound indexes for common query patterns - essential for scaling
expenseSchema.index({ user: 1, date: -1 }); // User + date (most common)
expenseSchema.index({ user: 1, category: 1 }); // User + category
expenseSchema.index({ user: 1, date: -1, category: 1 }); // Full filter

/**
 * Virtual - Get formatted amount
 */
expenseSchema.virtual('formattedAmount').get(function () {
  return `$${this.amount.toFixed(2)}`;
});

// Ensure virtuals are included in JSON
expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

/**
 * Static method - Get expense statistics for a user
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object>} - Aggregate statistics
 */
expenseSchema.statics.getStatistics = async function (userId, startDate, endDate) {
  try {
    const match = {
      user: userId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Aggregation pipeline for statistics
    const stats = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avg: { $avg: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Get overall totals
    const overall = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
    ]);

    DEBUG_LOG(`Statistics computed for user ${userId}`, {
      startDate,
      endDate,
      categoriesFound: stats.length,
    });

    return {
      byCategory: stats,
      overall: overall[0] || { totalAmount: 0, totalCount: 0, avgAmount: 0 },
    };
  } catch (error) {
    console.error('[ERROR] Statistics computation failed:', error);
    throw error;
  }
};

/**
 * Static method - Get monthly totals for charts
 * @param {string} userId - User ID
 * @param {number} months - Number of months to look back
 * @returns {Promise<Array>} - Monthly totals
 */
expenseSchema.statics.getMonthlyTotals = async function (userId, months = 6) {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const monthlyData = await this.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    DEBUG_LOG(`Monthly totals computed for user ${userId}`, {
      months,
      dataPoints: monthlyData.length,
    });

    return monthlyData;
  } catch (error) {
    console.error('[ERROR] Monthly totals computation failed:', error);
    throw error;
  }
};

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - Expense: ${message}`, data);
  }
};

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
