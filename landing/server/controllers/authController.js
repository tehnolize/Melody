import { registerUser, loginUser, getMe, deleteUser } from '../services/userService.js';
import fsp from 'fs/promises';
import path from 'path';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
};

/**
 * Registers a new user.
 *
 * @param {Object} req - Express request object (includes req.pool, req.body).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function register(req, res) {
  try {
    const { user, token } = await registerUser(req.pool, req.body);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'register_failed' });
  }
}

/**
 * Logs in an existing user.
 *
 * @param {Object} req - Express request object (includes req.pool, req.body).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function login(req, res) {
  try {
    const { user, token } = await loginUser(req.pool, req.body);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'login_failed' });
  }
}

/**
 * Logs out the user by clearing the token cookie.
 *
 * @param {Object} _req - Express request object (unused).
 * @param {Object} res - Express response object.
 * @returns {void}
 */
export function logout(_req, res) {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
}

/**
 * Retrieves the authenticated user's profile.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function me(req, res) {
  try {
    const user = await getMe(req.pool, req.userId);
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'me_failed' });
  }
}

/**
 * Deletes the authenticated user's account and removes associated uploaded files.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId, req.body, req.uploadsRoot).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function deleteAccount(req, res) {
  try {
    const password = String(req.body?.password || '');
    if (!password) {
      return res.status(400).json({ error: 'password_required' });
    }

    const uploadsRoot = req.uploadsRoot;
    const userDir = path.join(uploadsRoot, req.userId);
    await fsp.rm(userDir, { recursive: true, force: true }).catch(() => {});

    await deleteUser(req.pool, req.userId, password);
    res.clearCookie('token', { path: '/' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'delete_failed' });
  }
}
