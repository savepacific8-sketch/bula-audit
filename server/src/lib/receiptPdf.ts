import fs from 'node:fs';
import path from 'node:path';
import { pdf } from 'pdf-to-img';
import { getOcrWorker } from './receiptOcrWorker.js';

const MIN_TEXT_CHARS = 40;

/** Extract text from a PDF: embedded text first, then OCR on rendered pages (free). */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  let embedded = '';

  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    embedded = (result.text ?? '').trim();
  } catch (err) {
    console.warn('[pdf] text layer extract failed:', err);
  }

  if (embedded.length >= MIN_TEXT_CHARS) {
    return embedded;
  }

  const ocrParts: string[] = embedded ? [embedded] : [];
  const worker = await getOcrWorker();
  const doc = await pdf(filePath, { scale: 2 });
  let pageNum = 0;
  const maxPages = 3;

  for await (const pageImage of doc) {
    pageNum++;
    if (pageNum > maxPages) break;
    const { data } = await worker.recognize(pageImage);
    const pageText = data?.text?.trim() ?? '';
    if (pageText) ocrParts.push(pageText);
  }

  const combined = ocrParts.join('\n\n').trim();
  return combined;
}

export function isPdfPath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf';
}
