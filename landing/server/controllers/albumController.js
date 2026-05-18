import {
  getUserAlbums,
  getAlbumWithTracks,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  addTrackToAlbum,
  removeTrackFromAlbum,
} from '../services/albumService.js';

export async function getAlbums(req, res) {
  try {
    const albums = await getUserAlbums(req.pool, req.userId);
    res.json({ albums });
  } catch (e) {
    res.status(500).json({ error: 'albums_failed' });
  }
}

export async function getAlbum(req, res) {
  try {
    const { album, tracks } = await getAlbumWithTracks(req.pool, req.params.albumId, req.userId);
    res.json({ album, tracks });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_failed' });
  }
}

export async function createAlbumHandler(req, res) {
  try {
    const album = await createAlbum(req.pool, req.userId, req.body);
    res.json({ album });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_create_failed' });
  }
}

export async function updateAlbumHandler(req, res) {
  try {
    const album = await updateAlbum(req.pool, req.params.albumId, req.userId, req.body);
    res.json({ album });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_update_failed' });
  }
}

export async function deleteAlbumHandler(req, res) {
  try {
    await deleteAlbum(req.pool, req.params.albumId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_delete_failed' });
  }
}

export async function addTrack(req, res) {
  try {
    const trackId = String(req.body?.trackId || '').trim();
    if (!trackId) return res.status(400).json({ error: 'no_track' });
    await addTrackToAlbum(req.pool, req.params.albumId, trackId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_add_failed' });
  }
}

export async function removeTrack(req, res) {
  try {
    await removeTrackFromAlbum(req.pool, req.params.albumId, req.params.trackId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.error || 'album_remove_failed' });
  }
}
