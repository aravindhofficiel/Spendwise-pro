/**
 * Auth Service
 * Authentication API calls
 */

import api from './index';
import { User } from '../types';

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
  };
}

interface UserResponse {
  success: boolean;
  data: {
    user: User;
  };
}

interface MessageResponse {
  success: boolean;
  message: string;
}

const authService = {
  /**
   * Register a new user
   */
  register: async (credentials: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', credentials);
    if (response.data.data.accessToken) {
      localStorage.setItem('accessToken', response.data.data.accessToken);
    }
    return response.data;
  },

  /**
   * Login user
   */
  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.data.accessToken) {
      localStorage.setItem('accessToken', response.data.data.accessToken);
    }
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<MessageResponse> => {
    const response = await api.post('/auth/logout');
    localStorage.removeItem('accessToken');
    return response.data;
  },

  /**
   * Get current user
   */
  getCurrentUser: async (): Promise<UserResponse> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (): Promise<{ accessToken: string }> => {
    const response = await api.post('/auth/refresh');
    if (response.data.data.accessToken) {
      localStorage.setItem('accessToken', response.data.data.accessToken);
    }
    return response.data.data;
  },
};

export default authService;
