import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  getTracks,
  uploadTracks,
  deleteTracksHandler,
  streamTrack,
  searchTracksHandler,
  createUploadMiddleware,
} from '../controllers/trackController.js';

export function createTrackRouter(uploadsRoot) {
  const router = Router();
  const upload = createUploadMiddleware(uploadsRoot);

  router.get('/api/tracks', requireAuth, getTracks);

  router.post(
    '/api/upload',
    requireAuth,
    (req, res, next) => {
      upload.array('files', 200)(req, res, (err) => {
        if (err) return res.status(400).json({ ok: false, error: err.message === 'only_mp3' ? 'only_mp3' : 'upload_failed' });
        next();
      });
    },
    uploadTracks
  );

  router.post('/api/tracks/delete', requireAuth, deleteTracksHandler);
  router.get('/api/search', requireAuth, searchTracksHandler);
  router.get('/music/:ownerId/:storageName', optionalAuth, streamTrack);

  return router;
}
