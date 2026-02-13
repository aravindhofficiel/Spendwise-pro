/**
 * Settings Page Component
 * User profile and app settings
 */

import { useState } from 'react';
import { useAppSelector } from '../store/hooks/useRedux';
import { User, Mail, Calendar, Shield } from 'lucide-react';

/**
 * Debug logger
 */
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - SettingsPage: ${message}`, data ?? '');
  }
};

/**
 * Format date
 */
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Settings Page Component
 */
const Settings = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [isEditing, setIsEditing] = useState(false);

  DEBUG_LOG('Rendering settings page');

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-50 rounded-lg">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
        </div>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">Your profile photo</p>
            </div>
          </div>

          {/* Name */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <User className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="font-medium text-gray-900">{user?.name}</p>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <Mail className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Email Address</p>
              <p className="font-medium text-gray-900">{user?.email}</p>
            </div>
          </div>

          {/* Member Since */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-medium text-gray-900">{formatDate(user?.createdAt)}</p>
            </div>
          </div>

          {/* Last Login */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <Shield className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Last Login</p>
              <p className="font-medium text-gray-900">{formatDate(user?.lastLogin || null)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-50 rounded-lg">
            <Shield className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-medium text-green-700">Your account is secure</p>
            </div>
            <p className="text-sm text-green-600 mt-1">
              Password is encrypted and stored securely. All data is transmitted over HTTPS.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              <strong>Security features enabled:</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>• JWT tokens stored in HttpOnly cookies</li>
              <li>• Refresh token rotation</li>
              <li>• Rate limiting on authentication</li>
              <li>• Input sanitization against XSS</li>
            </ul>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">About SpendWise Pro</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>Version: 1.0.0</p>
          <p>Enterprise-grade expense tracking application</p>
          <p className="pt-2">
            Built with React, Redux Toolkit, Node.js, Express, and MongoDB
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
