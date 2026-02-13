/**
 * SpendWise Pro - Enterprise Expense Tracker
 * Main Server Entry Point
 * 
 * This is the entry point for the backend application.
 * It loads environment variables, connects to the database,
 * and starts the Express server.
 */

// Load environment variables first
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Debug logger - initialize early
const DEBUG_LOG = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()} - Server: ${message}`, data);
    console.log('Mongo URI loaded:', process.env.MONGODB_URI);

  }
};

const ERROR_LOG = (message, error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - Server: ${message}`, error);
};

const INFO_LOG = (message) => {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
};

// Import app and database
import app from './app.js';
import connectDB from './config/db.js';

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Get port from environment or default to 5000
    const PORT = process.env.PORT || 5000;
    
    // Get environment
    const NODE_ENV = process.env.NODE_ENV || 'development';

    INFO_LOG(`Starting SpendWise Pro Server in ${NODE_ENV} mode...`);
    DEBUG_LOG('Environment variables loaded', {
      PORT,
      NODE_ENV,
      hasMongoURI: !!process.env.MONGODB_URI,
      hasJWTSecret: !!process.env.JWT_SECRET,
    });

    // Connect to MongoDB
    await connectDB();

    // Clean up expired refresh tokens on startup (optional, can be scheduled)
    try {
      const RefreshToken = (await import('./models/RefreshToken.js')).default;
      const deletedCount = await RefreshToken.cleanupExpiredTokens();
      if (deletedCount > 0) {
        INFO_LOG(`Cleaned up ${deletedCount} expired refresh tokens`);
      }
    } catch (error) {
      DEBUG_LOG('Token cleanup skipped (database may not be connected)', {
        error: error.message,
      });
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      INFO_LOG(`Server running on port ${PORT}`);
      INFO_LOG(`API available at http://localhost:${PORT}/api`);
      INFO_LOG(`Health check: http://localhost:${PORT}/api/health`);
      
      if (NODE_ENV === 'development') {
        INFO_LOG('Development mode - CORS origin:', process.env.FRONTEND_URL || 'http://localhost:5173');
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      ERROR_LOG('Unhandled Promise Rejection:', err);
      // Close server & exit process
      server.close(() => {
        ERROR_LOG('Server closed due to unhandled rejection');
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      ERROR_LOG('Uncaught Exception:', err);
      server.close(() => {
        ERROR_LOG('Server closed due to uncaught exception');
        process.exit(1);
      });
    });

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      INFO_LOG(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        INFO_LOG('HTTP server closed');
        
        // Close database connection
        try {
          const mongoose = (await import('mongoose')).default;
          await mongoose.connection.close();
          INFO_LOG('Database connection closed');
        } catch (error) {
          ERROR_LOG('Error closing database connection:', error);
        }
        
        INFO_LOG('Graceful shutdown complete');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        ERROR_LOG('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Listen for shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    ERROR_LOG('Failed to start server:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Start the server
startServer();
