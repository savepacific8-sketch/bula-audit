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
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'scan_receipt') {
      const { photo_url } = payload;

      if (!photo_url) {
        return Response.json({ error: 'photo_url is required' }, { status: 400 });
      }

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
- vat_type: one of [inclusive, exclusive, zero_rated, exempt, no_vat]. Default "inclusive".
- vat_rate: VAT percentage. Default 12.5 for Fiji unless another rate is clearly shown. null if VAT does not apply.
- vat_amount: VAT amount in currency. null if VAT does not apply.
- total_amount: final total including VAT. null if not found.
- ai_confidence: integer 0–100 reflecting overall extraction reliability.
- ai_missing_fields: array of field name strings you could NOT reliably extract.`,
        file_urls: [photo_url],
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
            ai_confidence:     { type: 'number' },
            ai_missing_fields: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      return Response.json({ success: true, extracted_data: result });
    }

    if (action === 'save_receipt') {
      const { company_id, photo_url, receipt_data } = payload;

      if (!company_id || !photo_url) {
        return Response.json({ error: 'company_id and photo_url are required' }, { status: 400 });
      }

      const receipt = await base44.entities.Receipt.create({
        company_id,
        photo_url,
        uploaded_by: user.email,
        status: 'pending',
        ...receipt_data
      });

      return Response.json({ success: true, receipt });
    }

    if (action === 'get_company') {
      const members = await base44.entities.TeamMember.filter({ user_email: user.email, status: 'active' });
      if (members.length === 0) {
        const owned = await base44.entities.Company.filter({ owner_email: user.email });
        if (owned.length > 0) {
          return Response.json({ success: true, company: owned[0] });
        }
        return Response.json({ success: false, error: 'No company found' });
      }
      const companies = await base44.entities.Company.filter({ id: members[0].company_id });
      return Response.json({ success: true, company: companies[0] || null, member: members[0] });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});