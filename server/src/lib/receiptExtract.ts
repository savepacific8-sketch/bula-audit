import path from 'node:path';
import fs from 'node:fs';
import { env } from '../env.js';
import { openai, isOpenAIConfigured } from './openai.js';
import { HttpError } from '../middleware/error.js';
import { extractReceiptWithOcr, resolveReceiptFilePath } from './receiptOcr.js';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other',
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

function fileToDataUri(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'image/jpeg';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

function buildImagePart(photoUrl: string) {
  if (/\.pdf(\?|$)/i.test(photoUrl.split('?')[0])) {
    throw new HttpError(400, 'OpenAI scan does not support PDF. Use free OCR (default) instead.');
  }
  const localPath = resolveReceiptFilePath(photoUrl);
  if (!localPath) {
    throw new HttpError(404, `Receipt file not found (${photoUrl}). Try uploading again.`);
  }
  return { type: 'image_url' as const, image_url: { url: fileToDataUri(localPath) } };
}

function normalizeCategory(cat: string | null | undefined): string | null {
  if (!cat) return null;
  return (CATEGORIES as readonly string[]).includes(cat) ? cat : 'other';
}

function normalizePayment(m: string | null | undefined): string | null {
  if (!m) return null;
  return (PAYMENT_METHODS as readonly string[]).includes(m) ? m : 'other';
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Paid OpenAI vision extract (optional — set RECEIPT_SCAN_DRIVER=openai). */
async function extractReceiptWithOpenAI(photoUrl: string) {
  if (!isOpenAIConfigured || !openai) {
    throw new HttpError(503, 'OPENAI_API_KEY is not set.');
  }

  const imagePart = buildImagePart(photoUrl);

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_MODEL.includes('gpt-4o') ? env.OPENAI_MODEL : 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract all receipt data from this Fiji business receipt image.
Currency default FJD. receipt_date YYYY-MM-DD. vat_type default inclusive.
category: ${CATEGORIES.join(', ')}. payment_method: ${PAYMENT_METHODS.join(', ')}.`,
          },
          imagePart,
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new HttpError(502, 'AI returned no data');

  const raw = JSON.parse(text) as Record<string, unknown>;
  const net =
    typeof raw.net_subtotal === 'number'
      ? raw.net_subtotal
      : typeof raw.printed_subtotal === 'number'
        ? raw.printed_subtotal
        : null;
  const total = typeof raw.total_amount === 'number' ? raw.total_amount : null;
  const vat = typeof raw.vat_amount === 'number' ? raw.vat_amount : null;

  let subtotal = net;
  if (subtotal == null && total != null && vat != null) {
    subtotal = r2(total - vat);
  }

  return {
    supplier_name: (raw.supplier_name as string) || '',
    supplier_tin: (raw.supplier_tin as string) || '',
    receipt_number: (raw.receipt_number as string) || '',
    receipt_date: (raw.receipt_date as string) || '',
    currency: (raw.currency as string) || 'FJD',
    subtotal: subtotal ?? '',
    vat_type: (raw.vat_type as string) || 'inclusive',
    vat_rate: raw.vat_rate ?? 12.5,
    vat_amount: vat ?? '',
    total_amount: total ?? '',
    payment_method: normalizePayment(raw.payment_method as string) || '',
    category: normalizeCategory(raw.category as string) || '',
    item_lines: Array.isArray(raw.item_lines) ? raw.item_lines : [],
    ai_confidence: typeof raw.overall_confidence === 'number' ? raw.overall_confidence : 70,
    ai_missing_fields: Array.isArray(raw.missing_fields) ? raw.missing_fields : [],
    field_confidence: {},
    validation_issues: [],
    needs_review: false,
    image_quality_issues: [],
    scan_method: 'openai' as const,
  };
}

/**
 * Extract receipt fields — **free OCR by default** (Tesseract).
 * Set RECEIPT_SCAN_DRIVER=openai and OPENAI_API_KEY for paid AI instead.
 */
export async function extractReceiptFromPhotoUrl(photoUrl: string) {
  if (env.RECEIPT_SCAN_DRIVER === 'openai') {
    return extractReceiptWithOpenAI(photoUrl);
  }
  return extractReceiptWithOcr(photoUrl);
}
