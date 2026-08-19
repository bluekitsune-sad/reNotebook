import jwt from 'jsonwebtoken';
import { Device } from '../models/index.js';
import { unauthorized, forbidden, ERROR_CODES } from '@synced-notepad/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(unauthorized(ERROR_CODES.AUTH_ERROR, 'Missing authentication token'));
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId };
    req.device = { id: payload.deviceId };
    req.workspace = { id: payload.workspaceId };
    next();
  } catch {
    next(unauthorized(ERROR_CODES.AUTH_ERROR, 'Invalid or expired token'));
  }
}

export async function authenticateWithWorkspaceFallback(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(unauthorized(ERROR_CODES.AUTH_ERROR, 'Missing authentication token'));
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId };
    req.device = { id: payload.deviceId };
    req.workspace = { id: payload.workspaceId };

    if (!req.workspace.id && req.device.id) {
      const device = await Device.findById(req.device.id).select('workspaceId');
      if (device) {
        req.workspace = { id: device.workspaceId.toString() };
      }
    }

    next();
  } catch {
    next(unauthorized(ERROR_CODES.AUTH_ERROR, 'Invalid or expired token'));
  }
}

export function generateToken({ userId, deviceId, workspaceId }) {
  return jwt.sign({ userId, deviceId, workspaceId }, JWT_SECRET, { expiresIn: '30d' });
}
