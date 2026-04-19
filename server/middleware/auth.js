import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import db from '../db.js';

// JWT secret — generated once per server instance, stored in settings
function getJwtSecret() {
  let row = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get();
  if (!row) {
    const secret = randomBytes(64).toString('hex');
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('jwt_secret', ?)").run(secret);
    row = { value: secret };
  }
  return row.value;
}

// Simple JWT implementation using HMAC-SHA256 (no external dependency)
function createToken(payload, expiresInHours = 24) {
  const secret = getJwtSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + expiresInHours * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ ...payload, exp, iat: Date.now() })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const secret = getJwtSecret();
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expectedSig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch { return null; }
}

// Password hashing
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const supplied = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, supplied);
}

// Auth middleware — check JWT token
export function requireAuth(req, res, next) {
  // Skip auth for public routes (path may or may not have /api prefix depending on mount point)
  const fullPath = req.originalUrl || req.path;
  if (fullPath.includes('/auth/login') || fullPath.includes('/health')) {
    return next();
  }

  // Accept token from header or query param (needed for SSE EventSource which can't set headers)
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  } else {
    return res.status(401).json({ error: 'Token de autenticacion requerido' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }

  // Verify user still exists and is enabled
  const user = db.prepare('SELECT id, username, display_name, role, enabled, must_change_password FROM users WHERE id = ?').get(payload.userId);
  if (!user || !user.enabled) {
    return res.status(401).json({ error: 'Usuario deshabilitado o no encontrado' });
  }

  req.user = user;
  next();
}

// Role check middleware
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Rol ${req.user.role} no tiene permiso. Se requiere: ${roles.join(' o ')}` });
    }
    next();
  };
}

export { createToken, verifyToken };
