import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { storage } from '../lib/storage.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../lib/audit.js';
import { resolveUploadType } from '../lib/uploadMime.js';

const router = Router();
router.use(requireAuth);
router.use(uploadLimiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const name = (file.originalname || '').toLowerCase();
    const ok =
      !mime ||
      mime === 'application/octet-stream' ||
      mime.startsWith('image/') ||
      mime === 'application/pdf' ||
      /\.(jpe?g|jfif|png|gif|webp|bmp|tiff?|heic|heif|pdf)$/i.test(name);
    if (!ok) {
      cb(new Error('Please upload an image (JPG, PNG, HEIC, etc.) or PDF.'));
      return;
    }
    cb(null, true);
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  const buffer = req.file.buffer;

  const resolved = await resolveUploadType(buffer, req.file.originalname || '');
  if (!resolved) {
    throw new HttpError(
      400,
      'Could not recognize this file. Use a photo or scan: JPG, PNG, GIF, WEBP, HEIC, TIFF, or PDF.',
    );
  }

  const key = `receipts/${randomBytes(16).toString('hex')}.${resolved.ext}`;
  const stored = await storage.put({
    key,
    body: buffer,
    contentType: resolved.mime,
  });

  await audit(req, {
    action: 'receipt.create',
    entity: 'Upload',
    entityId: key,
    metadata: {
      original_name: req.file.originalname,
      mime: resolved.mime,
      size: buffer.length,
      driver: env.STORAGE_DRIVER,
    },
  });

  res.json({
    file_url: stored.url,
    filename: stored.key,
    original_name: req.file.originalname,
    mime_type: stored.contentType,
    size: stored.size,
  });
});

router.use((err: unknown, _req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large (max ${env.MAX_UPLOAD_MB} MB)` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

export default router;
