/**
 * API Service
 * Axios instance with interceptors for authentication and error handling
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Debug logger
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - API: ${message}`, data ?? '');
  }
};

// Base URL - defaults to relative path for proxy, or explicit URL for production
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Important for HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

/**
 * Request interceptor
 * Adds authorization header if token exists
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage (set by login response)
    const token = localStorage.getItem('accessToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      DEBUG_LOG('Request with token', { url: config.url });
    } else {
      DEBUG_LOG('Request without token', { url: config.url });
    }

    return config;
  },
  (error) => {
    DEBUG_LOG('Request error', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handles token refresh on 401 errors
 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // Store token from response if present
    const token = response.data?.data?.accessToken;
    if (token) {
      localStorage.setItem('accessToken', token);
      DEBUG_LOG('Token refreshed from response');
    }
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Mark as retrying
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        DEBUG_LOG('Attempting token refresh');
        
        // Try to refresh token
        const response = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data.data;
        
        // Save new token
        localStorage.setItem('accessToken', accessToken);
        
        // Process queued requests
        processQueue(null, accessToken);
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        DEBUG_LOG('Token refresh successful, retrying request');
        
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        DEBUG_LOG('Token refresh failed', refreshError);
        
        processQueue(refreshError as Error, null);
        localStorage.removeItem('accessToken');
        
        // Dispatch logout or redirect
        window.dispatchEvent(new CustomEvent('auth:logout'));
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    DEBUG_LOG('Response error', {
      status: error.response?.status,
      message: error.message,
    });

    return Promise.reject(error);
  }
);

export default api;
