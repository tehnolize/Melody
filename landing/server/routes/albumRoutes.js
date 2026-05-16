import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAlbums,
  getAlbum,
  createAlbumHandler,
  updateAlbumHandler,
  deleteAlbumHandler,
  addTrack,
  removeTrack,
} from '../controllers/albumController.js';

const router = Router();

router.get('/api/albums', requireAuth, getAlbums);
router.post('/api/albums', requireAuth, createAlbumHandler);
router.get('/api/albums/:albumId', requireAuth, getAlbum);
router.patch('/api/albums/:albumId', requireAuth, updateAlbumHandler);
router.delete('/api/albums/:albumId', requireAuth, deleteAlbumHandler);
router.post('/api/albums/:albumId/tracks', requireAuth, addTrack);
router.delete('/api/albums/:albumId/tracks/:trackId', requireAuth, removeTrack);

export default router;
