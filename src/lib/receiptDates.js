/**
 * Date used for dashboard/report period filters and charts.
 * Falls back to upload date when OCR did not extract receipt_date.
 */
export function effectiveReceiptDate(receipt) {
  const raw = receipt?.receipt_date || receipt?.created_date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isReceiptInRange(receipt, from, to) {
  const d = effectiveReceiptDate(receipt);
  if (!d) return false;
  return d >= from && d <= to;
}

export function isReceiptInInterval(receipt, start, end) {
  const d = effectiveReceiptDate(receipt);
  if (!d) return false;
  return d >= start && d <= end;
}

/** Approved + pending (excludes rejected) — for category/supplier charts. */
export function isChartableReceipt(receipt) {
  return receipt?.status === 'approved' || receipt?.status === 'pending';
}
