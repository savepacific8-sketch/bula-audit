import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

export async function extractReceiptData(photoUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a receipt data extraction specialist for BULA AUDIT, an accounting app used in Fiji.

Extract all available fields from this receipt image and return ONLY valid JSON — no commentary, no markdown.

FIELD RULES:
- supplier_name: business name printed on the receipt. null if not found.
- supplier_tin: Tax Identification Number of the supplier. null if not found.
- receipt_number: receipt/invoice reference number. null if not found.
- receipt_date: date in YYYY-MM-DD format. null if not found.
- currency: 3-letter ISO code. Default "FJD" unless another currency is clearly shown.
- payment_method: one of [${PAYMENT_METHODS.join(', ')}]. null if not determinable.
- category: best match from [${CATEGORIES.join(', ')}]. null if not determinable.
- item_lines: array of line items each with { description, quantity, unit_price, line_total }. Empty array [] if no lines visible.
- subtotal: amount before VAT. null if not found.
- vat_rate: VAT percentage. Default 12.5 for Fiji unless another rate is clearly shown. null if VAT does not apply.
- vat_amount: VAT amount in currency.
  * If receipt is VAT-INCLUSIVE: calculate as total_amount × 12.5 / 112.5
  * If receipt is VAT-EXCLUSIVE: calculate as subtotal × (vat_rate / 100)
  * null if VAT does not apply.
- total_amount: final total including VAT. null if not found.
- ai_confidence: integer 0–100 reflecting overall extraction reliability.
  * Deduct points for: blurry image, faded ink, cropped content, handwritten text, partial visibility.
  * Be honest — do not inflate this score.
- ai_missing_fields: array of field name strings you could NOT reliably extract (e.g. ["supplier_tin", "receipt_number"]).

STRICT RULES:
1. Return ONLY valid JSON. No extra text, no markdown code blocks.
2. Do NOT guess unclear or ambiguous values — return null instead.
3. All numeric fields must be numbers, not strings.
4. Never set a status field — human review is always required before approval.
5. If image quality is poor, reflect this in ai_confidence and ai_missing_fields.`,
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