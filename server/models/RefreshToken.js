/**
 * Refresh Token Model
 * Stores refresh tokens for JWT refresh token rotation
 * Each token is linked to a user and has an expiration
 */

import mongoose from 'mongoose';

/**
 * RefreshToken Schema
 * - token: the actual refresh token (hashed for security)
 * - user: reference to the User model
 * - expiresAt: when the token expires
 * - isRevoked: for manual token revocation
 * - createdAt: when token was issued
 * - userAgent: browser/device info for security tracking
 */
const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    select: false, // Never expose in queries
    index: true, // Indexed for faster lookups
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // Indexed for user token lookup
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true, // Indexed for cleanup queries
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true, // Indexed for revocation checks
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Store user agent for security tracking
  userAgent: {
    type: String,
    default: 'Unknown',
  },
  // IP address for security tracking
  ipAddress: {
    type: String,
    default: 'Unknown',
  },
});

// Compound index for efficient token lookup and cleanup
refreshTokenSchema.index({ user: 1, isRevoked: 1, expiresAt: 1 });

/**
 * Static method - Clean up expired tokens
 * Should be called periodically to maintain database hygiene
 * @returns {Promise<number>} - Number of deleted tokens
 */
refreshTokenSchema.statics.cleanupExpiredTokens = async function () {
  try {
    const result = await this.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } }, // Expired
        { isRevoked: true }, // Manually revoked
      ],
    });
    
    DEBUG_LOG(`Cleaned up ${result.deletedCount} expired/revoked tokens`);
    return result.deletedCount;
  } catch (error) {
    console.error('[ERROR] Token cleanup failed:', error);
    return 0;
  }
};

/**
 * Static method - Revoke all tokens for a user (logout all devices)
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of revoked tokens
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function (userId) {
  try {
    const result = await this.updateMany(
      { user: userId, isRevoked: false },
      { $set: { isRevoked: true } }
    );
    
    DEBUG_LOG(`Revoked ${result.modifiedCount} tokens for user`);
    return result.modifiedCount;
  } catch (error) {
    console.error('[ERROR] Token revocation failed:', error);
    return 0;
  }
};

// Debug logger
const DEBUG_LOG = (message) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - RefreshToken: ${message}`);
  }
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
