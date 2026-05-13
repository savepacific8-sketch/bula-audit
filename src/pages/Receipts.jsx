import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import ReceiptCard from '@/components/receipts/ReceiptCard';
import ReceiptDetailModal from '@/components/receipts/ReceiptDetailModal';
import UploadReceiptModal from '@/components/receipts/UploadReceiptModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Receipts() {
  const { company, canUpload } = useCompany();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['receipts'] });

  const filtered = receipts
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (r.supplier_name || '').toLowerCase().includes(s) ||
             (r.receipt_number || '').toLowerCase().includes(s) ||
             (r.category || '').toLowerCase().includes(s);
    })
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Receipts</h1>
        {canUpload && (
          <Button onClick={() => setShowUpload(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Upload
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search supplier, receipt #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No receipts found</p>
          {canUpload && (
            <Button variant="outline" className="mt-3" onClick={() => setShowUpload(true)}>
              Upload your first receipt
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReceiptCard key={r.id} receipt={r} onClick={setSelectedReceipt} />
          ))}
        </div>
      )}

      <UploadReceiptModal open={showUpload} onClose={() => setShowUpload(false)} onSuccess={refresh} />
      <ReceiptDetailModal
        receipt={selectedReceipt}
        open={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        onUpdate={refresh}
      />
    </div>
  );
}