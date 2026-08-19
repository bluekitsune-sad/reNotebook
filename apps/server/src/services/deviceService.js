import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Device, PairingSession } from '../models/index.js';
import { notFound, badRequest, forbidden, ERROR_CODES, DEVICE_STATUS } from '@synced-notepad/shared';

const PAIRING_EXPIRY_MS = 5 * 60 * 1000;

export async function listDevices(workspaceId) {
  const devices = await Device.find({ workspaceId })
    .select('-sessionToken -deviceFingerprint')
    .sort({ createdAt: -1 });

  return { devices };
}

export async function renameDevice(workspaceId, deviceId, name) {
  const device = await Device.findOneAndUpdate(
    { _id: deviceId, workspaceId },
    { name },
    { new: true }
  ).select('-sessionToken -deviceFingerprint');

  if (!device) {
    throw notFound(ERROR_CODES.DEVICE_NOT_FOUND, 'Device not found');
  }

  return { device };
}

export async function revokeDevice(workspaceId, deviceId) {
  const device = await Device.findOneAndUpdate(
    { _id: deviceId, workspaceId, status: DEVICE_STATUS.ACTIVE },
    { status: DEVICE_STATUS.REVOKED, sessionToken: null },
    { new: true }
  ).select('-sessionToken -deviceFingerprint');

  if (!device) {
    throw notFound(ERROR_CODES.DEVICE_NOT_FOUND, 'Device not found or already revoked');
  }

  return { device };
}

export async function initiatePairing(workspaceId, ownerDeviceId) {
  const ownerDevice = await Device.findOne({
    _id: ownerDeviceId,
    workspaceId,
    status: DEVICE_STATUS.ACTIVE,
  });

  if (!ownerDevice) {
    throw forbidden(ERROR_CODES.DEVICE_REVOKED, 'Owner device is not active');
  }

  const expiresAt = new Date(Date.now() + PAIRING_EXPIRY_MS);
  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

  const session = await PairingSession.create({
    workspaceId,
    ownerDeviceId,
    pairingToken: uuidv4(),
    verificationCode,
    expiresAt,
  });

  return {
    pairingToken: session.pairingToken,
    verificationCode: session.verificationCode,
    expiresAt: session.expiresAt,
    sessionId: session._id,
  };
}

export async function scanPairing(pairingToken, deviceName, deviceType, userId) {
  const session = await PairingSession.findOne({
    pairingToken,
    status: 'pending',
  });

  if (!session) {
    throw badRequest(ERROR_CODES.PAIRING_EXPIRED, 'Invalid pairing token');
  }

  if (new Date() > session.expiresAt) {
    session.status = 'expired';
    await session.save();
    throw badRequest(ERROR_CODES.PAIRING_EXPIRED, 'Pairing token expired');
  }

  if (session.newDeviceId) {
    throw badRequest(ERROR_CODES.PAIRING_ALREADY_USED, 'Pairing token already used');
  }

  const device = await Device.create({
    workspaceId: session.workspaceId,
    userId,
    name: deviceName,
    type: deviceType,
    status: DEVICE_STATUS.PENDING,
    deviceFingerprint: crypto.randomUUID(),
  });

  session.newDeviceId = device._id;
  session.newDeviceName = deviceName;
  session.newDeviceType = deviceType;
  await session.save();

  return {
    sessionId: session._id,
    verificationCode: session.verificationCode,
    deviceId: device._id,
  };
}

export async function confirmPairing(sessionId, verificationCode) {
  const session = await PairingSession.findById(sessionId);
  if (!session || session.status !== 'pending') {
    throw badRequest(ERROR_CODES.PAIRING_EXPIRED, 'Invalid or expired pairing session');
  }

  if (new Date() > session.expiresAt) {
    session.status = 'expired';
    await session.save();
    throw badRequest(ERROR_CODES.PAIRING_EXPIRED, 'Pairing session expired');
  }

  if (verificationCode && verificationCode !== session.verificationCode) {
    throw badRequest(ERROR_CODES.AUTH_ERROR, 'Invalid verification code');
  }

  session.status = 'accepted';
  session.usedAt = new Date();
  await session.save();

  const device = await Device.findByIdAndUpdate(
    session.newDeviceId,
    { status: DEVICE_STATUS.ACTIVE },
    { new: true }
  ).select('-sessionToken -deviceFingerprint');

  if (!device) {
    throw notFound(ERROR_CODES.DEVICE_NOT_FOUND, 'Paired device not found');
  }

  return { device, workspaceId: session.workspaceId };
}

export async function getDeviceByFingerprint(workspaceId, fingerprint) {
  const device = await Device.findOne({
    workspaceId,
    deviceFingerprint: fingerprint,
    status: DEVICE_STATUS.ACTIVE,
  });

  return device;
}

export async function updateDeviceSyncTime(deviceId) {
  await Device.findByIdAndUpdate(deviceId, { lastSyncAt: new Date() });
}
