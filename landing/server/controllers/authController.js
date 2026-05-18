import { registerUser, loginUser, getMe, deleteUser } from '../services/userService.js';
import fsp from 'fs/promises';
import path from 'path';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
};

export async function register(req, res) {
  try {
    const { user, token } = await registerUser(req.pool, req.body);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'register_failed' });
  }
}

export async function login(req, res) {
  try {
    const { user, token } = await loginUser(req.pool, req.body);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'login_failed' });
  }
}

export function logout(_req, res) {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
}

export async function me(req, res) {
  try {
    const user = await getMe(req.pool, req.userId);
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'me_failed' });
  }
}

export async function deleteAccount(req, res) {
  try {
    const password = String(req.body?.password || '');
    if (!password) return res.status(400).json({ error: 'password_required' });

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
