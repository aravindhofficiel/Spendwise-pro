/**
 * TypeScript Type Definitions
 * Centralized types for the SpendWise Pro application
 */

// User type
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLogin?: string;
}

// Expense type
export interface Expense {
  _id: string;
  user: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  formattedAmount?: string;
}

// Expense statistics
export interface ExpenseStats {
  statistics: {
    byCategory: Array<{
      _id: string;
      total: number;
      count: number;
      avg: number;
    }>;
    overall: {
      totalAmount: number;
      totalCount: number;
      avgAmount: number;
    };
  };
  monthlyTotals: Array<{
    _id: { year: number; month: number };
    total: number;
    count: number;
  }>;
  todayTotal: number;
  categories: string[];
}

// Pagination
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// Expense categories
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
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Payment methods
export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
