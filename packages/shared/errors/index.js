export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_CHANGE: 'INVALID_CHANGE',
  CONFLICT: 'CONFLICT',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  SYNC_PROTOCOL_UNSUPPORTED: 'SYNC_PROTOCOL_UNSUPPORTED',
  PAIRING_EXPIRED: 'PAIRING_EXPIRED',
  PAIRING_ALREADY_USED: 'PAIRING_ALREADY_USED',
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  REVISION_NOT_FOUND: 'REVISION_NOT_FOUND',
};

export function unauthorized(code, message) {
  return new AppError(code, message, 401);
}

export function forbidden(code, message) {
  return new AppError(code, message, 403);
}

export function notFound(code, message) {
  return new AppError(code, message, 404);
}

export function badRequest(code, message) {
  return new AppError(code, message, 400);
}

export function conflict(code, message) {
  return new AppError(code, message, 409);
}

export function serverError(code, message) {
  return new AppError(code, message, 500);
}
