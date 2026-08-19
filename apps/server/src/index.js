import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { connectDatabase } from './utils/db.js';
import { logger } from './utils/logger.js';
import { ensureIndexes } from './utils/indexes.js';
import { authenticate } from './middleware/auth.js';
import { requireActiveDevice } from './middleware/device.js';
import { errorHandler } from './middleware/errorHandler.js';
import { errorTracker } from './middleware/errorTracker.js';
import { requestLogger } from './middleware/requestLogger.js';
import { incrementWebsockets, decrementWebsockets } from './utils/metrics.js';
import authRouter from './routes/auth.js';
import notesRouter from './routes/notes.js';
import syncRouter from './routes/sync.js';
import devicesRouter from './routes/devices.js';
import healthRouter from './routes/health.js';
import visibilityRouter from './routes/visibility.js';
import historyRouter from './routes/history.js';
import conflictsRouter from './routes/conflicts.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/notes', authenticate, requireActiveDevice, notesRouter);
app.use('/api/sync', authenticate, requireActiveDevice, syncRouter);
app.use('/api/devices', authenticate, requireActiveDevice, devicesRouter);
app.use('/api/visibility', authenticate, requireActiveDevice, visibilityRouter);
app.use('/api/history', authenticate, requireActiveDevice, historyRouter);
app.use('/api/conflicts', authenticate, requireActiveDevice, conflictsRouter);

app.use(errorTracker);
app.use(errorHandler);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  incrementWebsockets();
  logger.info('WebSocket connection established');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      logger.debug('WebSocket message:', message.type);
    } catch {
      logger.warn('Invalid WebSocket message');
    }
  });

  ws.on('close', () => {
    decrementWebsockets();
    logger.info('WebSocket connection closed');
  });
});

async function start() {
  await connectDatabase();
  await ensureIndexes();

  server.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    logger.info(`Synced Notepad server v${process.env.npm_package_version || '0.1.0'} starting`);
    logger.info(`Port: ${PORT} | Environment: ${env} | PID: ${process.pid}`);
    logger.info(`Health: http://localhost:${PORT}/api/health/health`);
    logger.info(`Ready:  http://localhost:${PORT}/api/health/ready`);
    logger.info(`Metrics: http://localhost:${PORT}/api/health/metrics`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  wss.clients.forEach(client => client.close());
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  wss.clients.forEach(client => client.close());
  server.close(() => {
    process.exit(0);
  });
});
