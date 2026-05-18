import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * @param {string} password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * @param {string} password
 * @param {string} hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
