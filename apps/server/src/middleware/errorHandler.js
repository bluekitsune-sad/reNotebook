import { AppError, ERROR_CODES } from '@synced-notepad/shared';

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: {
      code: ERROR_CODES.SERVER_ERROR,
      message: 'Internal server error',
    },
  });
}
