/**
 * Database Configuration
 * Handles MongoDB connection with proper error handling and logging
 */

import mongoose from 'mongoose';

// Debug logger - centralized logging
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
  }
};

// Error logger
const ERROR_LOG = (message, error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
};

/**
 * Connect to MongoDB Atlas
 * Uses connection pooling and proper options for production
 */
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    DEBUG_LOG('Attempting to connect to MongoDB Atlas');

    // MongoDB connection options for production readiness
    const options = {
      maxPoolSize: 10, // Connection pool size
      serverSelectionTimeoutMS: 5000, // Server selection timeout
      socketTimeoutMS: 45000, // Socket timeout
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    DEBUG_LOG(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      ERROR_LOG('MongoDB Disconnected - Attempting to reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      ERROR_LOG('MongoDB Connection Error:', err);
    });

    mongoose.connection.on('reconnected', () => {
      DEBUG_LOG('MongoDB Reconnected successfully');
    });

    return conn;
  } catch (error) {
    ERROR_LOG('MongoDB Connection Failed:', error.message);
    // In production, you might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting due to database connection failure');
      process.exit(1);
    }
    // In development, continue running
    console.warn('Running in development mode - continuing without database');
  }
};

export default connectDB;
