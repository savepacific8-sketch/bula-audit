/** Turn API error payloads (especially Zod) into a user-readable message. */
export function formatApiError(err, fallback = 'Request failed') {
  const issues = err?.data?.issues;
  if (issues && typeof issues === 'object') {
    const parts = [];
    const fieldErrors = issues.fieldErrors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      for (const messages of Object.values(fieldErrors)) {
        if (Array.isArray(messages) && messages[0]) parts.push(messages[0]);
      }
    }
    if (Array.isArray(issues.formErrors)) {
      for (const msg of issues.formErrors) {
        if (msg) parts.push(msg);
      }
    }
    if (parts.length) return parts.join(' ');
  }
  return err?.message || fallback;
}
