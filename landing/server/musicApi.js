import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth, optionalAuth } from "./auth.js";

function isInside(base, target) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function displayFileName(title, ownerName) {
  const safe = String(title || "").trim() || "track";
  return ownerName ? `${ownerName} — ${safe}.mp3` : `${safe}.mp3`;
}

function trackRowToClient(row) {
  const title = row.title;
  const ownerId = row.user_id;
  const ownerName = row.owner_name;
  const storage = row.storage_name;
  const url = `/music/${ownerId}/${encodeURIComponent(storage)}`;
  return {
    id: row.id,
    title,
    file: displayFileName(title, ownerName),
    url,
    ownerId,
    ownerName,
    owned: !!row.owned,
  };
}

/**
 * @param {import("pg").Pool} pool
 * @param {string} uploadsRoot
 * @param {{ info: Function, success: Function, error: Function, warn: Function }} log
 */
export function createMusicRouter(pool, uploadsRoot, log) {
  const r = express.Router();

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (req, _file, cb) => {
        try {
          const dir = path.join(uploadsRoot, req.userId);
          await fsp.mkdir(dir, { recursive: true });
          cb(null, dir);
        } catch (e) {
          cb(e);
        }
      },
      filename: (_req, file, cb) => {
        const id = randomUUID();
        cb(null, `${id}.mp3`);
      },
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = file.originalname.toLowerCase().endsWith(".mp3");
      cb(ok ? null : new Error("only_mp3"), ok);
    },
  });

  /** Библиотека: свои треки + треки из своих альбомов */
  r.get("/api/tracks", requireAuth, async (req, res) => {
    try {
      const uid = req.userId;
      // В текущей модели:
      // - Файлы физически всегда хранятся в каталоге пользователя (uploads/<userId>/...)
      // - Альбомы — это только сортировка/ссылки (album_tracks), но музыка берется из профиля.
      // Поэтому библиотека = все загруженные пользователем треки.
      const q = await pool.query(
        `
        SELECT t.id, t.user_id, t.title, t.storage_name, u.display_name AS owner_name, TRUE AS owned
        FROM tracks t
        JOIN users u ON u.id = t.user_id
        WHERE t.user_id = $1
        ORDER BY lower(title) ASC
        `,
        [uid]
      );
      const tracks = q.rows.map((row) => trackRowToClient(row));
      res.json({ tracks });
    } catch (e) {
      log.error("tracks list failed", e.message);
      res.status(500).json({ error: "tracks_failed" });
    }
  });

  r.post(
    "/api/upload",
    requireAuth,
    (req, res, next) => {
      upload.array("files", 200)(req, res, (err) => {
        if (err)
          return res.status(400).json({
            ok: false,
            error: err.message === "only_mp3" ? "only_mp3" : "upload_failed",
          });
        next();
      });
    },
    async (req, res) => {
      const files = req.files || [];
      if (files.length === 0) return res.status(400).json({ ok: false, error: "no_files" });

      try {
        for (const f of files) {
          const storageName = f.filename;
          const base = path.basename(f.originalname, path.extname(f.originalname));
          const title = base.replace(/[\\/]+/g, "_").trim() || "track";
          await pool.query(`INSERT INTO tracks (user_id, title, storage_name) VALUES ($1, $2, $3)`, [
            req.userId,
            title,
            storageName,
          ]);
        }
        log.success(`Uploaded ${files.length} file(s) for user ${req.userId}`);
        res.json({ ok: true, count: files.length });
      } catch (e) {
        log.error("upload db failed", e.message);
        res.status(500).json({ ok: false, error: "upload_failed" });
      }
    }
  );

  r.post("/api/tracks/delete", requireAuth, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const uniqueIds = [...new Set(ids.map((v) => String(v || "").trim()).filter(Boolean))];
      if (uniqueIds.length === 0) return res.status(400).json({ ok: false, error: "no_tracks_selected" });

      const deleted = [];
      const failed = [];

      for (const id of uniqueIds) {
        const q = await pool.query(`SELECT id, user_id, storage_name FROM tracks WHERE id = $1`, [id]);
        if (q.rows.length === 0) {
          failed.push({ id, reason: "not_found" });
          continue;
        }
        const row = q.rows[0];
        if (row.user_id !== req.userId) {
          failed.push({ id, reason: "not_owner" });
          continue;
        }
        const full = path.join(uploadsRoot, row.user_id, row.storage_name);
        try {
          await fsp.unlink(full);
        } catch (e) {
          if (e?.code !== "ENOENT") {
            failed.push({ id, reason: "delete_failed" });
            continue;
          }
        }
        await pool.query(`DELETE FROM tracks WHERE id = $1`, [id]);
        deleted.push(id);
      }

      return res.json({ ok: true, deleted, failed });
    } catch (e) {
      log.error("delete tracks failed", e.message);
      return res.status(500).json({ ok: false, error: "delete_tracks_failed" });
    }
  });

  /**
   * Копирование чужого трека в профиль пользователя.
   * Если указан replaceInAlbumId — заменяет ссылку на трек в альбоме (чтобы в очереди метка "свой/чужой" обновилась).
   */
  r.post("/api/tracks/copy", requireAuth, async (req, res) => {
    try {
      const trackId = String(req.body?.trackId || "").trim();
      const replaceInAlbumId = req.body?.replaceInAlbumId ? String(req.body.replaceInAlbumId) : "";
      if (!trackId) return res.status(400).json({ ok: false, error: "no_trackId" });

      const srcQ = await pool.query(`SELECT id, user_id, title, storage_name FROM tracks WHERE id = $1`, [trackId]);
      if (srcQ.rows.length === 0) return res.status(404).json({ ok: false, error: "track_not_found" });

      const src = srcQ.rows[0];
      if (src.user_id === req.userId) return res.status(400).json({ ok: false, error: "already_owned" });

      const srcFull = path.join(uploadsRoot, src.user_id, src.storage_name);
      const targetDir = path.join(uploadsRoot, req.userId);

      await fsp.mkdir(targetDir, { recursive: true });

      // Новый storage_name генерируем случайно, чтобы не конфликтовать с существующими файлами пользователя.
      const newStorageName = `${randomUUID()}.mp3`;
      const targetFull = path.join(targetDir, newStorageName);

      await fsp.copyFile(srcFull, targetFull);

      const ins = await pool.query(
        `INSERT INTO tracks (user_id, title, storage_name) VALUES ($1, $2, $3) RETURNING id`,
        [req.userId, src.title, newStorageName]
      );
      const newTrackId = ins.rows[0]?.id;

      if (!newTrackId) return res.status(500).json({ ok: false, error: "copy_insert_failed" });

      if (replaceInAlbumId) {
        const aq = await pool.query(`SELECT id FROM albums WHERE id = $1 AND user_id = $2`, [replaceInAlbumId, req.userId]);
        if (aq.rows.length) {
          await pool.query(
            `DELETE FROM album_tracks WHERE album_id = $1 AND track_id = $2`,
            [replaceInAlbumId, trackId]
          );
          await pool.query(
            `INSERT INTO album_tracks (album_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [replaceInAlbumId, newTrackId]
          );
        }
      }

      return res.json({ ok: true, newTrackId });
    } catch (e) {
      log.error("track copy failed", e?.message);
      res.status(500).json({ ok: false, error: "track_copy_failed" });
    }
  });

  /** Поток: только если трек есть в БД */
  r.get("/music/:ownerId/:storageName", optionalAuth, async (req, res) => {
    try {
      const ownerId = String(req.params.ownerId || "");
      const storageName = decodeURIComponent(String(req.params.storageName || ""));
      if (!ownerId || !storageName || storageName.includes("..") || !storageName.toLowerCase().endsWith(".mp3")) {
        return res.status(400).end();
      }

      // Поток отдается только для трека, который существует в БД у конкретного владельца.
      const q = await pool.query(`SELECT id FROM tracks WHERE user_id = $1 AND storage_name = $2`, [ownerId, storageName]);
      if (q.rows.length === 0) return res.status(404).end();

      const full = path.join(uploadsRoot, ownerId, storageName);
      if (!isInside(path.join(uploadsRoot, ownerId), full)) return res.status(400).end();

      const st = await fsp.stat(full);
      if (!st.isFile()) return res.status(404).end();

      const range = req.headers.range;
      const contentType = "audio/mpeg";
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Type", contentType);

      if (!range) {
        res.setHeader("Content-Length", st.size);
        fs.createReadStream(full).pipe(res);
        return;
      }

      const m = /^bytes=(\d+)-(\d+)?$/i.exec(range);
      if (!m) {
        res.status(416).end();
        return;
      }

      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : st.size - 1;
      if (start >= st.size || end >= st.size || start > end) {
        res.status(416).end();
        return;
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${st.size}`);
      res.setHeader("Content-Length", end - start + 1);
      fs.createReadStream(full, { start, end }).pipe(res);
    } catch {
      res.status(404).end();
    }
  });

  r.get("/api/search", requireAuth, async (req, res) => {
    try {
      const rawTitle = String(req.query.q || "").trim();
      const rawOwner = String(req.query.owner || "").trim();

      const titleOk = rawTitle.length >= 2;
      const ownerOk = rawOwner.length >= 2;

      // Разрешаем поиск:
      // По требованиям UX:
      // - поиск всегда требует поле названия трека (q) >= 2
      // - поле "Пользователь" (owner) опционально и применяется только если titleOk=true
      if (!titleOk) return res.json({ results: [] });

      const params = [];
      let where = `WHERE 1=1`;

      const q = `%${rawTitle.slice(0, 120)}%`;
      params.push(q);
      where += ` AND t.title ILIKE $${params.length}`;

      if (ownerOk) {
        const ownerLike = `%${rawOwner.slice(0, 120)}%`;
        params.push(ownerLike);
        where += ` AND u.display_name ILIKE $${params.length}`;
      }

      const r0 = await pool.query(
        `
        SELECT t.id AS track_id, t.title, t.user_id AS owner_id, u.display_name AS owner_name
        FROM tracks t
        JOIN users u ON u.id = t.user_id
        ${where}
        ORDER BY u.display_name ASC, t.title ASC
        LIMIT 50
        `,
        params
      );

      res.json({ results: r0.rows });
    } catch (e) {
      log.error("search failed", e.message);
      res.status(500).json({ error: "search_failed" });
    }
  });

  /** Мои загрузки (профиль) */
  r.get("/api/profile/me", requireAuth, async (req, res) => {
    try {
      const uq = await pool.query(
        `SELECT id, display_name, email, created_at, lat, lng FROM users WHERE id = $1`,
        [req.userId]
      );
      if (uq.rows.length === 0) return res.status(404).json({ error: "not_found" });
      const u = uq.rows[0];
      const tq = await pool.query(
        `
        SELECT
          t.id,
          t.title,
          t.storage_name,
          t.created_at,
          COALESCE(
            array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL),
            ARRAY[]::uuid[]
          ) AS album_ids
        FROM tracks t
        LEFT JOIN album_tracks at ON at.track_id = t.id
        LEFT JOIN albums a ON a.id = at.album_id AND a.user_id = $1
        WHERE t.user_id = $1
        GROUP BY t.id, t.title, t.storage_name, t.created_at
        ORDER BY t.created_at DESC
        `,
        [req.userId]
      );
      const tracks = tq.rows.map((row) => ({
        id: row.id,
        title: row.title,
        file: displayFileName(row.title, u.display_name),
        url: `/music/${req.userId}/${encodeURIComponent(row.storage_name)}`,
        albumIds: Array.isArray(row.album_ids) ? row.album_ids : [],
      }));
      res.json({
        user: {
          id: u.id,
          displayName: u.display_name,
          email: u.email,
          createdAt: u.created_at,
          location: u.lat != null && u.lng != null ? { lat: u.lat, lng: u.lng } : null,
        },
        tracks,
      });
    } catch (e) {
      log.error("profile me failed", e.message);
      res.status(500).json({ error: "profile_failed" });
    }
  });

  /** Публичный профиль другого пользователя */
  r.get("/api/users/:userId/profile", async (req, res) => {
    try {
      const userId = String(req.params.userId || "");
      const uq = await pool.query(`SELECT id, display_name, created_at FROM users WHERE id = $1`, [userId]);
      if (uq.rows.length === 0) return res.status(404).json({ error: "not_found" });
      const u = uq.rows[0];
      const tq = await pool.query(
        `SELECT id, title, storage_name, created_at FROM tracks WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      const tracks = tq.rows.map((row) => ({
        id: row.id,
        title: row.title,
        file: displayFileName(row.title, u.display_name),
        url: `/music/${userId}/${encodeURIComponent(row.storage_name)}`,
      }));
      res.json({
        user: { id: u.id, displayName: u.display_name, createdAt: u.created_at },
        tracks,
      });
    } catch (e) {
      log.error("public profile failed", e.message);
      res.status(500).json({ error: "profile_failed" });
    }
  });

  r.post("/api/albums", requireAuth, async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      if (name.length < 1 || name.length > 120) return res.status(400).json({ error: "invalid_name" });

      const dup = await pool.query(
        `SELECT id FROM albums WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1`,
        [req.userId, name]
      );
      if (dup.rows.length > 0) return res.status(409).json({ error: "album_name_taken" });
      const ins = await pool.query(`INSERT INTO albums (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at`, [
        req.userId,
        name,
      ]);
      const row = ins.rows[0];
      res.json({ album: { id: row.id, name: row.name, createdAt: row.created_at } });
    } catch (e) {
      log.error("album create failed", e.message);
      res.status(500).json({ error: "album_create_failed" });
    }
  });

  r.get("/api/albums", requireAuth, async (req, res) => {
    try {
      const q = await pool.query(
        `
        SELECT a.id, a.name, a.created_at,
          (SELECT COUNT(*)::int FROM album_tracks at WHERE at.album_id = a.id) AS track_count
        FROM albums a
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        `,
        [req.userId]
      );
      res.json({ albums: q.rows });
    } catch (e) {
      log.error("albums list failed", e.message);
      res.status(500).json({ error: "albums_failed" });
    }
  });

  r.get("/api/albums/:albumId", requireAuth, async (req, res) => {
    try {
      const albumId = String(req.params.albumId || "");
      const aq = await pool.query(`SELECT id, name, user_id FROM albums WHERE id = $1`, [albumId]);
      if (aq.rows.length === 0) return res.status(404).json({ error: "not_found" });
      if (aq.rows[0].user_id !== req.userId) return res.status(403).json({ error: "forbidden" });

      const tq = await pool.query(
        `
        SELECT t.id, t.user_id, t.title, t.storage_name, u.display_name AS owner_name,
          (t.user_id = $2) AS owned
        FROM album_tracks at
        JOIN tracks t ON t.id = at.track_id
        JOIN users u ON u.id = t.user_id
        WHERE at.album_id = $1
        ORDER BY at.added_at ASC
        `,
        [albumId, req.userId]
      );
      const tracks = tq.rows.map((row) => trackRowToClient(row));
      res.json({ album: { id: aq.rows[0].id, name: aq.rows[0].name }, tracks });
    } catch (e) {
      log.error("album get failed", e.message);
      res.status(500).json({ error: "album_failed" });
    }
  });

  r.post("/api/albums/:albumId/tracks", requireAuth, async (req, res) => {
    try {
      const albumId = String(req.params.albumId || "");
      const trackId = String(req.body?.trackId || "").trim();
      if (!trackId) return res.status(400).json({ error: "no_track" });

      const aq = await pool.query(`SELECT id FROM albums WHERE id = $1 AND user_id = $2`, [albumId, req.userId]);
      if (aq.rows.length === 0) return res.status(404).json({ error: "album_not_found" });

      const tq = await pool.query(`SELECT id, user_id FROM tracks WHERE id = $1`, [trackId]);
      if (tq.rows.length === 0) return res.status(404).json({ error: "track_not_found" });
      if (tq.rows[0].user_id !== req.userId) return res.status(403).json({ error: "forbidden" });

      await pool.query(
        `INSERT INTO album_tracks (album_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [albumId, trackId]
      );
      res.json({ ok: true });
    } catch (e) {
      log.error("album add track failed", e.message);
      res.status(500).json({ error: "album_add_failed" });
    }
  });

  r.patch("/api/albums/:albumId", requireAuth, async (req, res) => {
    try {
      const albumId = String(req.params.albumId || "");
      const name = String(req.body?.name || "").trim();
      if (!name || name.length > 120) return res.status(400).json({ error: "invalid_name" });

      const dup = await pool.query(
        `SELECT id FROM albums WHERE user_id = $1 AND lower(name) = lower($2) AND id <> $3 LIMIT 1`,
        [req.userId, name, albumId]
      );
      if (dup.rows.length > 0) return res.status(409).json({ error: "album_name_taken" });
      const q = await pool.query(
        `UPDATE albums SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, created_at`,
        [name, albumId, req.userId]
      );
      if (q.rows.length === 0) return res.status(404).json({ error: "not_found" });
      res.json({ album: q.rows[0] });
    } catch (e) {
      log.error("album rename failed", e.message);
      res.status(500).json({ error: "album_rename_failed" });
    }
  });

  r.delete("/api/albums/:albumId/tracks/:trackId", requireAuth, async (req, res) => {
    try {
      const albumId = String(req.params.albumId || "");
      const trackId = String(req.params.trackId || "");
      const aq = await pool.query(`SELECT id FROM albums WHERE id = $1 AND user_id = $2`, [albumId, req.userId]);
      if (aq.rows.length === 0) return res.status(404).json({ error: "album_not_found" });

      await pool.query(`DELETE FROM album_tracks WHERE album_id = $1 AND track_id = $2`, [albumId, trackId]);
      res.json({ ok: true });
    } catch (e) {
      log.error("album remove track failed", e.message);
      res.status(500).json({ error: "album_remove_failed" });
    }
  });

  r.delete("/api/albums/:albumId", requireAuth, async (req, res) => {
    try {
      const albumId = String(req.params.albumId || "");
      const q = await pool.query(`DELETE FROM albums WHERE id = $1 AND user_id = $2 RETURNING id`, [albumId, req.userId]);
      if (q.rows.length === 0) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) {
      log.error("album delete failed", e.message);
      res.status(500).json({ error: "album_delete_failed" });
    }
  });

  return r;
}
