import { createServer } from 'node:http';
import { app } from './app.js';
import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { initSocket } from './lib/socket.js';
import { logger } from './utils/logger.js';

// HTTP server তৈরি করো (Express app attach করে)
const httpServer = createServer(app);

// Socket.IO init করো HTTP server-এর উপর
initSocket(httpServer);

// Server start
const server = httpServer.listen(env.PORT, () => {
  logger.info(`🚀 OPORADH API running on http://localhost:${env.PORT}`);
  logger.info(`🔌 Socket.IO ready on ws://localhost:${env.PORT}/socket.io`);
  logger.info(`🌱 Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  process.exit(1);
});
