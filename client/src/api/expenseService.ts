/**
 * Expense Service
 * Expense API calls
 */

import api from './index';
import { Expense, ExpenseStats } from '../types';

interface ExpensesResponse {
  success: boolean;
  data: {
    expenses: Expense[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

interface ExpenseResponse {
  success: boolean;
  data: {
    expense: Expense;
  };
}

interface StatsResponse {
  success: boolean;
  data: {
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
  };
}

interface SummaryResponse {
  success: boolean;
  data: {
    byCategory: Array<{
      _id: string;
      total: number;
      count: number;
    }>;
    byDay: Array<{
      _id: string;
      total: number;
      count: number;
    }>;
    overall: {
      total: number;
      count: number;
      avg: number;
    };
  };
}

interface MessageResponse {
  success: boolean;
  message: string;
  data: object;
}

const expenseService = {
  /**
   * Get all expenses with pagination and filters
   */
  getExpenses: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ExpensesResponse> => {
    const response = await api.get('/expenses', { params });
    return response.data;
  },

  /**
   * Get single expense by ID
   */
  getExpense: async (id: string): Promise<ExpenseResponse> => {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  /**
   * Create new expense
   */
  createExpense: async (expense: {
    amount: number;
    category: string;
    description?: string;
    date?: string;
    paymentMethod?: string;
    isRecurring?: boolean;
  }): Promise<ExpenseResponse> => {
    const response = await api.post('/expenses', expense);
    return response.data;
  },

  /**
   * Update expense
   */
  updateExpense: async (
    id: string,
    data: Partial<Expense>
  ): Promise<ExpenseResponse> => {
    const response = await api.put(`/expenses/${id}`, data);
    return response.data;
  },

  /**
   * Delete expense
   */
  deleteExpense: async (id: string): Promise<MessageResponse> => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },

  /**
   * Get expense statistics
   */
  getStats: async (period: 'week' | 'month' | 'year' = 'month'): Promise<StatsResponse> => {
    const response = await api.get('/expenses/stats', { params: { period } });
    return response.data;
  },

  /**
   * Get expense summary by date range
   */
  getSummary: async (startDate: string, endDate: string): Promise<SummaryResponse> => {
    const response = await api.get('/expenses/summary', {
      params: { startDate, endDate },
    });
    return response.data;
  },
};

export default expenseService;
