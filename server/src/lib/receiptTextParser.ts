/**
 * Parse raw OCR text from a Fiji receipt into structured fields (free, no API).
 */

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other',
] as const;

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'] as const;

export type ParsedReceipt = {
  supplier_name: string;
  supplier_tin: string;
  receipt_number: string;
  receipt_date: string;
  currency: string;
  subtotal: number | '';
  vat_type: string;
  vat_rate: number | '';
  vat_amount: number | '';
  total_amount: number | '';
  payment_method: string;
  category: string;
  item_lines: unknown[];
  ai_confidence: number;
  ai_missing_fields: string[];
  field_confidence: Record<string, number>;
  validation_issues: string[];
  needs_review: boolean;
  image_quality_issues: string[];
};

function parseMoney(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function findLabeledAmount(text: string, labels: RegExp): number | null {
  const re = new RegExp(
    `(?:${labels.source})[:\\s]*(?:FJ\\$|FJD|\\$)?\\s*([\\d,]+\\.\\d{2})`,
    'im',
  );
  const m = text.match(re);
  return m ? parseMoney(m[1]) : null;
}

function findAllAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re = /(?:FJ\$|FJD|\$)\s*([\d,]+\.\d{2})|([\d,]+\.\d{2})(?=\s*(?:CR|DR))?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseMoney(m[1] || m[2]);
    if (val != null && val > 0) amounts.push(val);
  }
  return amounts;
}

function parseDate(text: string): string {
  const patterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/,
    /(\d{4})-(\d{2})-(\d{2})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let d = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (m[0].startsWith('20') && m[0].includes('-')) {
      y = parseInt(m[1], 10);
      mo = parseInt(m[2], 10);
      d = parseInt(m[3], 10);
    } else if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return '';
}

function parseTin(text: string): string {
  const m = text.match(/(?:TIN|VAT\s*NO?\.?|TAX\s*NO?\.?)[:\s#]*([A-Z0-9\-]{5,})/i);
  return m ? m[1].trim() : '';
}

function parseReceiptNumber(text: string): string {
  const m = text.match(
    /(?:INVOICE|RECEIPT|TAX\s*INVOICE|REF(?:ERENCE)?|RECEIPT\s*NO?\.?|INV\s*NO?\.?)[#:\s]*([A-Z0-9\-]+)/i,
  );
  return m ? m[1].trim() : '';
}

function parseSupplier(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const t = line.trim();
    if (t.length < 3) continue;
    if (/^(receipt|tax invoice|invoice|date|tel|phone|tin|vat|abn)/i.test(t)) continue;
    if (/^\d+[\/\-]/.test(t)) continue;
    if (/^[\d\s\.\$]+$/.test(t)) continue;
    return t.slice(0, 120);
  }
  return '';
}

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  const hints: [RegExp, (typeof CATEGORIES)[number]][] = [
    [/fuel|petrol|diesel|shell|bp\b/, 'transport'],
    [/restaurant|cafe|food|beverage|kfc|mcdonald/, 'food_beverage'],
    [/office|stationery|paper/, 'office_supplies'],
    [/electric|water|fiji electricity|fea\b/, 'utilities'],
    [/rent|lease/, 'rent'],
    [/repair|maintenance/, 'repairs_maintenance'],
    [/insurance/, 'insurance'],
    [/wages|salary|payroll/, 'wages'],
  ];
  for (const [re, cat] of hints) {
    if (re.test(lower)) return cat;
  }
  return 'other';
}

function guessPayment(text: string): string {
  const lower = text.toLowerCase();
  if (/visa|mastercard|card|eftpos|debit|credit card/.test(lower)) return 'card';
  if (/cash/.test(lower)) return 'cash';
  if (/cheque|check/.test(lower)) return 'cheque';
  if (/bank transfer|eft\b|wire/.test(lower)) return 'bank_transfer';
  if (/m-?pesa|mobile money/.test(lower)) return 'mobile_money';
  return '';
}

function fijiVatRateForDate(isoDate: string): number {
  if (!isoDate) return 12.5;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 12.5;
  if (d >= new Date('2025-08-01')) return 12.5;
  if (d >= new Date('2023-08-01')) return 15;
  return 9;
}

export function parseReceiptText(ocrText: string): ParsedReceipt {
  const text = ocrText.replace(/\r/g, '\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const missing: string[] = [];
  const supplier_name = parseSupplier(lines);
  if (!supplier_name) missing.push('supplier_name');

  const receipt_date = parseDate(text);
  if (!receipt_date) missing.push('receipt_date');

  const supplier_tin = parseTin(text);
  const receipt_number = parseReceiptNumber(text);

  let total_amount =
    findLabeledAmount(text, /(?:GRAND\s*)?TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|NET\s*AMOUNT|TOTAL\s*AMOUNT/i) ??
    null;
  let vat_amount =
    findLabeledAmount(text, /(?:VAT|GST|TAX)(?:\s*AMOUNT)?/i) ?? null;
  let subtotal =
    findLabeledAmount(text, /SUB\s*TOTAL|SUBTOTAL|NET\s*AMOUNT/i) ?? null;

  const allAmounts = findAllAmounts(text);
  if (total_amount == null && allAmounts.length) {
    total_amount = Math.max(...allAmounts);
  }
  if (vat_amount == null && allAmounts.length >= 2) {
    const sorted = [...allAmounts].sort((a, b) => a - b);
    const maybeVat = sorted.find((a) => a < (total_amount ?? Infinity) * 0.3);
    if (maybeVat != null) vat_amount = maybeVat;
  }

  const vat_rate = fijiVatRateForDate(receipt_date);
  if (subtotal == null && total_amount != null && vat_amount != null) {
    subtotal = Math.round((total_amount - vat_amount) * 100) / 100;
  }

  if (total_amount == null) missing.push('total_amount');

  const filled = [
    supplier_name,
    receipt_date,
    total_amount != null,
    vat_amount != null,
  ].filter(Boolean).length;
  const ai_confidence = Math.min(85, 35 + filled * 12);

  return {
    supplier_name,
    supplier_tin,
    receipt_number,
    receipt_date,
    currency: /USD/i.test(text) ? 'USD' : 'FJD',
    subtotal: subtotal ?? '',
    vat_type: 'inclusive',
    vat_rate,
    vat_amount: vat_amount ?? '',
    total_amount: total_amount ?? '',
    payment_method: guessPayment(text),
    category: guessCategory(text),
    item_lines: [],
    ai_confidence,
    ai_missing_fields: missing,
    field_confidence: {},
    validation_issues: missing.length ? ['ocr_partial'] : [],
    needs_review: missing.length > 0 || ai_confidence < 60,
    image_quality_issues: ocrText.length < 40 ? ['low_ocr_text'] : [],
  };
}
