import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

// ─── Step 1: Extract raw data from the receipt image ────────────────────────
async function stepExtract(photoUrl) {
  return base44.integrations.Core.InvokeLLM({
    model: 'claude_sonnet_4_6',
    prompt: `You are an expert receipt OCR and accounting data extraction assistant for Fiji MSMEs.

Your job is to read the receipt image very carefully and extract exact values.

Important rules:
1. Read all numbers slowly and carefully.
2. Pay special attention to decimal points, commas, and currency symbols.
3. Do not guess unclear values.
4. If a field is not visible or is unclear, return null.
5. Extract the total amount exactly as printed on the receipt.
6. Extract VAT amount exactly as printed if shown.
7. Extract subtotal exactly as printed if shown.
8. Extract receipt number exactly as printed if shown.
9. Extract the date exactly as printed, then convert it to YYYY-MM-DD if possible.
10. Fiji currency is FJD unless another currency is clearly shown.
11. Fiji VAT default is 12.5%, but only calculate VAT if VAT is not shown and the receipt clearly indicates VAT inclusive or VAT exclusive.
12. If VAT is inclusive, VAT amount = total × 12.5 / 112.5.
13. If VAT is exclusive, VAT amount = subtotal × 0.125.
14. If the math does not match, do not force it. Mark the receipt as needs_review.
15. Always return field-level confidence scores.
16. Never approve the receipt automatically.

For category, pick the best match from: [${CATEGORIES.join(', ')}] or null.
For payment_method, pick from: [${PAYMENT_METHODS.join(', ')}] or null.

Return only valid JSON in this exact structure (no markdown, no commentary):

{
  "supplier_name": "",
  "supplier_tin": "",
  "receipt_number": "",
  "receipt_date": "",
  "subtotal": null,
  "vat_rate": 12.5,
  "vat_amount": null,
  "total_amount": null,
  "currency": "FJD",
  "payment_method": "",
  "category": "",
  "item_lines": [
    { "description": "", "quantity": null, "unit_price": null, "line_total": null }
  ],
  "confidence": {
    "supplier_name": 0,
    "supplier_tin": 0,
    "receipt_number": 0,
    "receipt_date": 0,
    "subtotal": 0,
    "vat_amount": 0,
    "total_amount": 0,
    "payment_method": 0
  },
  "validation": {
    "math_matches": false,
    "subtotal_plus_vat_equals_total": false,
    "items_add_to_total": false,
    "needs_review": true,
    "issues": []
  },
  "missing_fields": []
}`,
    file_urls: [photoUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        supplier_name:  { type: 'string' },
        supplier_tin:   { type: 'string' },
        receipt_number: { type: 'string' },
        receipt_date:   { type: 'string' },
        currency:       { type: 'string' },
        subtotal:       { type: 'number' },
        vat_rate:       { type: 'number' },
        vat_amount:     { type: 'number' },
        total_amount:   { type: 'number' },
        payment_method: { type: 'string' },
        category:       { type: 'string' },
        item_lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity:    { type: 'number' },
              unit_price:  { type: 'number' },
              line_total:  { type: 'number' }
            }
          }
        },
        confidence: {
          type: 'object',
          properties: {
            supplier_name:  { type: 'number' },
            supplier_tin:   { type: 'number' },
            receipt_number: { type: 'number' },
            receipt_date:   { type: 'number' },
            subtotal:       { type: 'number' },
            vat_amount:     { type: 'number' },
            total_amount:   { type: 'number' },
            payment_method: { type: 'number' },
          }
        },
        validation: {
          type: 'object',
          properties: {
            math_matches:                   { type: 'boolean' },
            subtotal_plus_vat_equals_total: { type: 'boolean' },
            items_add_to_total:             { type: 'boolean' },
            needs_review:                   { type: 'boolean' },
            issues:                         { type: 'array', items: { type: 'string' } },
          }
        },
        missing_fields: { type: 'array', items: { type: 'string' } },
      }
    }
  });
}

// ─── Step 2: Validate extracted data against the image ───────────────────────
async function stepValidate(photoUrl, extracted) {
  const summary = JSON.stringify({
    receipt_number: extracted.receipt_number,
    receipt_date:   extracted.receipt_date,
    subtotal:       extracted.subtotal,
    vat_amount:     extracted.vat_amount,
    total_amount:   extracted.total_amount,
    item_lines:     extracted.item_lines,
  }, null, 2);

  return base44.integrations.Core.InvokeLLM({
    model: 'claude_sonnet_4_6',
    prompt: `You are a receipt data validation assistant. A first AI pass has already extracted data from a receipt image.

Your job is to look at the SAME receipt image and verify whether the extracted values are correct.

Extracted data to verify:
${summary}

For each field, look at the receipt image and answer:
1. Does the total_amount exactly match what is printed?
2. Does the subtotal exactly match what is printed (if shown)?
3. Does the vat_amount exactly match what is printed (if shown)?
4. Does the receipt_number exactly match what is printed?
5. Does the receipt_date match the date on the receipt?
6. For each item line, does the line_total equal quantity × unit_price?
7. Does subtotal + vat_amount ≈ total_amount (within $0.02)?

For any field where the extracted value looks WRONG or UNCERTAIN compared to the image, set its confidence to a low value (0–40) and add it to suspect_fields with what you actually see on the receipt.

Return only valid JSON (no markdown):

{
  "confirmed_fields": {
    "total_amount":   true,
    "subtotal":       true,
    "vat_amount":     true,
    "receipt_number": true,
    "receipt_date":   true
  },
  "suspect_fields": {
    "total_amount":   null,
    "subtotal":       null,
    "vat_amount":     null,
    "receipt_number": null,
    "receipt_date":   null
  },
  "item_line_issues": [],
  "math_check": {
    "subtotal_plus_vat_equals_total": false,
    "discrepancy": null
  },
  "confidence_overrides": {
    "total_amount":   null,
    "subtotal":       null,
    "vat_amount":     null,
    "receipt_number": null,
    "receipt_date":   null
  },
  "additional_issues": []
}

Rules:
- suspect_fields: if a field looks wrong, put what you actually see in the image as the value. Otherwise null.
- confidence_overrides: if you disagree with the extraction, set a low number (0–40). Otherwise null.
- item_line_issues: list any item line index (0-based) where line_total ≠ quantity × unit_price.
- additional_issues: any other problems you notice (e.g. "total appears to be 45.00 not 4.50").`,
    file_urls: [photoUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        confirmed_fields: {
          type: 'object',
          properties: {
            total_amount:   { type: 'boolean' },
            subtotal:       { type: 'boolean' },
            vat_amount:     { type: 'boolean' },
            receipt_number: { type: 'boolean' },
            receipt_date:   { type: 'boolean' },
          }
        },
        suspect_fields: { type: 'object' },
        item_line_issues: { type: 'array', items: { type: 'number' } },
        math_check: {
          type: 'object',
          properties: {
            subtotal_plus_vat_equals_total: { type: 'boolean' },
            discrepancy: { type: 'number' },
          }
        },
        confidence_overrides: { type: 'object' },
        additional_issues: { type: 'array', items: { type: 'string' } },
      }
    }
  });
}

// ─── Merge extraction + validation results ───────────────────────────────────
function mergeResults(extracted, validation) {
  const r = { ...extracted };
  const conf = { ...(r.confidence || {}) };

  // Apply confidence overrides from the validation pass
  const overrides = validation.confidence_overrides || {};
  for (const [field, val] of Object.entries(overrides)) {
    if (val != null) conf[field] = val;
  }

  // For fields the validator flagged as suspect, lower confidence if not already low
  const suspect = validation.suspect_fields || {};
  for (const [field, seenValue] of Object.entries(suspect)) {
    if (seenValue != null) {
      conf[field] = Math.min(conf[field] ?? 50, 35);
    }
  }

  // Accumulate validation issues
  const issues = [...(r.validation?.issues || [])];
  if (validation.additional_issues?.length) {
    issues.push(...validation.additional_issues);
  }
  if (validation.item_line_issues?.length) {
    issues.push(`item_line_mismatch: lines ${validation.item_line_issues.join(', ')}`);
  }
  if (!validation.math_check?.subtotal_plus_vat_equals_total) {
    if (!issues.includes('totals_mismatch')) issues.push('totals_mismatch');
  }

  const needs_review =
    issues.length > 0 ||
    Object.values(conf).some(v => v < 60);

  r.confidence  = conf;
  r.field_confidence     = conf;
  r.validation_issues    = issues;
  r.image_quality_issues = [];
  r.needs_review         = needs_review;
  r.ai_missing_fields    = r.missing_fields || [];
  r.ai_confidence = Object.values(conf).length
    ? Math.round(Object.values(conf).reduce((a, b) => a + b, 0) / Object.values(conf).length)
    : 50;

  // Attach validator's suspect values so the UI can hint at corrections
  r.suspect_fields = suspect;

  return r;
}

// ─── Public entry point ──────────────────────────────────────────────────────
export async function extractReceiptData(photoUrl) {
  // Run both steps — Step 2 can start after Step 1 finishes
  const extracted = await stepExtract(photoUrl);
  const validation = await stepValidate(photoUrl, extracted);
  return mergeResults(extracted, validation);
}