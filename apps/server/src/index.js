import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { connectDatabase } from './utils/db.js';
import { logger } from './utils/logger.js';
import { authenticate } from './middleware/auth.js';
import { requireActiveDevice } from './middleware/device.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import notesRouter from './routes/notes.js';
import syncRouter from './routes/sync.js';
import devicesRouter from './routes/devices.js';
import healthRouter from './routes/health.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/notes', authenticate, requireActiveDevice, notesRouter);
app.use('/api/sync', authenticate, requireActiveDevice, syncRouter);
app.use('/api/devices', authenticate, requireActiveDevice, devicesRouter);

app.use(errorHandler);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
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
    logger.info('WebSocket connection closed');
  });
});

async function start() {
  await connectDatabase();

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
