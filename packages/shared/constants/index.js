export const DEVICE_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REVOKED: 'revoked',
};

export const NOTE_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
};

export const SYNC_STATE = {
  IDLE: 'idle',
  CHECKING: 'checking',
  PULLING: 'pulling',
  APPLYING: 'applying',
  PUSHING: 'pushing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

export const CHANGE_TYPES = {
  NOTE_CREATED: 'note.created',
  NOTE_UPDATED: 'note.updated',
  NOTE_DELETED: 'note.deleted',
  NOTE_RESTORED: 'note.restored',
  NOTE_VISIBILITY_CHANGED: 'note.visibility_changed',
  DEVICE_PAIRED: 'device.paired',
  DEVICE_REVOKED: 'device.revoked',
};

export const CONFLICT_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
};

export const CONFLICT_RESOLUTION = {
  KEEP_VERSION: 'keep_version',
  MERGE: 'merge',
  KEEP_BOTH: 'keep_both',
};

export const PAIRING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  USED: 'used',
};

export const SYNC_PROTOCOL_VERSION = 1;
export const APP_VERSION = '0.1.0';

export const QR_EXPIRY_MINUTES = 5;
export const MAX_SYNC_CHANGES_PER_REQUEST = 100;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX = 100;
