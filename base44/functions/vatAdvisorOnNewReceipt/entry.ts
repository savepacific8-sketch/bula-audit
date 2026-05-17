import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { entity_id, data } = payload;
    const receipt = data || await base44.asServiceRole.entities.Receipt.filter({ id: entity_id }).then(r => r[0]);

    if (!receipt) {
      return Response.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Build a detailed prompt for the VAT advisor
    const lines = [
      `Proactively check the Fiji VAT compliance of this receipt and write your findings as a concise note (2–5 bullet points max). Flag any issues clearly with ⚠️ or confirm compliance with ✅.`,
      `Receipt details:`,
      receipt.supplier_name   ? `- Supplier: ${receipt.supplier_name}` : '- Supplier: unknown',
      receipt.supplier_tin    ? `- Supplier TIN: ${receipt.supplier_tin}` : '- Supplier TIN: NOT PROVIDED',
      receipt.category        ? `- Category: ${receipt.category.replace(/_/g, ' ')}` : '- Category: not set',
      receipt.vat_type        ? `- VAT Type: ${receipt.vat_type}` : '- VAT Type: not set',
      receipt.vat_rate != null ? `- VAT Rate: ${receipt.vat_rate}%` : '- VAT Rate: not set',
      receipt.vat_amount != null ? `- VAT Amount: ${receipt.vat_amount}` : '- VAT Amount: not set',
      receipt.total_amount != null ? `- Total: ${receipt.total_amount} ${receipt.currency || 'FJD'}` : '',
    ].filter(Boolean).join('\n');

    // Invoke the LLM with the Fiji VAT advisor knowledge
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a Fiji VAT compliance expert. Fiji VAT rules:
- Standard rate: 15% (VAT-inclusive by default; VAT = total × 15/115)
- Zero-rated: exports, basic foods (bread, flour, rice, cooking oil, salt, sugar, tea, milk, canned fish), prescription medicines, agricultural inputs, international transport
- Exempt: financial services, residential rent, educational services, medical/health services
- Input VAT only claimable if supplier is VAT-registered (must have FRCA TIN on invoice)
- Purchases from non-VAT-registered suppliers cannot claim input VAT

${lines}

Respond with a short compliance note (2–5 bullet points). Be specific about this receipt.`,
      response_json_schema: {
        type: 'object',
        properties: {
          compliance_note: { type: 'string' },
          has_issues: { type: 'boolean' }
        }
      }
    });

    // Append the VAT compliance note to the receipt's notes field
    const existingNotes = receipt.notes || '';
    const timestamp = new Date().toLocaleDateString('en-FJ', { timeZone: 'Pacific/Fiji', day: '2-digit', month: 'short', year: 'numeric' });
    const vatNote = `\n\n[VAT Compliance Check – ${timestamp}]\n${result.compliance_note}`;
    const updatedNotes = (existingNotes + vatNote).trim();

    await base44.asServiceRole.entities.Receipt.update(entity_id || receipt.id, {
      notes: updatedNotes
    });

    return Response.json({ success: true, has_issues: result.has_issues, note: result.compliance_note });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});