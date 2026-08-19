import bcrypt from 'bcryptjs';
import { User, Workspace, Device } from '../models/index.js';
import { generateToken } from '../middleware/auth.js';
import { badRequest, unauthorized, notFound, ERROR_CODES } from '@synced-notepad/shared';

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function register(email, password, displayName, workspaceName) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Email already registered');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    displayName,
  });

  const workspace = await Workspace.create({
    ownerId: user._id,
    name: workspaceName || `${displayName}'s Workspace`,
  });

  const device = await Device.create({
    workspaceId: workspace._id,
    userId: user._id,
    name: 'First Device',
    type: 'web',
    status: 'active',
    deviceFingerprint: crypto.randomUUID(),
    sessionToken: crypto.randomUUID(),
  });

  const token = generateToken({
    userId: user._id.toString(),
    deviceId: device._id.toString(),
    workspaceId: workspace._id.toString(),
  });

  return {
    user: { id: user._id, email: user.email, displayName: user.displayName },
    workspace: { id: workspace._id, name: workspace.name },
    device: { id: device._id, name: device.name, type: device.type },
    token,
  };
}

export async function login(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw unauthorized(ERROR_CODES.AUTH_ERROR, 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw unauthorized(ERROR_CODES.AUTH_ERROR, 'Invalid email or password');
  }

  const workspace = await Workspace.findOne({ ownerId: user._id });
  if (!workspace) {
    throw notFound(ERROR_CODES.WORKSPACE_NOT_FOUND, 'Workspace not found');
  }

  const device = await Device.create({
    workspaceId: workspace._id,
    userId: user._id,
    name: 'New Session',
    type: 'web',
    status: 'active',
    deviceFingerprint: crypto.randomUUID(),
    sessionToken: crypto.randomUUID(),
  });

  const token = generateToken({
    userId: user._id.toString(),
    deviceId: device._id.toString(),
    workspaceId: workspace._id.toString(),
  });

  return {
    user: { id: user._id, email: user.email, displayName: user.displayName },
    workspace: { id: workspace._id, name: workspace.name },
    device: { id: device._id, name: device.name, type: device.type },
    token,
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    throw notFound(ERROR_CODES.NOT_FOUND, 'User not found');
  }

  const workspace = await Workspace.findOne({ ownerId: userId });

  return {
    user: { id: user._id, email: user.email, displayName: user.displayName },
    workspace: workspace ? { id: workspace._id, name: workspace.name } : null,
  };
}
