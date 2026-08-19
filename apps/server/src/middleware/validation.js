import { badRequest, ERROR_CODES } from '@synced-notepad/shared';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map((e) => e.message).join(', ');
      return next(badRequest(ERROR_CODES.VALIDATION_ERROR, message));
    }
    req.validated = result.data;
    next();
  };
}
