import { FileText, ExternalLink } from 'lucide-react';
import { isPdfUrl } from '@/lib/receiptMedia';

/**
 * Shows a receipt photo or an embedded PDF preview.
 */
export default function ReceiptMediaPreview({ url, className = '', imgClassName = 'w-full h-full object-contain bg-muted' }) {
  if (!url) return null;

  if (isPdfUrl(url)) {
    return (
      <div className={`flex flex-col bg-muted ${className}`}>
        <iframe
          title="Receipt PDF"
          src={url}
          className="w-full flex-1 min-h-[12rem] border-0 bg-white"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary border-t border-border hover:bg-background"
        >
          <FileText className="w-3.5 h-3.5" />
          Open PDF in new tab
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <img src={url} alt="Receipt" className={imgClassName} />
  );
}
