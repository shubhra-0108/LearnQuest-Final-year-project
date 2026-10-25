import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

async function start() {
  try {
    logger.info('Connecting to MongoDB...', { uri: config.mongoUri.replace(/:([^:@]+)@/, ':***@') });
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    logger.info('MongoDB connected successfully');

    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info(`LearnQuest API server running on port ${config.port} (${config.nodeEnv})`);
      logger.info(`ML service target: ${config.mlUrl}`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        await mongoose.disconnect();
        logger.info('Closed DB connections and HTTP server. Exiting.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
