/**
 * Axios API Configuration
 * Centralized HTTP client with interceptors for authentication
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});


/**
 * Create axios instance with default config
 */
// const api = axios.create({
//   baseURL: API_BASE_URL,
//   withCredentials: true,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

/**
 * Debug logger
 */
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - API: ${message}`, data ?? '');
  }
};

/**
 * Request interceptor - Add auth token to requests
 */
api.interceptors.request.use(
  (config) => {
    DEBUG_LOG(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    DEBUG_LOG('Request error', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle auth errors and token refresh
 */
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        DEBUG_LOG('Attempting token refresh');
        await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        DEBUG_LOG('Token refresh failed', refreshError);
        // Redirect to login if refresh fails
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
