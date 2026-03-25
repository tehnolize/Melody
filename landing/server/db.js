import pg from "pg";

const { Pool } = pg;

/**
 * @param {string} connectionString
 */
export function createPool(connectionString) {
  return new Pool({ connectionString });
}

/**
 * @param {import("pg").Pool} pool
 */
export async function initDb(pool) {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  } catch {
    /* PostGIS не обязателен: в «голом» PostgreSQL для Windows расширение часто ставят отдельно (Stack Builder / Docker). */
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Ник (display_name) должен быть уникальным (по требованиям UX).
  // Делаем case-insensitive уникальность через lower(display_name).
  // Если в БД уже есть дубликаты, индекс может не создаться — тогда просто
  // оставляем приложение-валидацию (см. authRoutes).
  try {
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_lower ON users (lower(display_name))`
    );
  } catch {
    /* ignore */
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      storage_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, storage_name)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_title_lower ON tracks (lower(title))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks (user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS album_tracks (
      album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (album_id, track_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_albums_user ON albums (user_id)`);
}
