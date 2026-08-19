import { Router } from 'express';
import * as deviceService from '../services/deviceService.js';
import { logEvent } from '../services/auditService.js';
import { badRequest, ERROR_CODES } from '@synced-notepad/shared';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { devices } = await deviceService.listDevices(req.workspace.id);
    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const { device } = await deviceService.renameDevice(req.workspace.id, req.params.id, name);
    res.json({ device });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revoke', async (req, res, next) => {
  try {
    const { device } = await deviceService.revokeDevice(req.workspace.id, req.params.id);

    await logEvent(
      req.workspace.id,
      req.user.id,
      req.device.id,
      'device.revoked',
      { revokedDeviceId: device._id },
    );

    res.json({ device });
  } catch (err) {
    next(err);
  }
});

router.post('/pair', async (req, res, next) => {
  try {
    const result = await deviceService.initiatePairing(req.workspace.id, req.device.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/pair/scan', async (req, res, next) => {
  try {
    const { pairingToken, deviceName, deviceType } = req.body;

    if (!pairingToken || !deviceName || !deviceType) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'pairingToken, deviceName, and deviceType are required');
    }

    const result = await deviceService.scanPairing(pairingToken, deviceName, deviceType, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/pair/confirm', async (req, res, next) => {
  try {
    const { sessionId, verificationCode } = req.body;

    if (!sessionId) {
      throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'sessionId is required');
    }

    const { device } = await deviceService.confirmPairing(sessionId, verificationCode);

    await logEvent(
      req.workspace.id,
      req.user.id,
      req.device.id,
      'device.paired',
      { newDeviceId: device._id },
    );

    res.json({ device });
  } catch (err) {
    next(err);
  }
});

export default router;
