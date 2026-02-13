/**
 * Authentication Slice
 * Manages user authentication state using Redux Toolkit
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import authService from '../../api/authService';
import { User } from '../../types';

// Debug logger
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - AuthSlice: ${message}`, data ?? '');
  }
};

// Types
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const register = createAsyncThunk(
  'auth/register',
  async (credentials: { email: string; password: string; name: string }, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Registering user', { email: credentials.email });
      const response = await authService.register(credentials);
      DEBUG_LOG('Registration successful');
      return response.data.user;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Registration failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Logging in user', { email: credentials.email });
      const response = await authService.login(credentials);
      DEBUG_LOG('Login successful');
      return response.data.user;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Login failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    DEBUG_LOG('Logging out user');
    await authService.logout();
    DEBUG_LOG('Logout successful');
  } catch (error) {
    DEBUG_LOG('Logout error (continuing anyway)', error);
  }
});

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      DEBUG_LOG('Fetching current user');
      const response = await authService.getCurrentUser();
      DEBUG_LOG('Current user fetched');
      return response.data.user;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      DEBUG_LOG('Get current user failed', err.response?.data?.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to get user');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      DEBUG_LOG('Error cleared');
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      DEBUG_LOG('User set from token');
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        DEBUG_LOG('Register pending');
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        DEBUG_LOG('Register fulfilled');
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        DEBUG_LOG('Register rejected');
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        DEBUG_LOG('Login pending');
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        DEBUG_LOG('Login fulfilled');
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        DEBUG_LOG('Login rejected');
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
        DEBUG_LOG('Logout fulfilled');
      })
      // Get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
        DEBUG_LOG('Get current user pending');
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        DEBUG_LOG('Get current user fulfilled');
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        DEBUG_LOG('Get current user rejected');
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
