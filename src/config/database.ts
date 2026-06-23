import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { MONGODB_URI, NODE_ENV } from './';

// Log MongoDB connection errors but don't exit immediately
mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err}`);
  // Don't exit immediately in production to allow for debugging
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Log MongoDB queries in development
if (NODE_ENV === 'development') {
  mongoose.set('debug', true);
}

// Handle process termination
const exitHandler = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error('Error closing MongoDB connection during shutdown:', err);
  } finally {
    process.exit(0);
  }
};

// Handle app termination
process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);

/**
 * Initialize MongoDB connection
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // MONGODB_URI is guaranteed to be set by config/index.ts (exits if missing)
    const isAtlas = MONGODB_URI.includes('mongodb+srv') || MONGODB_URI.includes('mongodb.net');

    const options = {
      serverSelectionTimeoutMS: 120000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, options);

    const maskedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    if (isAtlas) {
      logger.info('Using MongoDB Atlas');
      console.log('Using MongoDB Atlas');
    } else {
      logger.info('Using local MongoDB');
      console.log('Using local MongoDB');
    }
    logger.info(`Connected to MongoDB: ${maskedUri}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Close MongoDB connection
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    throw error;
  }
};

/**
 * Drop the database (for testing purposes only)
 */
export const dropDatabase = async (): Promise<void> => {
  if (NODE_ENV === 'test') {
    try {
      await mongoose.connection.dropDatabase();
      logger.info('Dropped test database');
    } catch (error) {
      logger.error('Error dropping test database:', error);
      throw error;
    }
  } else {
    throw new Error('dropDatabase can only be used in test environment');
  }
};

export default {
  initialize: initializeDatabase,
  close: closeDatabase,
  drop: dropDatabase,
};
