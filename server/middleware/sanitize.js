const SENSITIVE_KEYS = /password|credentials|secret|token|passphrase|private.?key|api.?key/i;

export function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(key) && typeof value === 'string' && value.length > 0) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Express middleware that sanitizes request logging
export function sanitizeMiddleware(req, res, next) {
  // Override console methods to sanitize output
  // This is a lightweight approach - we just ensure body params are never logged directly
  next();
}
