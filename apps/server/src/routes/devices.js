import { Router } from 'express';
import { Device, PairingSession } from '../models/index.js';
import { DEVICE_STATUS } from '@synced-notepad/shared';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find({ workspaceId: req.workspace.id })
      .select('-sessionToken -deviceFingerprint')
      .sort({ createdAt: -1 });

    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspace.id },
      { name },
      { new: true },
    ).select('-sessionToken -deviceFingerprint');

    if (!device) {
      return res.status(404).json({ error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' } });
    }

    res.json({ device });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revoke', async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspace.id, status: DEVICE_STATUS.ACTIVE },
      { status: DEVICE_STATUS.REVOKED, sessionToken: null },
      { new: true },
    ).select('-sessionToken -deviceFingerprint');

    if (!device) {
      return res.status(404).json({ error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' } });
    }

    res.json({ device });
  } catch (err) {
    next(err);
  }
});

router.post('/pair', async (req, res, next) => {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const session = new PairingSession({
      workspaceId: req.workspace.id,
      ownerDeviceId: req.device.id,
      pairingToken: uuidv4(),
      verificationCode: String(Math.floor(100000 + Math.random() * 900000)),
      expiresAt,
    });

    await session.save();

    res.json({
      pairingToken: session.pairingToken,
      verificationCode: session.verificationCode,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/pair/scan', async (req, res, next) => {
  try {
    const { pairingToken, deviceName, deviceType } = req.body;

    const session = await PairingSession.findOne({
      pairingToken,
      status: 'pending',
    });

    if (!session) {
      return res.status(400).json({ error: { code: 'PAIRING_EXPIRED', message: 'Invalid pairing token' } });
    }

    if (new Date() > session.expiresAt) {
      session.status = 'expired';
      await session.save();
      return res.status(400).json({ error: { code: 'PAIRING_EXPIRED', message: 'Pairing token expired' } });
    }

    const device = new Device({
      workspaceId: session.workspaceId,
      userId: req.user.id,
      name: deviceName,
      type: deviceType,
      status: DEVICE_STATUS.PENDING,
      deviceFingerprint: crypto.randomUUID(),
    });
    await device.save();

    session.newDeviceId = device._id;
    session.newDeviceName = deviceName;
    session.newDeviceType = deviceType;
    await session.save();

    res.json({ sessionId: session._id, verificationCode: session.verificationCode });
  } catch (err) {
    next(err);
  }
});

router.post('/pair/confirm', async (req, res, next) => {
  try {
    const { sessionId, verificationCode } = req.body;

    const session = await PairingSession.findById(sessionId);
    if (!session || session.status !== 'pending') {
      return res.status(400).json({ error: { code: 'PAIRING_EXPIRED', message: 'Invalid session' } });
    }

    if (verificationCode && verificationCode !== session.verificationCode) {
      return res.status(400).json({ error: { code: 'AUTH_ERROR', message: 'Invalid verification code' } });
    }

    session.status = 'accepted';
    session.usedAt = new Date();
    await session.save();

    await Device.findByIdAndUpdate(session.newDeviceId, { status: DEVICE_STATUS.ACTIVE });

    const device = await Device.findById(session.newDeviceId).select('-sessionToken -deviceFingerprint');
    res.json({ device });
  } catch (err) {
    next(err);
  }
});

export default router;
