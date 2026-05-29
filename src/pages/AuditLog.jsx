import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Filter, ShieldOff } from 'lucide-react';

const ACTIONS = [
  '', 'auth.signup', 'auth.login.success', 'auth.login.fail', 'auth.login.locked',
  'auth.logout', 'auth.google', 'auth.password_reset.request',
  'auth.password_reset.complete', 'auth.role_change',
  'company.create', 'company.update', 'company.delete',
  'receipt.create', 'receipt.update', 'receipt.delete', 'receipt.approve', 'receipt.reject',
  'team.invite', 'team.update', 'team.remove',
  'subscription.update', 'payment_proof.review', 'admin.action',
];

export default function AuditLog() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ action: '', user_email: '', entity: '' });

  const isAdmin = user?.role === 'admin';

  const load = async (next = false) => {
    setLoading(true);
    try {
      const params = { ...filters, limit: 50 };
      if (next && cursor) params.cursor = cursor;
      const data = await base44.audit.list(params);
      setItems(next ? [...items, ...data.items] : data.items);
      setCursor(data.next_cursor);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdmin) {
    return (
      <div className="space-y-5 pb-8">
        <PageHeader title="Audit log" subtitle="Admin only" />
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
          <ShieldOff className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          The audit log is restricted to admin accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Audit log"
        subtitle="Every sensitive action, newest first"
      />

      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label htmlFor="filterEmail" className="text-xs">User email</Label>
            <Input id="filterEmail" value={filters.user_email} onChange={(e) => setFilters(f => ({ ...f, user_email: e.target.value }))} placeholder="user@example.com" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filterAction" className="text-xs">Action</Label>
            <select
              id="filterAction"
              value={filters.action}
              onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
              className="h-8 w-full rounded-md border border-input bg-transparent text-xs px-2"
            >
              {ACTIONS.map(a => <option key={a || '__all'} value={a}>{a || 'All'}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filterEntity" className="text-xs">Entity</Label>
            <Input id="filterEntity" value={filters.entity} onChange={(e) => setFilters(f => ({ ...f, entity: e.target.value }))} placeholder="Receipt / User / ..." className="h-8 text-xs" />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => { setCursor(null); load(false); }} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Apply
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Who</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">IP</th>
                <th className="p-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-border align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(it.created_date).toLocaleString()}</td>
                  <td className="p-3">{it.user_email || '-'}</td>
                  <td className="p-3 font-mono">{it.action}</td>
                  <td className="p-3">{it.entity ? `${it.entity}${it.entity_id ? ' ' + it.entity_id.slice(0, 6) + '...' : ''}` : '-'}</td>
                  <td className="p-3">{it.ip || '-'}</td>
                  <td className="p-3 max-w-md">
                    {it.metadata ? <pre className="text-[10px] whitespace-pre-wrap break-words bg-slate-50 p-1 rounded">{JSON.stringify(it.metadata, null, 0)}</pre> : '-'}
                  </td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr><td colSpan="6" className="p-6 text-center text-muted-foreground">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {cursor && (
          <div className="p-3 border-t border-border">
            <Button size="sm" variant="outline" onClick={() => load(true)} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
