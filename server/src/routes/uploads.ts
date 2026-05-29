import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../env.js';
import { storage } from '../lib/storage.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);
router.use(uploadLimiter);

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  const buffer = req.file.buffer;

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) throw new HttpError(400, 'Could not verify file type');
  if (!ALLOWED_EXT.has(detected.ext) || !ALLOWED_MIME.has(detected.mime)) {
    throw new HttpError(400, `File content (${detected.mime}) does not match allowed types`);
  }
  const claimedFamily = req.file.mimetype.split('/')[0];
  const detectedFamily = detected.mime.split('/')[0];
  if (claimedFamily !== detectedFamily) {
    throw new HttpError(400, 'File type mismatch');
  }

  const key = `receipts/${randomBytes(16).toString('hex')}.${detected.ext}`;
  const stored = await storage.put({
    key,
    body: buffer,
    contentType: detected.mime,
  });

  await audit(req, {
    action: 'receipt.create',
    entity: 'Upload',
    entityId: key,
    metadata: {
      original_name: req.file.originalname,
      mime: detected.mime,
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
  next(err);
});

export default router;
