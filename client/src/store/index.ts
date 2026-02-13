/**
 * Redux Store Configuration
 * Centralized state management with Redux Toolkit
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import expenseReducer from './slices/expenseSlice';

// Debug logger
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - Store: ${message}`, data ?? '');
  }
};

/**
 * Configure Redux store with reducers
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    expenses: expenseReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['auth/setUser'],
      },
    }),
  devTools: import.meta.env.DEV,
});

// Subscribe to store changes for debugging
store.subscribe(() => {
  DEBUG_LOG('Store state updated', {
    auth: store.getState().auth.isAuthenticated,
    expensesCount: store.getState().expenses.items.length,
  });
});

// TypeScript types for the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

DEBUG_LOG('Redux store initialized');
