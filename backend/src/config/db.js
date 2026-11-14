const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return mongoose.connection;
  }

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, options);
    isConnected = true;
    logger.info({ host: conn.connection.host, name: conn.connection.name }, 'Connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

async function disconnectDB() {
  if (!isConnected) {
    return;
  }
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from MongoDB');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
