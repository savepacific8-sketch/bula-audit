import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatApiError } from '@/lib/apiErrors';
import { useSubscription } from '@/hooks/useSubscription';
import UsageMeter from '@/components/billing/UsageMeter';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import ReceiptCard from '@/components/receipts/ReceiptCard';
import UploadReceiptModal from '@/components/receipts/UploadReceiptModal';
import BulkUploadModal from '@/components/receipts/BulkUploadModal';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, X, CloudUpload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import PullToRefresh from '@/components/layout/PullToRefresh';

export default function Receipts() {
  const { company, canUpload, canApprove } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { uploadAllowed, totalUsage, receiptLimit, receiptsRemaining, isFreePlan, limitReached } = useSubscription();
  const [showUpload, setShowUpload] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['receipts'] });

  const statusMutation = useMutation({
    mutationFn: async ({ receipt, newStatus }) => {
      const user = await base44.auth.me();
      return base44.entities.Receipt.update(receipt.id, {
        status: newStatus,
        reviewed_by: user.email,
        reviewed_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Receipt updated');
    },
    onError: (err) => toast.error(formatApiError(err, 'Failed to update receipt')),
  });

  const filtered = receipts
    .filter(r => {
      if (statusFilter === 'unpaid') return r.payment_status === 'unpaid' || !r.payment_status;
      return statusFilter === 'all' || r.status === statusFilter;
    })
    .filter(r => {
      if (!search) return true;
      const s = search.toLowerCase();
      const dateStr = r.receipt_date ? format(new Date(r.receipt_date), 'dd MMM yyyy').toLowerCase() : '';
      return (r.supplier_name || '').toLowerCase().includes(s) ||
             (r.receipt_number || '').toLowerCase().includes(s) ||
             (r.category || '').toLowerCase().includes(s) ||
             dateStr.includes(s);
    })
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['receipts', company?.id] });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4">
      <PageHeader
        title="Receipts"
        subtitle="All your business expense receipts"
        action={canUpload && uploadAllowed && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowBulk(true)}
              variant="outline"
              className="gap-2 text-sm font-semibold px-3 py-2 rounded-xl"
            >
              <CloudUpload className="w-4 h-4" /> Bulk
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              className="gap-2 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow"
              style={{ background: 'hsl(var(--accent))' }}
            >
              <Plus className="w-4 h-4" /> Upload
            </Button>
          </div>
        )}
      />

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search by supplier, receipt #, or date (e.g. 15 May 2025)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-input bg-card text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 shadow-sm transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unpaid" className="text-rose-600">Unpaid</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          {search ? (
            <>
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No results for "{search}"</p>
              <p className="text-sm text-muted-foreground mt-1">Try searching by supplier name, receipt number, or date.</p>
              <Button variant="outline" className="mt-4" onClick={() => setSearch('')}>Clear search</Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground font-medium">No receipts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload your first receipt to start tracking your business expenses.</p>
              {canUpload && (
                <Button variant="outline" className="mt-4" onClick={() => setShowUpload(true)}>
                  Upload Receipt
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              canApprove={canApprove}
              statusUpdating={statusMutation.isPending}
              onApprove={(rec) => statusMutation.mutate({ receipt: rec, newStatus: 'approved' })}
              onReject={(rec) => statusMutation.mutate({ receipt: rec, newStatus: 'rejected' })}
              onClick={() => navigate(`/receipt-review?id=${r.id}`)}
            />
          ))}
        </div>
      )}

      <div className="pt-1">
        <UsageMeter used={totalUsage} limit={receiptLimit} />
        {isFreePlan && !limitReached && (
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            Free Plan: <span className="font-semibold text-primary">{receiptsRemaining}</span> receipt upload{receiptsRemaining !== 1 ? 's' : ''} remaining
          </p>
        )}
        {isFreePlan && limitReached && (
          <p className="text-xs text-rose-600 mt-1.5 text-center font-medium">
            Free receipt limit reached. <Link to="/billing" className="underline">Subscribe to continue →</Link>
          </p>
        )}
      </div>
      <UploadReceiptModal open={showUpload && uploadAllowed} onClose={() => setShowUpload(false)} onSuccess={refresh} />
      <BulkUploadModal open={showBulk} onClose={() => setShowBulk(false)} onSuccess={refresh} />
    </div>
    </PullToRefresh>
  );
}