import { base44 } from '@/api/base44Client';

/**
 * Auto-fill receipt fields from an uploaded file URL (free OCR or optional OpenAI).
 */
export async function extractReceiptData(photoUrl) {
  return base44.integrations.Core.ExtractReceipt({ photo_url: photoUrl });
}
