import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

export async function extractReceiptData(photoUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
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
    {
      "description": "",
      "quantity": null,
      "unit_price": null,
      "line_total": null
    }
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
            math_matches:                { type: 'boolean' },
            subtotal_plus_vat_equals_total: { type: 'boolean' },
            items_add_to_total:          { type: 'boolean' },
            needs_review:                { type: 'boolean' },
            issues:                      { type: 'array', items: { type: 'string' } },
          }
        },
        missing_fields: { type: 'array', items: { type: 'string' } },
      }
    }
  });

  // Normalise to the shape the rest of the app expects
  const r = result;
  r.field_confidence     = r.confidence || {};
  r.validation_issues    = r.validation?.issues || [];
  r.image_quality_issues = [];
  r.needs_review         = r.validation?.needs_review ?? false;
  r.ai_confidence        = Math.round(
    Object.values(r.field_confidence).length
      ? Object.values(r.field_confidence).reduce((a, b) => a + b, 0) / Object.values(r.field_confidence).length
      : 50
  );
  r.ai_missing_fields = r.missing_fields || [];

  return r;
}