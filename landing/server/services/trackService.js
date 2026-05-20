import fsp from 'fs/promises';
import path from 'path';

/**
 * Получить все треки пользователя
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
export async function getUserTracks(pool, userId) {
  const q = await pool.query(
    `SELECT t.id, t.user_id, t.title, t.storage_name, t.original_name,
            t.mime_type, t.file_size, t.created_at, u.display_name AS owner_name
     FROM tracks t
     JOIN users u ON u.id = t.user_id
     WHERE t.user_id = $1
     ORDER BY lower(t.title) ASC`,
    [userId]
  );
  return q.rows;
}

/**
 * Создать запись трека в БД
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, title: string, storageName: string, originalName: string, mimeType: string, filePath: string, fileSize: number }} data
 */
export async function createTrack(pool, { userId, title, storageName, originalName, mimeType, filePath, fileSize }) {
  const ins = await pool.query(
    `INSERT INTO tracks (user_id, title, storage_name, original_name, mime_type, file_path, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, storage_name, created_at`,
    [userId, title, storageName, originalName, mimeType, filePath, fileSize]
  );
  return ins.rows[0];
}

/**
 * Удалить треки пользователя
 * @param {import('pg').Pool} pool
 * @param {string[]} ids
 * @param {string} userId
 * @param {string} uploadsRoot
 */
export async function deleteTracks(pool, ids, userId, uploadsRoot) {
  const deleted = [];
  const failed = [];

  for (const id of ids) {
    const q = await pool.query(
      `SELECT id, user_id, storage_name FROM tracks WHERE id = $1`,
      [id]
    );
    if (q.rows.length === 0) { failed.push({ id, reason: 'not_found' }); continue; }
    const row = q.rows[0];
    if (row.user_id !== userId) { failed.push({ id, reason: 'not_owner' }); continue; }

    const fullPath = path.join(uploadsRoot, row.user_id, row.storage_name);
    try {
      await fsp.unlink(fullPath);
    } catch (e) {
      if (e?.code !== 'ENOENT') { failed.push({ id, reason: 'delete_failed' }); continue; }
    }
    await pool.query(`DELETE FROM tracks WHERE id = $1`, [id]);
    deleted.push(id);
  }

  return { deleted, failed };
}

/**
 * Поиск треков
 * @param {import('pg').Pool} pool
 * @param {{ title?: string, owner?: string }} filters
 */
export async function searchTracks(pool, { title, owner }) {
  const params = [];
  let where = 'WHERE 1=1';

  if (title && title.length >= 2) {
    params.push(`%${title.slice(0, 120)}%`);
    where += ` AND t.title ILIKE $${params.length}`;
  }
  if (owner && owner.length >= 2) {
    params.push(`%${owner.slice(0, 120)}%`);
    where += ` AND u.display_name ILIKE $${params.length}`;
  }

  if (params.length === 0) return [];

  const q = await pool.query(
    `SELECT t.id, t.title, t.user_id AS owner_id, u.display_name AS owner_name
     FROM tracks t
     JOIN users u ON u.id = t.user_id
     ${where}
     ORDER BY u.display_name ASC, t.title ASC
     LIMIT 50`,
    params
  );
  return q.rows;
}
