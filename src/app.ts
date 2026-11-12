import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { notFound } from './middleware/not-found.js';
import { globalLimiter } from './middleware/rate-limit.js'; // ← নতুন
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// Logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  })
);

// Rate limiting — global fallback (Section 66)
app.use(globalLimiter);

// Static files (dev)
if (env.NODE_ENV === 'development') {
  app.use(express.static(path.resolve(process.cwd(), 'public')));
}

// Routes
app.use('/api', apiRouter);

// 404 + error
app.use(notFound);
app.use(errorHandler);
