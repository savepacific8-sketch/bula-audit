import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { extractReceiptData } from '@/lib/extractReceipt';
import { toast } from 'sonner';
import {
  Upload, X, FileText, Loader2, CheckCircle2,
  AlertTriangle, CloudUpload, Sparkles
} from 'lucide-react';

const STATUS = {
  queued:     { label: 'Queued',      color: 'text-muted-foreground', icon: FileText },
  uploading:  { label: 'Uploading…',  color: 'text-blue-600',         icon: Loader2 },
  scanning:   { label: 'Scanning…',   color: 'text-primary',          icon: Sparkles },
  saving:     { label: 'Saving…',     color: 'text-primary',          icon: Loader2 },
  done:       { label: 'Done',        color: 'text-emerald-600',       icon: CheckCircle2 },
  error:      { label: 'Failed',      color: 'text-destructive',       icon: AlertTriangle },
};

export default function BulkUploadModal({ open, onClose, onSuccess }) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);   // [{ id, file, status, error }]
  const [running, setRunning] = useState(false);

  const addFiles = (newFiles) => {
    const items = Array.from(newFiles).map((file, i) => ({
      id: Date.now() + i,
      file,
      status: 'queued',
      error: null,
    }));
    setFiles(prev => [...prev, ...items]);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFile = (id, patch) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const processAll = async () => {
    const queued = files.filter(f => f.status === 'queued' || f.status === 'error');
    if (!queued.length) return;
    setRunning(true);

    const user = await base44.auth.me();

    for (const item of queued) {
      // 1. Upload file
      updateFile(item.id, { status: 'uploading' });
      let fileUrl;
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: item.file });
        fileUrl = file_url;
      } catch {
        updateFile(item.id, { status: 'error', error: 'Upload failed' });
        continue;
      }

      // 2. AI extraction
      updateFile(item.id, { status: 'scanning' });
      let extracted;
      try {
        extracted = await extractReceiptData(fileUrl);
      } catch {
        extracted = {};
      }

      // 3. Save to database
      updateFile(item.id, { status: 'saving' });
      try {
        await base44.entities.Receipt.create({
          company_id:        company.id,
          photo_url:         fileUrl,
          supplier_name:     extracted.supplier_name     || undefined,
          supplier_tin:      extracted.supplier_tin      || undefined,
          receipt_number:    extracted.receipt_number    || undefined,
          receipt_date:      extracted.receipt_date      || undefined,
          currency:          extracted.currency          || 'FJD',
          vat_type:          extracted.vat_type          || 'inclusive',
          subtotal:          extracted.subtotal          != null ? Number(extracted.subtotal)      : undefined,
          vat_rate:          extracted.vat_rate          != null ? Number(extracted.vat_rate)      : undefined,
          vat_amount:        extracted.vat_amount        != null ? Number(extracted.vat_amount)    : undefined,
          total_amount:      extracted.total_amount      != null ? Number(extracted.total_amount)  : undefined,
          payment_method:    extracted.payment_method    || undefined,
          category:          extracted.category          || undefined,
          item_lines:        extracted.item_lines?.length ? extracted.item_lines : undefined,
          ai_confidence:     extracted.ai_confidence     ?? undefined,
          ai_missing_fields: extracted.ai_missing_fields?.length ? extracted.ai_missing_fields : undefined,
          status:            'pending',
          uploaded_by:       user.email,
        });
        updateFile(item.id, { status: 'done' });
      } catch {
        updateFile(item.id, { status: 'error', error: 'Save failed' });
      }
    }

    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ['receipt-usage'] });
    onSuccess?.();
    toast.success(`Bulk upload complete`);
  };

  // Close on browser back gesture / hardware back button
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ bulkUpload: true }, '');
    const handlePop = () => {
      if (!running) { setFiles([]); onClose(); }
      else window.history.pushState({ bulkUpload: true }, ''); // block back while running
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [open, running, onClose]);

  const handleClose = () => {
    if (running) return;
    setFiles([]);
    onClose();
  };

  const allDone = files.length > 0 && files.every(f => f.status === 'done');
  const hasQueued = files.some(f => f.status === 'queued' || f.status === 'error');
  const doneCount = files.filter(f => f.status === 'done').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-primary" />
            Bulk Upload Receipts
          </DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => !running && inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Drop files here or tap to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — select multiple at once</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {files.map(item => {
              const cfg = STATUS[item.status];
              const Icon = cfg.icon;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Icon className={`w-4 h-4 shrink-0 ${cfg.color} ${item.status === 'uploading' || item.status === 'saving' ? 'animate-spin' : ''} ${item.status === 'scanning' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <p className={`text-xs ${cfg.color}`}>
                      {item.error || cfg.label}
                    </p>
                  </div>
                  {(item.status === 'queued' || item.status === 'error') && !running && (
                    <button onClick={() => removeFile(item.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {item.status === 'done' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Progress summary */}
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {doneCount} of {files.length} processed
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={running} className="flex-1">
            {allDone ? 'Close' : 'Cancel'}
          </Button>
          {!allDone && (
            <Button
              onClick={processAll}
              disabled={running || !hasQueued}
              className="flex-1 gap-2"
            >
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                : <><Sparkles className="w-4 h-4" /> Process {files.filter(f => f.status === 'queued' || f.status === 'error').length} Files</>
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}