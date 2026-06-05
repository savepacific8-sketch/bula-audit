import { fileTypeFromBuffer } from 'file-type';

/** Extensions we store and serve as receipt photos/documents. */
export const ALLOWED_EXT = new Set([
  'jpg',
  'jpeg',
  'jfif',
  'png',
  'gif',
  'webp',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'heif',
  'pdf',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

export function normalizeExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'jpeg' || e === 'jfif') return 'jpg';
  if (e === 'tif') return 'tiff';
  return e;
}

export function extFromFilename(name: string): string | null {
  const part = name?.split('.').pop()?.toLowerCase();
  if (!part) return null;
  const n = normalizeExt(part);
  return ALLOWED_EXT.has(n) ? n : null;
}

/** Magic-byte sniff when `file-type` and extension are inconclusive. */
export function sniffMimeFromBuffer(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 4) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.subarray(0, 4).toString('ascii') === '%PDF') {
    return { ext: 'pdf', mime: 'application/pdf' };
  }
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (buf.subarray(0, 2).toString('ascii') === 'BM') {
    return { ext: 'bmp', mime: 'image/bmp' };
  }
  if (
    (buf[0] === 0x49 && buf[1] === 0x49) ||
    (buf[0] === 0x4d && buf[1] === 0x4d)
  ) {
    return { ext: 'tiff', mime: 'image/tiff' };
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1')) {
      return { ext: 'heic', mime: 'image/heic' };
    }
    if (brand.startsWith('heif')) {
      return { ext: 'heif', mime: 'image/heif' };
    }
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
}

export type ResolvedUploadType = { ext: string; mime: string };

/**
 * Resolve storage extension + MIME for an upload buffer.
 * Prefers magic bytes, then file-type, then filename extension.
 */
export async function resolveUploadType(
  buffer: Buffer,
  originalName: string,
): Promise<ResolvedUploadType | null> {
  const sniffed = sniffMimeFromBuffer(buffer);
  if (sniffed && ALLOWED_EXT.has(sniffed.ext)) {
    return sniffed;
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (detected) {
    const ext = normalizeExt(detected.ext);
    if (ALLOWED_EXT.has(ext)) {
      const mime = EXT_TO_MIME[ext] ?? detected.mime;
      return { ext, mime };
    }
    if (detected.mime.startsWith('image/')) {
      const fromName = extFromFilename(originalName);
      if (fromName) return { ext: fromName, mime: EXT_TO_MIME[fromName] };
    }
  }

  const fromName = extFromFilename(originalName);
  if (fromName) {
    return { ext: fromName, mime: EXT_TO_MIME[fromName] };
  }

  // Last resort: any image/* claim with image magic or reasonable size
  if (buffer.length >= 100 && sniffed) return sniffed;

  return null;
}

export function mimeForStorage(ext: string): string {
  return EXT_TO_MIME[normalizeExt(ext)] ?? 'application/octet-stream';
}
