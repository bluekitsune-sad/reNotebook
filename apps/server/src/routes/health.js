import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const readyState = mongoose.default.connection.readyState;
    if (readyState === 1) {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

export default router;
