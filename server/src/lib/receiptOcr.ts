import path from 'node:path';
import fs from 'node:fs';
import { env } from '../env.js';
import { HttpError } from '../middleware/error.js';
import { parseReceiptText } from './receiptTextParser.js';
import { extractTextFromPdf, isPdfPath } from './receiptPdf.js';
import { getOcrWorker } from './receiptOcrWorker.js';

export function resolveReceiptFilePath(photoUrl: string): string | null {
  if (!photoUrl.startsWith('/uploads/')) return null;
  const base = path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
  const file = path.join(base, photoUrl.replace(/^\/uploads\//, ''));
  return fs.existsSync(file) ? file : null;
}

/** @deprecated use resolveReceiptFilePath */
export const resolveReceiptImagePath = resolveReceiptFilePath;

async function ocrImageFile(filePath: string): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(filePath);
  return data?.text?.trim() ?? '';
}

/** Free scan — Tesseract OCR + PDF text/OCR (no API key, no per-scan fee). */
export async function extractReceiptWithOcr(photoUrl: string) {
  const filePath = resolveReceiptFilePath(photoUrl);
  if (!filePath) {
    throw new HttpError(404, 'Receipt file not found. Try uploading again.');
  }

  let ocrText: string;
  if (isPdfPath(filePath)) {
    ocrText = await extractTextFromPdf(filePath);
  } else {
    ocrText = await ocrImageFile(filePath);
  }

  if (ocrText.length < 8) {
    throw new HttpError(
      422,
      isPdfPath(filePath)
        ? 'Could not read this PDF. Try a text-based PDF or a clearer photo export.'
        : 'Could not read enough text from this image. Use a clearer photo or brighter lighting.',
    );
  }

  const parsed = parseReceiptText(ocrText);
  return {
    ...parsed,
    scan_method: isPdfPath(filePath) ? ('ocr_pdf' as const) : ('ocr' as const),
  };
}
