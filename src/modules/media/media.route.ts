import { Router } from 'express';
import { uploadMedia } from '../../config/upload.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { mediaUploadLimiter } from '../../middleware/rate-limit.js';
import * as mediaController from './media.controller.js';

// ============================================================
// Router 1: /api/reports/:id/media (nested under report)
// mergeParams: true → parent :id access
// ============================================================

export const reportMediaRouter = Router({ mergeParams: true });
reportMediaRouter.use(authenticate);

// Upload — form-data key = "file"
reportMediaRouter.post(
  '/',
  mediaUploadLimiter,
  uploadMedia.single('file'),
  mediaController.uploadMedia
);

// List
reportMediaRouter.get('/', mediaController.listMedia);

// Delete
reportMediaRouter.delete('/:mediaId', mediaController.deleteMedia);

// ============================================================
// Router 2: /api/media (privileged original access)
// ============================================================

export const mediaRouter = Router();
mediaRouter.use(authenticate);

mediaRouter.get(
  '/:mediaId/original',
  requireRole('MODERATOR', 'ADMIN'),
  mediaController.getOriginalMedia
);
