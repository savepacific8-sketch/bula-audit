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
    prompt: `You are an expert accountant and OCR specialist for BULA AUDIT, an accounting app used in Fiji.
Your task is to extract data from a receipt image with MAXIMUM ACCURACY.

═══════════════════════════════════════════════════════
CRITICAL READING RULES — READ CAREFULLY BEFORE STARTING
═══════════════════════════════════════════════════════

NUMBER READING:
- Read every digit character by character. Do NOT guess or round.
- Pay very close attention to decimal points. "12.50" is NOT "1250" or "125.0".
- Distinguish between: 1 and 7, 0 and 6/8, 3 and 8, 5 and 6.
- If a number is partially obscured or unclear, return null. Do NOT invent a value.
- All monetary values must be numbers (not strings). e.g. 12.50, not "12.50".

TOTALS VERIFICATION:
- After reading subtotal, VAT, and total — mentally verify: do they add up?
- If subtotal + VAT ≠ total (within 1 cent), flag validation_issues with "totals_mismatch".
- If item lines are present, their sum should roughly match subtotal (within 5%). If not, flag "items_mismatch".
- For VAT-inclusive receipts: VAT = total × 12.5 / 112.5. Check this is consistent.

IMAGE QUALITY ASSESSMENT:
- Assess the image for: blurriness, low resolution, dark/overexposed areas, cropping, faded ink, rotation/skew.
- Report findings in image_quality_issues array.
- Lower ai_confidence accordingly. A blurry image should score below 50.

═══════════════════════════════
FIELDS TO EXTRACT
═══════════════════════════════

Return ONLY valid JSON with these fields:

- supplier_name: Business name from the receipt header. null if not visible.
- supplier_tin: Tax Identification Number of the supplier (look for "TIN:", "VAT Reg:", "T.I.N", etc.). null if not found.
- receipt_number: Receipt/invoice/order reference number. null if not found.
- receipt_date: Date in YYYY-MM-DD format. null if not found.
- currency: 3-letter ISO code. Default "FJD" unless clearly stated otherwise.
- payment_method: One of [${PAYMENT_METHODS.join(', ')}]. null if unclear.
- category: Best match from [${CATEGORIES.join(', ')}]. null if unclear.

MONETARY FIELDS (read digit-by-digit, very carefully):
- subtotal: Amount BEFORE VAT/tax. null if not explicitly shown.
- vat_type: One of ["inclusive", "exclusive", "zero_rated", "exempt", "no_vat"]. Determine from context.
  * "inclusive": VAT is included in the displayed total (most common in Fiji).
  * "exclusive": VAT is added on top of subtotal.
- vat_rate: VAT percentage number. Default 12.5 for Fiji VAT. null if VAT clearly does not apply.
- vat_amount: The actual VAT dollar amount shown or calculated. Read directly from receipt if shown.
  * If NOT shown but vat_type is "inclusive": calculate as total_amount × 12.5 / 112.5
  * If NOT shown but vat_type is "exclusive": calculate as subtotal × (vat_rate / 100)
  * null if no VAT.
- total_amount: The FINAL total/grand total shown on the receipt. This is the most important field — read it very carefully.

LINE ITEMS:
- item_lines: Array of { description, quantity, unit_price, line_total }. Empty [] if none visible.
  * Read each price carefully. unit_price × quantity should equal line_total.

CONFIDENCE & VALIDATION:
- field_confidence: Object with confidence score (0–100) for each key field:
  { supplier_name, receipt_number, receipt_date, subtotal, vat_amount, total_amount, payment_method }
  * 90–100: clearly readable, no doubt
  * 70–89: readable but some uncertainty
  * 50–69: partially visible or ambiguous
  * 0–49: guessed or very unclear — set the field to null instead if below 50

- ai_confidence: Single integer 0–100 reflecting OVERALL extraction reliability. Be honest. 
  Deduct heavily for blurry/dark/cropped images.

- ai_missing_fields: Array of field names you could NOT reliably extract.

- validation_issues: Array of strings describing detected inconsistencies:
  * "totals_mismatch" — subtotal + VAT does not equal total
  * "items_mismatch" — line item sum does not match subtotal
  * "vat_calculation_error" — VAT amount inconsistent with rate and base
  Include empty array [] if no issues found.

- image_quality_issues: Array of strings describing image problems:
  * "blurry", "low_resolution", "dark", "overexposed", "cropped", "rotated", "faded_ink", "handwritten"
  Include empty array [] if image is clear.

- needs_review: boolean. Set to true if:
  * validation_issues is non-empty, OR
  * ai_confidence < 70, OR
  * any field_confidence value is below 60, OR
  * image_quality_issues is non-empty.

═══════════════════════════════
STRICT OUTPUT RULES
═══════════════════════════════
1. Return ONLY valid JSON. No markdown, no commentary, no code blocks.
2. Do NOT guess unclear values — return null.
3. All monetary values must be numbers, not strings.
4. Never include a "status" field.
5. Be honest about confidence — do not inflate scores.`,
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
        vat_type:         { type: 'string' },
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
        field_confidence: {
          type: 'object',
          properties: {
            supplier_name:  { type: 'number' },
            receipt_number: { type: 'number' },
            receipt_date:   { type: 'number' },
            subtotal:       { type: 'number' },
            vat_amount:     { type: 'number' },
            total_amount:   { type: 'number' },
            payment_method: { type: 'number' },
          }
        },
        ai_confidence:       { type: 'number' },
        ai_missing_fields:   { type: 'array', items: { type: 'string' } },
        validation_issues:   { type: 'array', items: { type: 'string' } },
        image_quality_issues:{ type: 'array', items: { type: 'string' } },
        needs_review:        { type: 'boolean' },
      }
    }
  });
  return result;
}