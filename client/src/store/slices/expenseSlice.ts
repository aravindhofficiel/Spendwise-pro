/**
 * Expense Slice
 * Manages expense state using Redux Toolkit
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import expenseService from '../../api/expenseService';
import { Expense, ExpenseStats } from '../../types';

// Debug logger
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ExpenseSlice: ${message}`, data ?? '');
  }
};

// Types
interface ExpenseState {
  items: Expense[];
  stats: ExpenseStats | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;
}

// Initial state
const initialState: ExpenseState = {
  items: [],
  stats: null,
  isLoading: false,
  error: null,
  pagination: null,
};

// Async thunks
export const fetchExpenses = createAsyncThunk(
  'expenses/fetchExpenses',
  async (params: {
    page?: number;
    limit?: number;
    category?: string;
    startDate?: string;
    endDate?: string;
  } = {}, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Fetching expenses', params);
      const response = await expenseService.getExpenses(params);
      DEBUG_LOG('Expenses fetched', { count: response.data.expenses.length });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Fetch expenses failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch expenses');
    }
  }
);

export const createExpense = createAsyncThunk(
  'expenses/createExpense',
  async (expense: {
    amount: number;
    category: string;
    description?: string;
    date?: string;
    paymentMethod?: string;
    isRecurring?: boolean;
  }, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Creating expense', expense);
      const response = await expenseService.createExpense(expense);
      DEBUG_LOG('Expense created', { id: response.data.expense._id });
      return response.data.expense;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Create expense failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to create expense');
    }
  }
);

export const updateExpense = createAsyncThunk(
  'expenses/updateExpense',
  async ({ id, data }: { id: string; data: Partial<Expense> }, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Updating expense', { id, data });
      const response = await expenseService.updateExpense(id, data);
      DEBUG_LOG('Expense updated', { id });
      return response.data.expense;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Update expense failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to update expense');
    }
  }
);

export const deleteExpense = createAsyncThunk(
  'expenses/deleteExpense',
  async (id: string, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Deleting expense', { id });
      await expenseService.deleteExpense(id);
      DEBUG_LOG('Expense deleted', { id });
      return id;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Delete expense failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to delete expense');
    }
  }
);

export const fetchExpenseStats = createAsyncThunk(
  'expenses/fetchStats',
  async (period: 'week' | 'month' | 'year' = 'month', { rejectWithValue }) => {
    try {
      DEBUG_LOG('Fetching expense stats', { period });
      const response = await expenseService.getStats(period);
      DEBUG_LOG('Stats fetched');
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Fetch stats failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch stats');
    }
  }
);

// Expense slice
const expenseSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      DEBUG_LOG('Expense error cleared');
    },
    clearExpenses: (state) => {
      state.items = [];
      state.pagination = null;
      DEBUG_LOG('Expenses cleared');
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch expenses
      .addCase(fetchExpenses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        DEBUG_LOG('Fetch expenses pending');
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.expenses;
        state.pagination = action.payload.pagination;
        DEBUG_LOG('Fetch expenses fulfilled');
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        DEBUG_LOG('Fetch expenses rejected');
      })
      // Create expense
      .addCase(createExpense.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        if (state.pagination) {
          state.pagination.total += 1;
        }
        DEBUG_LOG('Create expense fulfilled');
      })
      // Update expense
      .addCase(updateExpense.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        DEBUG_LOG('Update expense fulfilled');
      })
      // Delete expense
      .addCase(deleteExpense.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        if (state.pagination) {
          state.pagination.total -= 1;
        }
        DEBUG_LOG('Delete expense fulfilled');
      })
      // Fetch stats
      .addCase(fetchExpenseStats.pending, (state) => {
        state.isLoading = true;
        DEBUG_LOG('Fetch stats pending');
      })
      .addCase(fetchExpenseStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
        DEBUG_LOG('Fetch stats fulfilled');
      })
      .addCase(fetchExpenseStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        DEBUG_LOG('Fetch stats rejected');
      });
  },
});

export const { clearError, clearExpenses } = expenseSlice.actions;
export default expenseSlice.reducer;
