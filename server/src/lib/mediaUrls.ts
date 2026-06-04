import type { Receipt } from '@prisma/client';
import { env } from '../env.js';
import { storage } from './storage.js';
import { serializeReceipt } from './serializers.js';

/** Extract object key from stored URL (local /uploads, R2 signed, or public CDN). */
export function extractStorageKey(url: string | null | undefined): string | null {
  if (!url) return null;

  if (url.startsWith('/uploads/')) {
    return url.replace(/^\/uploads\//, '');
  }

  const inline = url.match(/receipts\/[a-f0-9]{32}\.[a-z0-9]+/i);
  if (inline) return inline[0];

  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    const idx = path.indexOf('receipts/');
    if (idx >= 0) return path.slice(idx);
    if (path.startsWith('receipts/')) return path;
  } catch {
    /* relative or malformed */
  }

  return null;
}

/** Fresh signed URL for S3/R2; unchanged for local disk paths. */
export async function resolveMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (env.STORAGE_DRIVER !== 's3') return url;

  const key = extractStorageKey(url);
  if (!key) return url;

  return storage.signedUrl(key, 60 * 60);
}

export type SerializedReceipt = ReturnType<typeof serializeReceipt>;

export async function withResolvedReceiptMedia(
  receipt: SerializedReceipt,
): Promise<SerializedReceipt> {
  const [photo_url, document_url] = await Promise.all([
    resolveMediaUrl(receipt.photo_url),
    resolveMediaUrl(receipt.document_url),
  ]);
  return { ...receipt, photo_url, document_url };
}

export async function serializeReceiptForApi(r: Receipt): Promise<SerializedReceipt> {
  return withResolvedReceiptMedia(serializeReceipt(r));
}
