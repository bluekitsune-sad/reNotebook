import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import * as authService from '../services/authService.js';
import { badRequest, ERROR_CODES } from '@synced-notepad/shared';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  workspaceName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, displayName, workspaceName } = req.validated;
    const result = await authService.register(email, password, displayName, workspaceName);

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const result = await authService.login(email, password);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
