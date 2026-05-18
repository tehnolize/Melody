import { hashPassword, verifyPassword } from './passwordService.js';
import { signToken } from './tokenService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Регистрация пользователя
 * @param {import('pg').Pool} pool
 * @param {{ email: string, password: string, displayName: string }} data
 */
export async function registerUser(pool, { email, password, displayName }) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  displayName = String(displayName || '').trim();

  if (!EMAIL_RE.test(email)) throw { status: 400, error: 'invalid_email' };
  const hasLetter = /[A-Za-zА-Яа-я]/.test(password);
  const hasDigit = /\d/.test(password);
  if (password.length < 12 || !hasLetter || !hasDigit) throw { status: 400, error: 'password_too_weak' };
  if (displayName.length < 2 || displayName.length > 80) throw { status: 400, error: 'invalid_display_name' };

  const dnDup = await pool.query(
    `SELECT id FROM users WHERE lower(display_name) = lower($1) LIMIT 1`,
    [displayName]
  );
  if (dnDup.rows.length > 0) throw { status: 409, error: 'display_name_taken' };

  const passwordHash = await hashPassword(password);
  const ins = await pool.query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name`,
    [email, passwordHash, displayName]
  );
  const user = ins.rows[0];
  const token = signToken({ sub: user.id, email: user.email });
  return { user: { id: user.id, email: user.email, displayName: user.display_name }, token };
}

/**
 * Авторизация пользователя
 * @param {import('pg').Pool} pool
 * @param {{ email: string, password: string }} data
 */
export async function loginUser(pool, { email, password }) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (!email || !password) throw { status: 400, error: 'invalid_credentials' };

  const q = await pool.query(
    `SELECT id, email, password_hash, display_name FROM users WHERE email = $1`,
    [email]
  );
  if (q.rows.length === 0) throw { status: 401, error: 'invalid_credentials' };

  const row = q.rows[0];
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) throw { status: 401, error: 'invalid_credentials' };

  const token = signToken({ sub: row.id, email: row.email });
  return { user: { id: row.id, email: row.email, displayName: row.display_name }, token };
}

/**
 * Получить текущего пользователя
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
export async function getMe(pool, userId) {
  const q = await pool.query(
    `SELECT id, email, display_name, bio, avatar_url, created_at FROM users WHERE id = $1`,
    [userId]
  );
  if (q.rows.length === 0) throw { status: 401, error: 'unauthorized' };
  const u = q.rows[0];
  return { id: u.id, email: u.email, displayName: u.display_name, bio: u.bio, avatarUrl: u.avatar_url, createdAt: u.created_at };
}

/**
 * Удалить аккаунт пользователя
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {string} password
 */
export async function deleteUser(pool, userId, password) {
  const q = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  if (q.rows.length === 0) throw { status: 404, error: 'not_found' };
  const ok = await verifyPassword(password, q.rows[0].password_hash);
  if (!ok) throw { status: 401, error: 'invalid_password' };
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}
