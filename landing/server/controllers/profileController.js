/**
 * GET /api/profile/me — профиль текущего пользователя
 */
export async function getMyProfile(req, res) {
  try {
    const uq = await req.pool.query(
      `SELECT id, display_name, email, bio, avatar_url, created_at FROM users WHERE id = $1`,
      [req.userId]
    );
    if (uq.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const u = uq.rows[0];

    const tq = await req.pool.query(
      `SELECT t.id, t.title, t.storage_name, t.original_name, t.file_size, t.created_at,
              COALESCE(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), ARRAY[]::uuid[]) AS album_ids
       FROM tracks t
       LEFT JOIN album_tracks at ON at.track_id = t.id
       LEFT JOIN albums a ON a.id = at.album_id AND a.user_id = $1
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [req.userId]
    );

    const tracks = tq.rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: `/music/${req.userId}/${encodeURIComponent(row.storage_name)}`,
      originalName: row.original_name,
      fileSize: row.file_size,
      albumIds: Array.isArray(row.album_ids) ? row.album_ids : [],
      createdAt: row.created_at,
    }));

    res.json({
      user: {
        id: u.id,
        displayName: u.display_name,
        email: u.email,
        bio: u.bio,
        avatarUrl: u.avatar_url,
        createdAt: u.created_at,
      },
      tracks,
    });
  } catch (e) {
    res.status(500).json({ error: 'profile_failed' });
  }
}

/**
 * GET /api/users/:userId/profile — публичный профиль пользователя
 */
export async function getPublicProfile(req, res) {
  try {
    const userId = String(req.params.userId || '');
    const uq = await req.pool.query(
      `SELECT id, display_name, bio, avatar_url, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (uq.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const u = uq.rows[0];

    const tq = await req.pool.query(
      `SELECT id, title, storage_name, created_at FROM tracks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const tracks = tq.rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: `/music/${userId}/${encodeURIComponent(row.storage_name)}`,
      createdAt: row.created_at,
    }));

    res.json({
      user: { id: u.id, displayName: u.display_name, bio: u.bio, avatarUrl: u.avatar_url, createdAt: u.created_at },
      tracks,
    });
  } catch (e) {
    res.status(500).json({ error: 'profile_failed' });
  }
}
