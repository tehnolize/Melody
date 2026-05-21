import { verifyToken } from '../services/tokenService.js';

/**
 * Middleware: проверяет JWT из cookie, добавляет req.userId
 */
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const payload = verifyToken(token);
    if (typeof payload.sub !== 'string') return res.status(401).json({ error: 'unauthorized' });
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

/**
 * Middleware: опциональная авторизация (не блокирует запрос)
 */
export function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.token;
    if (token) {
      const payload = verifyToken(token);
      if (typeof payload.sub === 'string') {
        req.userId = payload.sub;
        req.userEmail = payload.email;
      }
    }
  } catch {
    // ignore
  }
  next();
}
