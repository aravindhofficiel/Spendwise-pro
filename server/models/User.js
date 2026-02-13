/**
 * User Model
 * Schema for storing user data with secure password hashing
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Schema
 * - email: unique, required, indexed for scaling
 * - password: hashed, never stored in plain text
 * - name: required for personalization
 * - createdAt/updatedAt: timestamps for audit
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    index: true, // Indexed for faster queries at scale
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Never include in queries by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  // Track account creation for analytics
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Last login timestamp
  lastLogin: {
    type: Date,
    default: null,
  },
});

// Index for scaling - compound index for common queries
userSchema.index({ email: 1, createdAt: -1 });

/**
 * Pre-save middleware - Hash password before saving
 * Only runs when password is modified
 */
userSchema.pre('save', async function (next) {
  // Debug log for development
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG] Hashing password for user:', this.email);
  }

  // Only hash password if it's modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt with cost factor 12 (secure balance)
    const salt = await bcrypt.genSalt(12);
    // Hash the password
    this.password = await bcrypt.hash(this.password, salt);
    DEBUG_LOG('Password hashed successfully');
    next();
  } catch (error) {
    console.error('[ERROR] Password hashing failed:', error);
    next(error);
  }
});

// Debug log helper
const DEBUG_LOG = (message) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`);
  }
};

/**
 * Instance method - Compare password with hashed password
 * @param {string} candidatePassword - Plain text password to compare
 * @returns {Promise<boolean>} - True if password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // Debug log for development
    DEBUG_LOG(`Comparing password for user: ${this.email}`);
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('[ERROR] Password comparison failed:', error);
    return false;
  }
};

/**
 * Instance method - Get user's public profile (without sensitive data)
 * @returns {Object} - Public user data
 */
userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

const User = mongoose.model('User', userSchema);

export default User;
