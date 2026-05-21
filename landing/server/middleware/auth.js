import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const SALT_ROUNDS = 10;

/**
 * Возвращает секрет для JWT из переменных окружения.
 * @returns {string} Секретный ключ.
 * @throws {Error} Если JWT_SECRET не задан или короче 16 символов.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 characters)');
  }
  return secret.trim();
}

/**
 * Хеширует пароль.
 * @param {string} password - Пароль в открытом виде.
 * @returns {Promise<string>} Хеш пароля.
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Проверяет пароль на соответствие хешу.
 * @param {string} password - Пароль в открытом виде.
 * @param {string} hash - Хеш для сравнения.
 * @returns {Promise<boolean>} true, если пароль верен.
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Создает JWT токен.
 * @param {!{sub: string, email: string}} payload - Данные для токена.
 * @returns {string} JWT токен.
 */
export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Проверяет и декодирует JWT токен.
 * @param {string} token - JWT токен.
 * @returns {jwt.JwtPayload} Полезная нагрузка токена.
 */
export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * Middleware для обязательной аутентификации.
 * @param {Request} req - Запрос Express.
 * @param {Response} res - Ответ Express.
 * @param {NextFunction} next - Следующий middleware.
 */
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies ? req.cookies.token : null;
    if (!token) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const payload = verifyToken(token);
    if (typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'unauthorized' });
    }
    res.locals.userId = payload.sub;
    res.locals.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

/**
 * Middleware для опциональной аутентификации.
 * @param {Request} req - Запрос Express.
 * @param {Response} res - Ответ Express.
 * @param {NextFunction} next - Следующий middleware.
 */
export function optionalAuth(req, res, next) {
  try {
    const token = req.cookies ? req.cookies.token : null;
    if (token) {
      const payload = verifyToken(token);
      if (typeof payload.sub === 'string') {
        res.locals.userId = payload.sub;
        res.locals.userEmail = payload.email;
      }
    }
  } catch {
    // Игнорируем ошибки, так как аутентификация опциональна
  }
  next();
}
