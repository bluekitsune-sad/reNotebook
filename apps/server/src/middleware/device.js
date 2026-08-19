import { DEVICE_STATUS, forbidden, ERROR_CODES } from '@synced-notepad/shared';
import { Device } from '../models/index.js';

export async function requireActiveDevice(req, res, next) {
  try {
    const device = await Device.findOne({
      _id: req.device.id,
      workspaceId: req.workspace.id,
      status: DEVICE_STATUS.ACTIVE,
    });

    if (!device) {
      return next(forbidden(ERROR_CODES.DEVICE_REVOKED, 'Device is not authorized'));
    }

    req.deviceDoc = device;
    next();
  } catch {
    next(forbidden(ERROR_CODES.DEVICE_NOT_FOUND, 'Device not found'));
  }
}
