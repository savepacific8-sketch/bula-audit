export function formatFJD(amount) {
  if (amount == null || isNaN(amount)) return 'FJ$0.00';
  return `FJ$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCategory(cat) {
  if (!cat) return '—';
  return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function formatPaymentMethod(method) {
  if (!method) return '—';
  return method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}