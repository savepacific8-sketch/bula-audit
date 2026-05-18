import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

// ─── Step 1: Extract + self-validate in one powerful pass ───────────────────
async function stepExtract(photoUrl) {
  const raw = await base44.integrations.Core.InvokeLLM({
    model: 'claude_opus_4_7',
    prompt: `You are an elite receipt OCR and accounting data extraction specialist for Fiji MSMEs.

Study the receipt image extremely carefully — zoom into every corner, every number, every label.

YOUR TASK:
Extract ALL data you can read from the receipt, then self-verify your work.

═══ EXTRACTION RULES ═══
1. Read every character carefully. Distinguish: 0 vs O, 1 vs l, 5 vs S, 8 vs B.
2. Numbers: pay extreme attention to decimal points. $45.00 ≠ $4.50 ≠ $450.00.
3. If a value is clearly printed, extract it. If uncertain or unreadable, use null.
4. Do NOT derive or calculate monetary values — only extract what is explicitly printed.
5. For dates: convert to YYYY-MM-DD format. If day/month ambiguous, prefer DD/MM/YYYY (Fiji standard).
6. Currency defaults to FJD unless another currency is clearly shown.
7. For vat_rate: Fiji standard is 15% (changed from 9% in 2023). Use 15 unless a different rate is printed.
8. For vat_type: 
   - "inclusive" = total already includes VAT (most Fiji receipts)
   - "exclusive" = VAT added on top of subtotal
   - "zero_rated" = 0% VAT
   - "exempt" = VAT exempt
   - "no_vat" = not VAT registered supplier
9. Item lines: extract ALL line items. quantity defaults to 1 if not shown.
10. Supplier TIN: usually labeled "TIN", "VAT No", "Tax No" — 9 digits for Fiji.

═══ SELF-VERIFICATION ═══
After extracting, verify:
A. Does subtotal + vat_amount = total_amount? (within $0.02 tolerance)
B. Do item line totals sum to subtotal (or total if no subtotal)?
C. Does each item: line_total = quantity × unit_price?

If ANY check fails, explain in issues[] and set needs_review = true.

═══ CONFIDENCE SCORING ═══
For each field, score your confidence 0–100:
- 95–100: Perfectly clear, unambiguous
- 80–94: Clear but minor uncertainty  
- 60–79: Readable but some doubt
- 40–59: Hard to read, guessing likely
- 0–39: Very uncertain, user must verify

Set overall_confidence as the weighted average (financials weighted 2x).

═══ CATEGORIES ═══
Pick best match: ${CATEGORIES.join(', ')}

═══ PAYMENT METHODS ═══
Pick best match: ${PAYMENT_METHODS.join(', ')}

═══ OUTPUT FORMAT ═══
Return ONLY raw JSON (absolutely no markdown, no \`\`\`, no commentary):

{
  "supplier_name": "string or null",
  "supplier_tin": "string or null",
  "receipt_number": "string or null",
  "receipt_date": "YYYY-MM-DD or null",
  "currency": "FJD",
  "subtotal": number_or_null,
  "vat_rate": number_or_null,
  "vat_type": "inclusive|exclusive|zero_rated|exempt|no_vat",
  "vat_amount": number_or_null,
  "total_amount": number_or_null,
  "payment_method": "string or null",
  "category": "string or null",
  "item_lines": [
    {"description": "string", "quantity": number_or_null, "unit_price": number_or_null, "line_total": number_or_null}
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
  "overall_confidence": 0,
  "validation": {
    "math_ok": true,
    "items_sum_ok": true,
    "needs_review": false,
    "issues": []
  },
  "missing_fields": []
}`,
    file_urls: [photoUrl],
  });

  // Parse the raw string response (no response_json_schema so nulls are preserved)
  if (typeof raw === 'string') {
    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned);
  }
  return raw;
}

// ─── Step 2: Independent verification pass ───────────────────────────────────
async function stepValidate(photoUrl, extracted) {
  const summary = JSON.stringify({
    supplier_name:  extracted.supplier_name,
    receipt_number: extracted.receipt_number,
    receipt_date:   extracted.receipt_date,
    subtotal:       extracted.subtotal,
    vat_amount:     extracted.vat_amount,
    vat_rate:       extracted.vat_rate,
    total_amount:   extracted.total_amount,
    item_lines:     extracted.item_lines,
  }, null, 2);

  const raw = await base44.integrations.Core.InvokeLLM({
    model: 'claude_opus_4_7',
    prompt: `You are an independent receipt data auditor. A previous AI pass extracted this data from the receipt image:

${summary}

Your job: look at the SAME receipt image with fresh eyes and verify each extracted value.

For each field:
1. Look at the image. What do you actually see?
2. Does it match the extracted value?
3. If wrong or uncertain, put what YOU see as the corrected value.

CRITICAL checks:
- total_amount: Read the TOTAL/GRAND TOTAL line very carefully. Common error: misreading decimal point.
- subtotal: Check if there's a subtotal line before tax.
- vat_amount: Look for GST/VAT/Tax line.
- receipt_date: Verify year, month, day carefully.
- receipt_number: Check the receipt/invoice number exactly.
- Math: Does subtotal + vat_amount = total_amount?

Return ONLY raw JSON (no markdown, no \`\`\`):

{
  "corrections": {
    "supplier_name":  null,
    "receipt_number": null,
    "receipt_date":   null,
    "subtotal":       null,
    "vat_amount":     null,
    "total_amount":   null
  },
  "confidence_overrides": {
    "supplier_name":  null,
    "receipt_number": null,
    "receipt_date":   null,
    "subtotal":       null,
    "vat_amount":     null,
    "total_amount":   null
  },
  "math_ok": true,
  "discrepancy": null,
  "item_line_issues": [],
  "additional_issues": []
}

Rules:
- corrections[field]: put the CORRECT value if you see a mistake, null if extraction was correct.
- confidence_overrides[field]: if uncertain or corrected, put a low score (0–40). null = keep original.
- item_line_issues: list 0-based indices of item lines where line_total ≠ quantity × unit_price.`,
    file_urls: [photoUrl],
  });

  if (typeof raw === 'string') {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned);
  }
  return raw;
}

// ─── Merge both passes into final result ─────────────────────────────────────
function mergeResults(extracted, validation) {
  const r = { ...extracted };
  const conf = { ...(r.confidence || {}) };

  // Apply corrections from validation pass
  const corrections = validation.corrections || {};
  for (const [field, val] of Object.entries(corrections)) {
    if (val !== null && val !== undefined) {
      r[field] = val;
      // If corrected, lower confidence
      conf[field] = Math.min(conf[field] ?? 50, 45);
    }
  }

  // Apply confidence overrides
  const overrides = validation.confidence_overrides || {};
  for (const [field, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined) {
      conf[field] = val;
      // If confidence is low, null out the field so user must review
      if (val < 40) r[field] = null;
    }
  }

  // Accumulate all issues
  const issues = [...(r.validation?.issues || [])];
  if (validation.additional_issues?.length) issues.push(...validation.additional_issues);
  if (validation.item_line_issues?.length) {
    issues.push(`item_line_mismatch: lines ${validation.item_line_issues.join(', ')}`);
  }
  if (!validation.math_ok && !issues.includes('totals_mismatch')) {
    issues.push('totals_mismatch');
    if (validation.discrepancy) issues.push(`discrepancy: $${validation.discrepancy}`);
  }

  const needs_review =
    issues.length > 0 ||
    Object.values(conf).some(v => v != null && v < 60) ||
    r.validation?.needs_review;

  // Calculate overall confidence
  const confValues = Object.values(conf).filter(v => v != null && typeof v === 'number');
  const ai_confidence = r.overall_confidence ?? (
    confValues.length
      ? Math.round(confValues.reduce((a, b) => a + b, 0) / confValues.length)
      : 50
  );

  return {
    ...r,
    confidence:         conf,
    field_confidence:   conf,
    validation_issues:  issues,
    needs_review,
    ai_confidence,
    ai_missing_fields:  r.missing_fields || [],
    image_quality_issues: [],
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────
export async function extractReceiptData(photoUrl) {
  const extracted  = await stepExtract(photoUrl);
  const validation = await stepValidate(photoUrl, extracted);
  return mergeResults(extracted, validation);
}