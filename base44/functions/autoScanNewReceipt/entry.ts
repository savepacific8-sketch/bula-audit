import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { entity_id, data } = payload;
    const receipt = data || await base44.asServiceRole.entities.Receipt.filter({ id: entity_id }).then(r => r[0]);

    if (!receipt) {
      return Response.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (!receipt.photo_url) {
      return Response.json({ skipped: true, reason: 'No photo_url on receipt' });
    }

    // Run AI extraction on the receipt image
    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
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
- vat_type: one of [inclusive, exclusive, zero_rated, exempt, no_vat]. Default "inclusive".
- vat_rate: VAT percentage. Default 15 for Fiji unless another rate is clearly shown. null if VAT does not apply.
- vat_amount: VAT amount in currency. null if VAT does not apply.
- total_amount: final total including VAT. null if not found.
- ai_confidence: integer 0–100 reflecting overall extraction reliability.
- ai_missing_fields: array of field name strings you could NOT reliably extract.`,
      file_urls: [receipt.photo_url],
      response_json_schema: {
        type: 'object',
        properties: {
          supplier_name:     { type: 'string' },
          supplier_tin:      { type: 'string' },
          receipt_number:    { type: 'string' },
          receipt_date:      { type: 'string' },
          currency:          { type: 'string' },
          subtotal:          { type: 'number' },
          vat_type:          { type: 'string' },
          vat_rate:          { type: 'number' },
          vat_amount:        { type: 'number' },
          total_amount:      { type: 'number' },
          payment_method:    { type: 'string' },
          category:          { type: 'string' },
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
          ai_confidence:     { type: 'number' },
          ai_missing_fields: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Build update payload — only set fields that were actually extracted
    const update = {};
    const fields = [
      'supplier_name', 'supplier_tin', 'receipt_number', 'receipt_date',
      'currency', 'subtotal', 'vat_type', 'vat_rate', 'vat_amount',
      'total_amount', 'payment_method', 'category', 'item_lines',
      'ai_confidence', 'ai_missing_fields'
    ];
    for (const f of fields) {
      if (extracted[f] !== null && extracted[f] !== undefined) {
        update[f] = extracted[f];
      }
    }

    await base44.asServiceRole.entities.Receipt.update(entity_id || receipt.id, update);

    return Response.json({ success: true, ai_confidence: extracted.ai_confidence, fields_extracted: Object.keys(update) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});