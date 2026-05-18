import jwt from 'jsonwebtoken';

export function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 characters)');
  }
  return s;
}

/**
 * @param {{ sub: string, email: string }} payload
 */
export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * @param {string} token
 */
export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}
