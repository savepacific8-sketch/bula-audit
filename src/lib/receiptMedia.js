/** True if a File from the picker is a PDF. */
export function isPdfFile(file) {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return mime === 'application/pdf' || name.endsWith('.pdf');
}

/** True if a stored receipt URL points at a PDF. */
export function isPdfUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.pdf');
}
