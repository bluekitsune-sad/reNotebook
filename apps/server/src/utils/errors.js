import { AppError, ERROR_CODES } from '@synced-notepad/shared';

export class ValidationError extends AppError {
  constructor(message) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(ERROR_CODES.AUTH_ERROR, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(ERROR_CODES.PERMISSION_DENIED, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(ERROR_CODES.NOT_FOUND, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict detected') {
    super(ERROR_CODES.CONFLICT, message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(ERROR_CODES.RATE_LIMITED, message, 429);
  }
}

export function formatErrorResponse(err, req) {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };
  }

  return {
    code: ERROR_CODES.SERVER_ERROR,
    message: 'Internal server error',
  };
}

export function isKnownError(err) {
  return err instanceof AppError;
}
