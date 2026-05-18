import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  'office_supplies', 'utilities', 'rent', 'transport', 'food_beverage',
  'equipment', 'repairs_maintenance', 'professional_services', 'marketing',
  'insurance', 'inventory', 'wages', 'telecommunications', 'travel', 'other'
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'mobile_money', 'other'];

// Fiji VAT rate history
// Before Aug 2023:    9%
// Aug 2023–Jul 2025: 15%  (label: D)
// Aug 2025+:         12.5% (label: G)
function getFijiExpectedVatRate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  if (d >= new Date('2025-08-01')) return 12.5;
  if (d >= new Date('2023-08-01')) return 15;
  return 9;
}

function r2(n) { return Math.round(n * 100) / 100; }

// Validate VAT math for a receipt — returns { ok, issues, net_subtotal }
export function validateVatMath({ total_amount, vat_amount, vat_rate, subtotal, receipt_date, vat_type }) {
  const issues = [];
  const total = parseFloat(total_amount);
  const vat   = parseFloat(vat_amount);
  const rate  = parseFloat(vat_rate);

  if (isNaN(total) || isNaN(vat) || isNaN(rate)) {
    return { ok: false, issues: ['missing_financial_fields'], net_subtotal: null };
  }

  // Fiji VAT rate validation — skip check for zero-rated
  if (rate > 0) {
    const expectedRate = getFijiExpectedVatRate(receipt_date);
    if (expectedRate !== null && Math.abs(rate - expectedRate) > 0.01) {
      if (expectedRate === 12.5 && Math.abs(rate - 15) < 0.01) {
        issues.push('vat_rate_should_be_12_5pct_from_aug2025');
      } else if (expectedRate === 15 && Math.abs(rate - 12.5) < 0.01) {
        issues.push('vat_rate_should_be_15pct_for_aug2023_jul2025');
      } else if (expectedRate === 9 && Math.abs(rate - 9) > 0.01) {
        issues.push(`vat_rate_${rate}pct_unexpected_pre_aug2023`);
      }
    }
  }

  // Determine net subtotal
  let net_subtotal = null;

  if (vat_type === 'inclusive' || (!vat_type && vat > 0)) {
    // VAT-inclusive: total already contains VAT
    // net = total - vat
    net_subtotal = r2(total - vat);
    const expectedVat = r2(net_subtotal * rate / 100);
    if (Math.abs(vat - expectedVat) > 0.02) {
      issues.push(`vat_math_fail: net ${net_subtotal} × ${rate}% = ${expectedVat}, but vat shown is ${vat}`);
    }
    // Verify net + vat = total
    if (Math.abs(net_subtotal + vat - total) > 0.02) {
      issues.push('totals_mismatch');
    }
  } else if (vat_type === 'exclusive') {
    // VAT-exclusive: subtotal + vat = total
    const sub = parseFloat(subtotal);
    if (!isNaN(sub)) {
      net_subtotal = sub;
      const expectedTotal = r2(sub + vat);
      if (Math.abs(total - expectedTotal) > 0.02) {
        issues.push('totals_mismatch');
      }
      const expectedVat = r2(sub * rate / 100);
      if (Math.abs(vat - expectedVat) > 0.02) {
        issues.push(`vat_math_fail: ${sub} × ${rate}% = ${expectedVat}, but vat shown is ${vat}`);
      }
    }
  }

  return { ok: issues.length === 0, issues, net_subtotal };
}

// ─── Step 1: Extract + self-validate in one powerful pass ───────────────────
async function stepExtract(photoUrl) {
  const raw = await base44.integrations.Core.InvokeLLM({
    model: 'claude_opus_4_7',
    prompt: `You are an elite receipt OCR and accounting data extraction specialist for Fiji MSMEs.

Study the receipt image extremely carefully — zoom into every corner, every number, every label.

═══ FIJI VAT RULES (CRITICAL) ═══
Fiji VAT rate history:
- Before 1 Aug 2023:        9% VAT
- 1 Aug 2023 – 31 Jul 2025: 15% VAT  (FRCS label on receipt: "D")
- 1 Aug 2025 onward:        12.5% VAT (FRCS label on receipt: "G") ← CURRENT RATE
- Zero-rated supplies:      0% VAT (FRCS label: "E")

CRITICAL RULES ON VAT RATE:
• 12.5% is the CURRENT standard Fiji VAT rate for receipts dated 1 Aug 2025 or later. It is VALID. Do NOT call it non-standard, unusual, or incorrect.
• 15% is valid ONLY for receipts dated 1 Aug 2023 – 31 Jul 2025. Flag it if the receipt date is on or after 1 Aug 2025.
• 0% is always valid for zero-rated items regardless of date.

═══ VAT MATH — READ CAREFULLY ═══
Most Fiji receipts are VAT-INCLUSIVE (VAT is embedded inside the total).

INCLUSIVE example: total=$34.20, vat=$3.80, rate=12.5%
  net_subtotal = total - vat = $34.20 - $3.80 = $30.40  ✓
  verify: $30.40 × 12.5% = $3.80  ✓  → math is CORRECT, do not flag

EXCLUSIVE example: subtotal=$30.40, vat=$3.80, total=$34.20
  net_subtotal = subtotal = $30.40
  verify: $30.40 + $3.80 = $34.20  ✓  → math is CORRECT

ALWAYS extract and return these four fields:
  - printed_subtotal: the subtotal line as literally printed on the receipt (may equal total if VAT is shown separately below it)
  - net_subtotal: the true pre-VAT amount (= total - vat for inclusive; = printed_subtotal for exclusive)
  - vat_amount: the VAT amount shown or calculated
  - total_amount: the final amount paid (grand total / amount due)

IMPORTANT: If the receipt prints a "subtotal" that equals the total (i.e., the subtotal line appears above a separate VAT line), that printed subtotal is the GROSS amount. The real net_subtotal = printed_subtotal - vat_amount.

Only set math_ok=false if numbers genuinely fail to reconcile within $0.02.

═══ EXTRACTION RULES ═══
1. Read every character carefully. Distinguish: 0 vs O, 1 vs l, 5 vs S, 8 vs B.
2. Numbers: pay extreme attention to decimal points. $45.00 ≠ $4.50 ≠ $450.00.
3. If a value is clearly printed, extract it. If uncertain or unreadable, use null.
4. Do NOT flag valid numbers as suspicious just because they look unusual.
5. For dates: convert to YYYY-MM-DD format. Fiji standard is DD/MM/YYYY.
6. Currency defaults to FJD unless another currency is clearly shown.
7. For vat_type — choose the most accurate:
   - "inclusive"  = VAT is embedded inside the total (most common in Fiji)
   - "exclusive"  = VAT is added on top of the subtotal to reach the total
   - "zero_rated" = 0% VAT (FRCS label "E") — supply is taxable but at 0%
   - "exempt"     = supply is exempt from VAT entirely
   - "no_vat"     = supplier is not VAT-registered
   If genuinely unclear, use "inclusive" as the safe default for Fiji.
8. Item lines: extract ALL line items. quantity defaults to 1 if not shown.
9. Supplier TIN: usually labeled "TIN", "VAT No", "Tax No" — 9 digits for Fiji.

═══ SELF-VERIFICATION ═══
After extracting, verify the math using the rules above.
ONLY set validation.math_ok=false if numbers genuinely fail to reconcile (>$0.02 difference).
A valid inclusive receipt with total=$34.20, vat=$3.80, net=$30.40, rate=12.5% → math_ok=true.
Do NOT add any issue for 12.5% VAT on receipts dated 1 Aug 2025 or later — it is correct.

═══ CONFIDENCE SCORING ═══
For each field, score 0–100:
- 90–100: Perfectly clear
- 70–89: Clear, minor uncertainty
- 50–69: Readable but some doubt
- 0–49: Hard to read, needs review

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
  "printed_subtotal": number_or_null,
  "net_subtotal": number_or_null,
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
    supplier_name:    extracted.supplier_name,
    receipt_number:   extracted.receipt_number,
    receipt_date:     extracted.receipt_date,
    vat_type:         extracted.vat_type,
    printed_subtotal: extracted.printed_subtotal,
    net_subtotal:     extracted.net_subtotal,
    vat_rate:         extracted.vat_rate,
    vat_amount:       extracted.vat_amount,
    total_amount:     extracted.total_amount,
    item_lines:       extracted.item_lines,
  }, null, 2);

  const raw = await base44.integrations.Core.InvokeLLM({
    model: 'claude_opus_4_7',
    prompt: `You are an independent receipt data auditor for Fiji MSMEs.

A previous AI pass extracted this data from the receipt image:

${summary}

Your job: verify each value independently by re-reading the receipt image.

═══ FIJI VAT RULES — APPLY THESE ═══
Rate validity by receipt date:
  • 1 Aug 2025 onward:        12.5% → VALID. Do NOT flag as wrong, non-standard, or unusual.
  • 1 Aug 2023 – 31 Jul 2025: 15%   → valid for that period only.
  • Before 1 Aug 2023:        9%    → valid for that period only.
  • Any date:                 0%    → valid for zero-rated items.

VAT math:
  • Inclusive: net_subtotal = total_amount − vat_amount. Example: $34.20 − $3.80 = $30.40. math_ok=true.
  • Exclusive: total_amount = net_subtotal + vat_amount.
  • Only set math_ok=false if numbers fail to reconcile within $0.02.
  • If the printed subtotal equals total_amount (with VAT shown separately), net_subtotal = printed_subtotal − vat_amount.

═══ VERIFICATION CHECKS ═══
1. total_amount: Read the TOTAL / GRAND TOTAL / AMOUNT DUE line. Beware decimal errors.
2. vat_amount: Look for GST/VAT/Tax line. Check it matches rate × net.
3. net_subtotal: For inclusive, net = total - vat. For exclusive, net = subtotal line.
4. receipt_date: Verify year, month, day.
5. receipt_number: Exact match to printed number.
6. Math: Use the VAT type (inclusive/exclusive) to verify, not a simple subtotal+vat=total check.

Return ONLY raw JSON (no markdown, no \`\`\`):

{
  "corrections": {
    "supplier_name":   null,
    "receipt_number":  null,
    "receipt_date":    null,
    "printed_subtotal": null,
    "net_subtotal":    null,
    "vat_amount":      null,
    "total_amount":    null
  },
  "confidence_overrides": {
    "supplier_name":   null,
    "receipt_number":  null,
    "receipt_date":    null,
    "vat_amount":      null,
    "total_amount":    null
  },
  "math_ok": true,
  "discrepancy": null,
  "item_line_issues": [],
  "additional_issues": []
}

Rules:
- corrections[field]: corrected value if the extracted value is wrong, null if correct.
- confidence_overrides[field]: low score (0–40) only if genuinely uncertain or corrected. null = keep original.
- Do NOT add issues for 12.5% VAT on receipts dated 1 Aug 2025 or later — it is the current Fiji standard.
- Do NOT add issues for 0% VAT on zero-rated items.`,
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
      conf[field] = Math.min(conf[field] ?? 50, 45);
    }
  }

  // Apply confidence overrides
  const overrides = validation.confidence_overrides || {};
  for (const [field, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined) {
      conf[field] = val;
      if (val < 40) r[field] = null;
    }
  }

  // Derive net_subtotal if not already set (for inclusive receipts)
  if (r.net_subtotal == null && r.total_amount != null && r.vat_amount != null) {
    r.net_subtotal = r2(parseFloat(r.total_amount) - parseFloat(r.vat_amount));
  }

  // Run authoritative Fiji VAT math check
  const mathCheck = validateVatMath({
    total_amount: r.total_amount,
    vat_amount:   r.vat_amount,
    vat_rate:     r.vat_rate,
    subtotal:     r.net_subtotal ?? r.printed_subtotal,
    receipt_date: r.receipt_date,
    vat_type:     r.vat_type,
  });

  // Collect issues — filter out false positives about 12.5% VAT
  const isFalsePositive = (s) =>
    /12\.5/.test(s) || /non.?standard/i.test(s) || /nonstandard/i.test(s);

  const allIssues = [...mathCheck.issues];
  for (const issue of [...(r.validation?.issues || []), ...(validation.additional_issues || [])]) {
    if (!isFalsePositive(issue) && !allIssues.includes(issue)) allIssues.push(issue);
  }
  if (validation.item_line_issues?.length) {
    allIssues.push(`item_line_mismatch: lines ${validation.item_line_issues.join(', ')}`);
  }

  const needs_review =
    allIssues.length > 0 ||
    Object.values(conf).some(v => v != null && typeof v === 'number' && v < 60) ||
    r.validation?.needs_review;

  const confValues = Object.values(conf).filter(v => v != null && typeof v === 'number');
  const ai_confidence = r.overall_confidence ?? (
    confValues.length
      ? Math.round(confValues.reduce((a, b) => a + b, 0) / confValues.length)
      : 50
  );

  // net_subtotal becomes the canonical subtotal for the form
  const subtotal = r.net_subtotal ?? r.printed_subtotal ?? r.subtotal;

  return {
    ...r,
    subtotal,
    net_subtotal:       r.net_subtotal,
    printed_subtotal:   r.printed_subtotal,
    confidence:         conf,
    field_confidence:   conf,
    validation_issues:  allIssues,
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