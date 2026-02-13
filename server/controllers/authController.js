/**
 * Authentication Controller
 * Handles user registration, login, logout, and token refresh
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

// Debug logger
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - AuthController: ${message}`, data);
  }
};

const ERROR_LOG = (message, error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - AuthController: ${message}`, error);
};

/**
 * Generate JWT Access Token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

/**
 * Generate JWT Refresh Token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

/**
 * Send token response with cookies
 */
const sendTokenResponse = async (user, statusCode, refreshToken, req, res) => {
  // Generate access token
  const accessToken = generateAccessToken(user._id);

  // Calculate cookie expiration
  const accessTokenExpiry = new Date(
    Date.now() + parseInt(process.env.JWT_EXPIRE_MINUTES || '15') * 60 * 1000
  );

  const isProduction = process.env.NODE_ENV === 'production';

  // Cookie options
  const cookieOptions = {
    expires: accessTokenExpiry,
    httpOnly: true, // Critical for security - prevents XSS
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // CSRF protection
  };

  DEBUG_LOG('Sending token response', {
    userId: user._id,
    isProduction,
  });

  // Save refresh token to database (hashed)
  if (refreshToken) {
    try {
      // Hash the refresh token before storing
      const hashedToken = jwt.sign(
        { token: refreshToken },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await RefreshToken.create({
        token: hashedToken,
        user: user._id,
        expiresAt,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      });

      DEBUG_LOG('Refresh token saved to database');
    } catch (error) {
      ERROR_LOG('Failed to save refresh token', error);
      // Continue anyway - the user can still use access token
    }
  }

  // Update user's last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Send response with cookie
  res
    .status(statusCode)
    .cookie('token', accessToken, cookieOptions)
    .json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: user.getPublicProfile(),
        accessToken, // Also send in body for mobile compatibility
      },
    });
};

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res, next) => {
  const { email, password, name } = req.body;

  DEBUG_LOG('Register request', { email, name });

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError());
  }

  // Create user
  const user = await User.create({
    email,
    password,
    name,
  });

  // Generate refresh token
  const refreshToken = generateRefreshToken(user._id);

  // Send response
  await sendTokenResponse(user, 201, refreshToken, req, res);
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  DEBUG_LOG('Login request', { email });

  // Validate input
  if (!email || !password) {
    return next(new AppError());
  }

  // Check if user exists (include password for comparison)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    DEBUG_LOG('User not found', { email });
    return next(new AppError());
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    DEBUG_LOG('Password mismatch', { email });
    return next(new AppError());
  }

  // Generate refresh token
  const refreshToken = generateRefreshToken(user._id);

  DEBUG_LOG('Login successful', { userId: user._id });

  // Send response
  await sendTokenResponse(user, 200, refreshToken, req, res);
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res, next) => {
  const token = req.cookies.token;

  DEBUG_LOG('Logout request', { userId: req.userId });

  // Get refresh token from header (sent with request)
  const refreshTokenValue = req.headers['x-refresh-token'];

  if (refreshTokenValue) {
    try {
      // Find and revoke the refresh token
      const decoded = jwt.verify(refreshTokenValue, process.env.JWT_REFRESH_SECRET);
      await RefreshToken.revokeAllUserTokens(req.userId);
      DEBUG_LOG('Refresh tokens revoked');
    } catch (error) {
      DEBUG_LOG('Could not revoke refresh token', { error: error.message });
    }
  }

  // Clear the cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public (with refresh token)
 */
export const refreshToken = asyncHandler(async (req, res, next) => {
  const refreshTokenValue = req.cookies.refreshToken || req.body.refreshToken;

  DEBUG_LOG('Refresh token request', { hasToken: !!refreshTokenValue });

  if (!refreshTokenValue) {
    return next(new AppError());
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshTokenValue, process.env.JWT_REFRESH_SECRET);

    // Check if token exists in database and is not revoked
    const storedToken = await RefreshToken.findOne({
      user: decoded.id,
      isRevoked: false,
    }).populate('user');

    if (!storedToken) {
      DEBUG_LOG('Refresh token not found or revoked', { userId: decoded.id });
     return next(new AppError());
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return next(new AppError());
    }

    // Rotate refresh token - generate new one
    const newRefreshToken = generateRefreshToken(decoded.id);

    // Revoke old refresh token
    storedToken.isRevoked = true;
    await storedToken.save();

    // Generate new access token
    const accessToken = generateAccessToken(decoded.id);

    // Save new refresh token
    const hashedToken = jwt.sign(
      { token: newRefreshToken },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      token: hashedToken,
      user: decoded.id,
      expiresAt,
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
    });

    DEBUG_LOG('Token refresh successful', { userId: decoded.id });

    // Set new access token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const accessTokenExpiry = new Date(
      Date.now() + parseInt(process.env.JWT_EXPIRE_MINUTES || '15') * 60 * 1000
    );

    res
      .status(200)
      .cookie('token', accessToken, {
        expires: accessTokenExpiry,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      })
      .json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken,
        },
      });
  } catch (error) {
    ERROR_LOG('Token refresh failed', error);
    return next(new AppError());
  }
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res, next) => {
  DEBUG_LOG('Get current user', { userId: req.userId });

  const user = await User.findById(req.userId);

  res.status(200).json({
    success: true,
    data: {
      user: user.getPublicProfile(),
    },
  });
});

export default {
  register,
  login,
  logout,
  refreshToken,
  getMe,
};
