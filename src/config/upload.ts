import multer from 'multer';
import path from 'node:path';
import { AppError } from '../middleware/error.js';

// ============================================================
// Section 16 — Allowed types (image only)
// ============================================================

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// ⚠️ Windows/Postman sometimes sends this generic binary
const GENERIC_BINARY = 'application/octet-stream';

// ImgBB + memory buffer — 10 MB limit
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ============================================================
// Memory storage — file.buffer এ থাকবে
// ============================================================

const storage = multer.memoryStorage();

// ============================================================
// File filter — Section 16 (with octet-stream fallback)
// ============================================================

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isGenericBinary = file.mimetype === GENERIC_BINARY;
  const hasValidExtension = ALLOWED_EXTENSIONS.includes(ext);

  // ✅ Accept if: valid MIME OR (generic binary + valid extension)
  if (!isValidMime && !(isGenericBinary && hasValidExtension)) {
    return cb(
      new AppError(
        `Invalid file: ${file.mimetype} (${ext}). Allowed: jpg, jpeg, png, webp`,
        400,
        'INVALID_FILE'
      )
    );
  }

  cb(null, true);
};

export const uploadMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// ============================================================
// Helper — image কিনা
// ============================================================

export const isImage = (mimetype: string): boolean => {
  return ALLOWED_MIME_TYPES.includes(mimetype) || mimetype === GENERIC_BINARY;
};
