import express from "express";
import fsp from "fs/promises";
import path from "path";
import { hashPassword, verifyPassword, signToken, requireAuth } from "./auth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {import("pg").Pool} pool
 * @param {string} uploadsRoot
 * @param {{ info: Function, success: Function, error: Function }} log
 */
export function createAuthRouter(pool, uploadsRoot, log) {
  const r = express.Router();

  r.post("/api/auth/register", async (req, res) => {
    try {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || "");
      const displayName = String(req.body?.displayName || "").trim();

      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });
      if (password.length < 6) return res.status(400).json({ error: "password_too_short" });
      if (displayName.length < 2 || displayName.length > 80) return res.status(400).json({ error: "invalid_display_name" });

      // display_name должен быть уникален (case-insensitive)
      const dnDup = await pool.query(`SELECT id FROM users WHERE lower(display_name) = lower($1) LIMIT 1`, [displayName]);
      if (dnDup.rows.length > 0) return res.status(409).json({ error: "display_name_taken" });

      const passwordHash = await hashPassword(password);
      const ins = await pool.query(
        `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name`,
        [email, passwordHash, displayName]
      );
      const user = ins.rows[0];
      const token = signToken({ sub: user.id, email: user.email });
      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 3600 * 1000,
        path: "/",
      });
      log.success(`User registered: ${email}`);
      res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
    } catch (e) {
      if (e.code === "23505") {
        // На случай гонки: уточняем, что именно конфликтует.
        try {
          const [emailDup, dnDup] = await Promise.all([
            pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]),
            pool.query(`SELECT id FROM users WHERE lower(display_name) = lower($1) LIMIT 1`, [displayName]),
          ]);
          if (dnDup.rows.length > 0) return res.status(409).json({ error: "display_name_taken" });
          if (emailDup.rows.length > 0) return res.status(409).json({ error: "email_taken" });
        } catch {}
        return res.status(409).json({ error: "email_taken" });
      }
      log.error("register failed", e.message);
      res.status(500).json({ error: "register_failed" });
    }
  });

  r.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || !password) return res.status(400).json({ error: "invalid_credentials" });

      const q = await pool.query(`SELECT id, email, password_hash, display_name FROM users WHERE email = $1`, [email]);
      if (q.rows.length === 0) return res.status(401).json({ error: "invalid_credentials" });

      const row = q.rows[0];
      const ok = await verifyPassword(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "invalid_credentials" });

      const token = signToken({ sub: row.id, email: row.email });
      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 3600 * 1000,
        path: "/",
      });
      res.json({ user: { id: row.id, email: row.email, displayName: row.display_name } });
    } catch (e) {
      log.error("login failed", e.message);
      res.status(500).json({ error: "login_failed" });
    }
  });

  r.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token", { path: "/" });
    res.json({ ok: true });
  });

  r.get("/api/me", requireAuth, async (req, res) => {
    try {
      const q = await pool.query(`SELECT id, email, display_name FROM users WHERE id = $1`, [req.userId]);
      if (q.rows.length === 0) return res.status(401).json({ error: "unauthorized" });
      const u = q.rows[0];
      res.json({ user: { id: u.id, email: u.email, displayName: u.display_name } });
    } catch (e) {
      log.error("me failed", e.message);
      res.status(500).json({ error: "me_failed" });
    }
  });

  r.delete("/api/users/me", requireAuth, async (req, res) => {
    try {
      const password = String(req.body?.password || "");
      if (password.length < 1) return res.status(400).json({ error: "password_required" });

      const q = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.userId]);
      if (q.rows.length === 0) return res.status(404).json({ error: "not_found" });

      const ok = await verifyPassword(password, q.rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: "invalid_password" });

      const userDir = path.join(uploadsRoot, req.userId);
      await fsp.rm(userDir, { recursive: true, force: true }).catch(() => {});

      await pool.query(`DELETE FROM users WHERE id = $1`, [req.userId]);
      res.clearCookie("token", { path: "/" });
      log.success(`User deleted: ${req.userId}`);
      res.json({ ok: true });
    } catch (e) {
      log.error("delete user failed", e.message);
      res.status(500).json({ error: "delete_user_failed" });
    }
  });

  /** Опционально: точка на карте для PostGIS (широта/долгота WGS84) */
  r.patch("/api/me/location", requireAuth, async (req, res) => {
    try {
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: "invalid_coords" });
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ error: "invalid_coords" });

      await pool.query(`UPDATE users SET lng = $1, lat = $2 WHERE id = $3`, [lng, lat, req.userId]);
      res.json({ ok: true });
    } catch (e) {
      log.error("location update failed", e.message);
      res.status(500).json({ error: "location_failed" });
    }
  });

  return r;
}
