const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 100_000;
const MAX_STRING_LENGTH = 10_000;
const HTML_TAG_REGEX = /<[^>]*>/g;

function stripHtmlTags(value) {
  if (typeof value !== 'string') return value;
  return value.replace(HTML_TAG_REGEX, '');
}

function truncate(value, maxLen) {
  if (typeof value !== 'string') return value;
  if (value.length > maxLen) return value.slice(0, maxLen);
  return value;
}

function sanitizeObject(obj, rules) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  for (const [key, maxLen] of Object.entries(rules)) {
    if (sanitized[key] !== undefined && sanitized[key] !== null) {
      sanitized[key] = truncate(stripHtmlTags(sanitized[key]), maxLen);
    }
  }
  return sanitized;
}

function sanitizeStringFields(obj, maxLen) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key] = truncate(stripHtmlTags(value), maxLen);
    }
  }
  return sanitized;
}

export function sanitizeNoteBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body, {
      title: MAX_TITLE_LENGTH,
      content: MAX_CONTENT_LENGTH,
    });
  }
  next();
}

export function sanitizeSyncBody(req, res, next) {
  if (req.body?.changes && Array.isArray(req.body.changes)) {
    req.body.changes = req.body.changes.map((change) => {
      if (change.payload && typeof change.payload === 'object') {
        change.payload = sanitizeObject(change.payload, {
          title: MAX_TITLE_LENGTH,
          content: MAX_CONTENT_LENGTH,
          folder: MAX_STRING_LENGTH,
        });
      }
      return change;
    });
  }
  if (req.body?.cursor && typeof req.body.cursor === 'string') {
    req.body.cursor = truncate(req.body.cursor, 1024);
  }
  next();
}

export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeStringFields(req.body, MAX_STRING_LENGTH);
  }
  next();
}
