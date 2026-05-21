import {
  getUserAlbums,
  getAlbumWithTracks,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  addTrackToAlbum,
  removeTrackFromAlbum,
} from '../services/albumService.js';

/**
 * Retrieves all albums for the authenticated user.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function getAlbums(req, res) {
  try {
    const albums = await getUserAlbums(req.pool, req.userId);
    res.json({ albums });
  } catch (e) {
    res.status(500).json({ error: 'albums_failed' });
  }
}

/**
 * Retrieves a single album by ID with its tracks.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function getAlbum(req, res) {
  try {
    const { album, tracks } = await getAlbumWithTracks(
      req.pool,
      req.params.albumId,
      req.userId
    );
    res.json({ album, tracks });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_failed' });
  }
}

/**
 * Creates a new album for the authenticated user.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId, req.body).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function createAlbumHandler(req, res) {
  try {
    const album = await createAlbum(req.pool, req.userId, req.body);
    res.json({ album });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_create_failed' });
  }
}

/**
 * Updates an existing album (e.g., rename).
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId, req.body).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function updateAlbumHandler(req, res) {
  try {
    const album = await updateAlbum(req.pool, req.params.albumId, req.userId, req.body);
    res.json({ album });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_update_failed' });
  }
}

/**
 * Deletes an album and all its track associations.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function deleteAlbumHandler(req, res) {
  try {
    await deleteAlbum(req.pool, req.params.albumId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_delete_failed' });
  }
}

/**
 * Adds an existing track to an album.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId, req.body).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function addTrack(req, res) {
  try {
    const trackId = String(req.body?.trackId || '').trim();
    if (!trackId) {
      return res.status(400).json({ error: 'no_track' });
    }
    await addTrackToAlbum(req.pool, req.params.albumId, trackId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_add_failed' });
  }
}

/**
 * Removes a track from an album.
 *
 * @param {Object} req - Express request object (includes req.pool, req.userId).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function removeTrack(req, res) {
  try {
    await removeTrackFromAlbum(req.pool, req.params.albumId, req.params.trackId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_remove_failed' });
  }
}
