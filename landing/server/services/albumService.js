/**
 * Получить все альбомы пользователя
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
export async function getUserAlbums(pool, userId) {
  const q = await pool.query(
    `SELECT a.id, a.name, a.description, a.created_at,
       (SELECT COUNT(*)::int FROM album_tracks at WHERE at.album_id = a.id) AS track_count
     FROM albums a
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );
  return q.rows;
}

/**
 * Получить альбом с треками
 * @param {import('pg').Pool} pool
 * @param {string} albumId
 * @param {string} userId
 */
export async function getAlbumWithTracks(pool, albumId, userId) {
  const aq = await pool.query(
    `SELECT id, name, description, user_id FROM albums WHERE id = $1`,
    [albumId]
  );
  if (aq.rows.length === 0) throw { status: 404, error: 'not_found' };
  if (aq.rows[0].user_id !== userId) throw { status: 403, error: 'forbidden' };

  const tq = await pool.query(
    `SELECT t.id, t.user_id, t.title, t.storage_name, u.display_name AS owner_name,
            (t.user_id = $2) AS owned
     FROM album_tracks at
     JOIN tracks t ON t.id = at.track_id
     JOIN users u ON u.id = t.user_id
     WHERE at.album_id = $1
     ORDER BY at.position ASC, at.added_at ASC`,
    [albumId, userId]
  );
  return { album: aq.rows[0], tracks: tq.rows };
}

/**
 * Создать альбом
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {{ name: string, description?: string }} data
 */
export async function createAlbum(pool, userId, { name, description }) {
  name = String(name || '').trim();
  if (name.length < 1 || name.length > 120) throw { status: 400, error: 'invalid_name' };

  const dup = await pool.query(
    `SELECT id FROM albums WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1`,
    [userId, name]
  );
  if (dup.rows.length > 0) throw { status: 409, error: 'album_name_taken' };

  const ins = await pool.query(
    `INSERT INTO albums (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, created_at`,
    [userId, name, description || null]
  );
  return ins.rows[0];
}

/**
 * Обновить альбом
 * @param {import('pg').Pool} pool
 * @param {string} albumId
 * @param {string} userId
 * @param {{ name: string }} data
 */
export async function updateAlbum(pool, albumId, userId, { name }) {
  name = String(name || '').trim();
  if (!name || name.length > 120) throw { status: 400, error: 'invalid_name' };

  const dup = await pool.query(
    `SELECT id FROM albums WHERE user_id = $1 AND lower(name) = lower($2) AND id <> $3 LIMIT 1`,
    [userId, name, albumId]
  );
  if (dup.rows.length > 0) throw { status: 409, error: 'album_name_taken' };

  const q = await pool.query(
    `UPDATE albums SET name = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, updated_at`,
    [name, albumId, userId]
  );
  if (q.rows.length === 0) throw { status: 404, error: 'not_found' };
  return q.rows[0];
}

/**
 * Удалить альбом
 * @param {import('pg').Pool} pool
 * @param {string} albumId
 * @param {string} userId
 */
export async function deleteAlbum(pool, albumId, userId) {
  const q = await pool.query(
    `DELETE FROM albums WHERE id = $1 AND user_id = $2 RETURNING id`,
    [albumId, userId]
  );
  if (q.rows.length === 0) throw { status: 404, error: 'not_found' };
}

/**
 * Добавить трек в альбом
 * @param {import('pg').Pool} pool
 * @param {string} albumId
 * @param {string} trackId
 * @param {string} userId
 */
export async function addTrackToAlbum(pool, albumId, trackId, userId) {
  const aq = await pool.query(
    `SELECT id FROM albums WHERE id = $1 AND user_id = $2`,
    [albumId, userId]
  );
  if (aq.rows.length === 0) throw { status: 404, error: 'album_not_found' };

  const tq = await pool.query(`SELECT id, user_id FROM tracks WHERE id = $1`, [trackId]);
  if (tq.rows.length === 0) throw { status: 404, error: 'track_not_found' };
  if (tq.rows[0].user_id !== userId) throw { status: 403, error: 'forbidden' };

  await pool.query(
    `INSERT INTO album_tracks (album_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [albumId, trackId]
  );
}

/**
 * Удалить трек из альбома
 * @param {import('pg').Pool} pool
 * @param {string} albumId
 * @param {string} trackId
 * @param {string} userId
 */
export async function removeTrackFromAlbum(pool, albumId, trackId, userId) {
  const aq = await pool.query(
    `SELECT id FROM albums WHERE id = $1 AND user_id = $2`,
    [albumId, userId]
  );
  if (aq.rows.length === 0) throw { status: 404, error: 'album_not_found' };
  await pool.query(
    `DELETE FROM album_tracks WHERE album_id = $1 AND track_id = $2`,
    [albumId, trackId]
  );
}
