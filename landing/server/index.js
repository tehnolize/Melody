import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import pg from 'pg';

import authRoutes from './routes/authRoutes.js';
import albumRoutes from './routes/albumRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import { createTrackRouter } from './routes/trackRoutes.js';

const { Pool } = pg;

const PORT = Number(process.env.PORT || 8787);
const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads');

if (!process.env.DATABASE_URL) {
  console.error('[ERROR] DATABASE_URL is not set');
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('[ERROR] JWT_SECRET is not set or too short');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Инициализация БД
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT        NOT NULL,
      password_hash TEXT        NOT NULL,
      display_name  TEXT        NOT NULL,
      bio           TEXT,
      avatar_url    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email))`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name ON users (lower(display_name))`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT        NOT NULL,
      storage_name  TEXT        NOT NULL,
      original_name TEXT        NOT NULL DEFAULT '',
      mime_type     TEXT        NOT NULL DEFAULT 'audio/mpeg',
      file_path     TEXT        NOT NULL DEFAULT '',
      file_size     BIGINT,
      duration      INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, storage_name)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks (user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks (lower(title))`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      description TEXT,
      cover_url   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_albums_user ON albums (user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS album_tracks (
      album_id   UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      track_id   UUID        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position   INTEGER     NOT NULL DEFAULT 0,
      added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (album_id, track_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_tracks_album ON album_tracks (album_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_album_tracks_track ON album_tracks (track_id)`);

  console.log('[DB] Schema initialized');
}

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Добавляем pool и uploadsRoot в каждый запрос
app.use((req, _res, next) => {
  req.pool = pool;
  req.uploadsRoot = UPLOADS_ROOT;
  next();
});

// Роуты
app.use(authRoutes);
app.use(albumRoutes);
app.use(profileRoutes);
app.use(createTrackRouter(UPLOADS_ROOT));

// Запуск
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[SERVER] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[ERROR] Failed to initialize DB:', err);
    process.exit(1);
  });
