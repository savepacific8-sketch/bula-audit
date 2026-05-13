import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

export async function extractReceiptData(photoUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a receipt data extraction specialist. Extract all available information from this receipt image and return structured JSON.

Rules:
- Return ONLY the JSON object, no commentary.
- Use YYYY-MM-DD for receipt_date.
- currency: 3-letter ISO code (e.g. FJD, USD, AUD). Default to "FJD" if unclear.
- category: pick best match from [${CATEGORIES.join(', ')}].
- payment_method: pick best match from [${PAYMENT_METHODS.join(', ')}] or leave blank.
- item_lines: extract every line item with description, quantity, unit_price, line_total. Empty array if none visible.
- ai_confidence: integer 0–100 representing your overall extraction confidence.
- ai_missing_fields: list the field names you could NOT extract (e.g. ["supplier_tin","receipt_number"]).
- For numeric fields, return numbers not strings. Leave field absent (do not return null) if not found.`,
    file_urls: [photoUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        supplier_name:    { type: 'string' },
        supplier_tin:     { type: 'string' },
        receipt_number:   { type: 'string' },
        receipt_date:     { type: 'string' },
        currency:         { type: 'string' },
        subtotal:         { type: 'number' },
        vat_rate:         { type: 'number' },
        vat_amount:       { type: 'number' },
        total_amount:     { type: 'number' },
        payment_method:   { type: 'string' },
        category:         { type: 'string' },
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
        ai_confidence:      { type: 'number' },
        ai_missing_fields:  { type: 'array', items: { type: 'string' } }
      }
    }
  });
  return result;
}