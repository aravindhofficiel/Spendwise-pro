/**
 * Main App Component
 * Handles routing and authentication state
 */

import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store/hooks/useRedux';
import { getCurrentUser, logout } from './store/slices/authSlice';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import LoadingSpinner from './components/LoadingSpinner';

/**
 * Debug logger
 */
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - App: ${message}`, data ?? '');
  }
};

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    DEBUG_LOG('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Public Route Component
 * Redirects to dashboard if already authenticated
 */
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    DEBUG_LOG('Already authenticated, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * Main App Component
 */
function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  /**
   * Initialize authentication state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      DEBUG_LOG('Initializing authentication');
      
      // Check for stored token
      const token = localStorage.getItem('accessToken');
      if (token) {
        DEBUG_LOG('Found stored token, fetching user');
        dispatch(getCurrentUser());
      } else {
        DEBUG_LOG('No stored token found');
      }
    };

    initAuth();

    // Listen for logout events from axios interceptor
    const handleLogout = () => {
      DEBUG_LOG('Auth logout event received');
      localStorage.removeItem('accessToken');
      dispatch(logout());
    };

    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [dispatch]);

  /**
   * Listen for token changes
   */
  useEffect(() => {
    DEBUG_LOG('Auth state changed', { isAuthenticated });
  }, [isAuthenticated]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
