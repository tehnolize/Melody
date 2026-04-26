import { getUserTracks, createTrack, deleteTracks, searchTracks } from '../services/trackService.js';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { randomUUID } from 'crypto';
import multer from 'multer';

function isInside(base, target) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export async function getTracks(req, res) {
  try {
    const rows = await getUserTracks(req.pool, req.userId);
    const tracks = rows.map((t) => ({
      ...t,
      file: t.original_name || t.title || '',
      url: `/music/${t.user_id}/${encodeURIComponent(t.storage_name)}`,
      owned: true,
    }));
    res.json({ tracks });
  } catch (e) {
    res.status(500).json({ error: 'tracks_failed' });
  }
}

export function createUploadMiddleware(uploadsRoot) {
  return multer({
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
      filename: (_req, _file, cb) => {
        cb(null, `${randomUUID()}.mp3`);
      },
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = file.originalname.toLowerCase().endsWith('.mp3');
      cb(ok ? null : new Error('only_mp3'), ok);
    },
  });
}

export async function uploadTracks(req, res) {
  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ ok: false, error: 'no_files' });

  try {
    for (const f of files) {
      const base = path.basename(f.originalname, path.extname(f.originalname));
      const title = base.replace(/[\\\/]+/g, '_').trim() || 'track';
      await createTrack(req.pool, {
        userId: req.userId,
        title,
        storageName: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype || 'audio/mpeg',
        filePath: f.path,
        fileSize: f.size,
      });
    }
    res.json({ ok: true, count: files.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'upload_failed' });
  }
}

export async function deleteTracksHandler(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map((v) => String(v || '').trim()).filter(Boolean))]
      : [];
    if (ids.length === 0) return res.status(400).json({ ok: false, error: 'no_tracks_selected' });

    const result = await deleteTracks(req.pool, ids, req.userId, req.uploadsRoot);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'delete_tracks_failed' });
  }
}

export async function streamTrack(req, res) {
  try {
    const ownerId = String(req.params.ownerId || '');
    const storageName = decodeURIComponent(String(req.params.storageName || ''));

    if (!ownerId || !storageName || storageName.includes('..') || !storageName.toLowerCase().endsWith('.mp3')) {
      return res.status(400).end();
    }

    const q = await req.pool.query(
      `SELECT id FROM tracks WHERE user_id = $1 AND storage_name = $2`,
      [ownerId, storageName]
    );
    if (q.rows.length === 0) return res.status(404).end();

    const uploadsRoot = req.uploadsRoot;
    const full = path.join(uploadsRoot, ownerId, storageName);
    if (!isInside(path.join(uploadsRoot, ownerId), full)) return res.status(400).end();

    const st = await fsp.stat(full);
    if (!st.isFile()) return res.status(404).end();

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');

    const range = req.headers.range;
    if (!range) {
      res.setHeader('Content-Length', st.size);
      fs.createReadStream(full).pipe(res);
      return;
    }

    const m = /^bytes=(\d+)-(\d+)?$/i.exec(range);
    if (!m) return res.status(416).end();

    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : st.size - 1;
    if (start >= st.size || end >= st.size || start > end) return res.status(416).end();

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(full, { start, end }).pipe(res);
  } catch {
    res.status(404).end();
  }
}

export async function searchTracksHandler(req, res) {
  try {
    const title = String(req.query.q || '').trim();
    const owner = String(req.query.owner || '').trim();
    const results = await searchTracks(req.pool, { title, owner });
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: 'search_failed' });
  }
}
