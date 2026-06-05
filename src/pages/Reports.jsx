import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { jsPDF } from 'jspdf';
import PageHeader from '@/components/layout/PageHeader';
import { isReceiptInRange, isChartableReceipt } from '@/lib/receiptDates';

const COLORS = ['hsl(174,62%,32%)', 'hsl(36,80%,56%)', 'hsl(210,60%,50%)', 'hsl(150,50%,45%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)', 'hsl(50,70%,50%)'];

// ── helpers ──────────────────────────────────────────────────────────────────

function inRange(r, from, to) {
  return isReceiptInRange(r, from, to);
}

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(title, periodLabel, summaryLines, tableHeaders, tableRows, filename) {
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y); y += 8;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${periodLabel}`, 14, y); y += 5;
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, y); y += 10;

  // Summary block
  summaryLines.forEach(line => {
    doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
    doc.text(line.label, 14, y);
    doc.text(String(line.value), 120, y);
    y += 6;
  });
  y += 6;

  if (tableHeaders.length && tableRows.length) {
    // Simple table
    const colW = Math.floor((doc.internal.pageSize.width - 28) / tableHeaders.length);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    tableHeaders.forEach((h, i) => doc.text(h, 14 + i * colW, y));
    y += 5; doc.line(14, y, doc.internal.pageSize.width - 14, y); y += 4;
    doc.setFont('helvetica', 'normal');
    tableRows.forEach(row => {
      if (y > 270) { doc.addPage(); y = 18; }
      row.forEach((cell, i) => doc.text(String(cell ?? '').substring(0, 20), 14 + i * colW, y));
      y += 5;
    });
  }

  doc.save(`${filename}.pdf`);
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const { company } = useCompany();
  const now = new Date();

  const [filterMode, setFilterMode] = useState('this_month'); // this_month | last_month | all_time | custom
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['team', company?.id],
    queryFn: () => base44.entities.TeamMember.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  // Compute date range from filter mode
  const { fromDate, toDate, periodLabel } = useMemo(() => {
    if (filterMode === 'this_month') {
      return { fromDate: startOfMonth(now), toDate: endOfMonth(now), periodLabel: format(now, 'MMMM yyyy') };
    }
    if (filterMode === 'last_month') {
      const lm = subMonths(now, 1);
      return { fromDate: startOfMonth(lm), toDate: endOfMonth(lm), periodLabel: format(lm, 'MMMM yyyy') };
    }
    if (filterMode === 'all_time') {
      return { fromDate: new Date('2000-01-01'), toDate: new Date('2100-12-31'), periodLabel: 'All Time' };
    }
    // custom
    const from = customFrom ? new Date(customFrom) : startOfMonth(now);
    const to = customTo ? new Date(customTo + 'T23:59:59') : endOfMonth(now);
    return { fromDate: from, toDate: to, periodLabel: `${customFrom} – ${customTo}` };
  }, [filterMode, customFrom, customTo]);

  const fileTag = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');

  // All receipts in range (any status)
  const allInRange = useMemo(() => receipts.filter(r => inRange(r, fromDate, toDate)), [receipts, fromDate, toDate]);
  // Approved only
  const approved = useMemo(() => allInRange.filter(r => r.status === 'approved'), [allInRange]);
  const pending = useMemo(() => allInRange.filter(r => r.status === 'pending'), [allInRange]);
  const rejected = useMemo(() => allInRange.filter(r => r.status === 'rejected'), [allInRange]);

  const totalExpenses = approved.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalVAT = approved.reduce((s, r) => s + (r.vat_amount || 0), 0);
  const totalSubtotal = approved.reduce((s, r) => s + (r.subtotal || 0), 0);

  const chartable = useMemo(
    () => allInRange.filter(isChartableReceipt),
    [allInRange],
  );

  // Category data (approved + pending so uploads show in charts)
  const categoryData = useMemo(() => {
    const map = {};
    chartable.forEach(r => {
      const cat = r.category || 'other';
      if (!map[cat]) map[cat] = { count: 0, total: 0, vat: 0 };
      map[cat].count++; map[cat].total += r.total_amount || 0; map[cat].vat += r.vat_amount || 0;
    });
    return Object.entries(map).map(([name, d]) => ({ name: formatCategory(name), ...d })).sort((a, b) => b.total - a.total);
  }, [chartable]);

  // Supplier data
  const supplierData = useMemo(() => {
    const map = {};
    chartable.forEach(r => {
      const sup = r.supplier_name || 'Unknown';
      if (!map[sup]) map[sup] = { count: 0, total: 0, vat: 0, tin: r.supplier_tin || '' };
      map[sup].count++; map[sup].total += r.total_amount || 0; map[sup].vat += r.vat_amount || 0;
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);
  }, [chartable]);

  // Staff data (all statuses so we can see upload activity)
  const staffData = useMemo(() => {
    const map = {};
    allInRange.forEach(r => {
      const email = r.uploaded_by || 'Unknown';
      if (!map[email]) map[email] = { count: 0, approved: 0, pending: 0, rejected: 0, total: 0 };
      map[email].count++;
      map[email][r.status] = (map[email][r.status] || 0) + 1;
      if (r.status === 'approved') map[email].total += r.total_amount || 0;
    });
    return Object.entries(map).map(([email, d]) => {
      const member = members.find(m => m.user_email === email);
      return { name: member?.user_name || email, email, ...d };
    }).sort((a, b) => b.count - a.count);
  }, [allInRange, members]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportExpenseCSV = () => downloadCSV(
    approved.map(r => ({
      Date: r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yyyy') : '',
      Supplier: r.supplier_name || '', 'Supplier TIN': r.supplier_tin || '',
      'Receipt #': r.receipt_number || '', Category: formatCategory(r.category),
      Subtotal: (r.subtotal || 0).toFixed(2), 'VAT Rate': r.vat_rate || '',
      'VAT Amount': (r.vat_amount || 0).toFixed(2), Total: (r.total_amount || 0).toFixed(2),
      Payment: r.payment_method || '', 'Uploaded By': r.uploaded_by || '',
    })), `expenses_${fileTag}`);

  const exportExpensePDF = () => downloadPDF(
    `${company?.name || 'Company'} — Monthly Expense Report`, periodLabel,
    [
      { label: 'Subtotal (excl. VAT)', value: formatFJD(totalSubtotal) },
      { label: 'Total VAT', value: formatFJD(totalVAT) },
      { label: 'Total (incl. VAT)', value: formatFJD(totalExpenses), bold: true },
      { label: 'Approved Receipts', value: approved.length },
    ],
    ['Date', 'Supplier', 'Category', 'Total', 'VAT'],
    approved.map(r => [
      r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
      r.supplier_name || '-', formatCategory(r.category),
      `FJ$${(r.total_amount || 0).toFixed(2)}`, `FJ$${(r.vat_amount || 0).toFixed(2)}`,
    ]), `expenses_${fileTag}`);

  const exportVATCSV = () => downloadCSV([
    { Description: 'Total Expenses (excl. VAT)', Amount: totalSubtotal.toFixed(2) },
    { Description: `VAT @ ${company?.vat_rate || 12.5}%`, Amount: totalVAT.toFixed(2) },
    { Description: 'Total (incl. VAT)', Amount: totalExpenses.toFixed(2) },
    { Description: 'Approved Receipts', Amount: approved.length },
    ...approved.map(r => ({
      Description: r.supplier_name || 'Unknown', Amount: (r.vat_amount || 0).toFixed(2),
    })),
  ], `vat_${fileTag}`);

  const exportVATPDF = () => downloadPDF(
    `${company?.name || 'Company'} — VAT Summary`, periodLabel,
    [
      { label: 'Total Expenses (excl. VAT)', value: formatFJD(totalSubtotal) },
      { label: `VAT Rate`, value: `${company?.vat_rate || 12.5}%` },
      { label: 'Total VAT Collected', value: formatFJD(totalVAT), bold: true },
      { label: 'Total (incl. VAT)', value: formatFJD(totalExpenses), bold: true },
    ],
    ['Supplier', 'Receipt #', 'Subtotal', 'VAT'],
    approved.map(r => [r.supplier_name || '-', r.receipt_number || '-', `FJ$${(r.subtotal || 0).toFixed(2)}`, `FJ$${(r.vat_amount || 0).toFixed(2)}`]),
    `vat_${fileTag}`);

  const exportCategoryCSV = () => downloadCSV(
    categoryData.map(c => ({ Category: c.name, Receipts: c.count, Total: c.total.toFixed(2), VAT: c.vat.toFixed(2) })),
    `categories_${fileTag}`);

  const exportCategoryPDF = () => downloadPDF(
    `${company?.name || 'Company'} — Category Report`, periodLabel,
    [{ label: 'Total Approved', value: formatFJD(totalExpenses) }, { label: 'Categories', value: categoryData.length }],
    ['Category', 'Receipts', 'Total', 'VAT'],
    categoryData.map(c => [c.name, c.count, `FJ$${c.total.toFixed(2)}`, `FJ$${c.vat.toFixed(2)}`]),
    `categories_${fileTag}`);

  const exportSupplierCSV = () => downloadCSV(
    supplierData.map(s => ({ Supplier: s.name, TIN: s.tin, Receipts: s.count, Total: s.total.toFixed(2), VAT: s.vat.toFixed(2) })),
    `suppliers_${fileTag}`);

  const exportSupplierPDF = () => downloadPDF(
    `${company?.name || 'Company'} — Supplier Report`, periodLabel,
    [{ label: 'Total Approved', value: formatFJD(totalExpenses) }, { label: 'Suppliers', value: supplierData.length }],
    ['Supplier', 'TIN', 'Receipts', 'Total'],
    supplierData.map(s => [s.name, s.tin || '-', s.count, `FJ$${s.total.toFixed(2)}`]),
    `suppliers_${fileTag}`);

  const exportStaffCSV = () => downloadCSV(
    staffData.map(s => ({ Staff: s.name, Email: s.email, Uploads: s.count, Approved: s.approved || 0, Pending: s.pending || 0, Rejected: s.rejected || 0, 'Total Value': s.total.toFixed(2) })),
    `staff_${fileTag}`);

  const exportStaffPDF = () => downloadPDF(
    `${company?.name || 'Company'} — Staff Upload Report`, periodLabel,
    [{ label: 'Total Uploads', value: allInRange.length }, { label: 'Staff Members', value: staffData.length }],
    ['Staff', 'Uploads', 'Approved', 'Pending', 'Rejected'],
    staffData.map(s => [s.name, s.count, s.approved || 0, s.pending || 0, s.rejected || 0]),
    `staff_${fileTag}`);

  const exportPendingCSV = () => downloadCSV(
    pending.map(r => ({
      Date: r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yyyy') : '',
      Supplier: r.supplier_name || '', Category: formatCategory(r.category),
      Total: (r.total_amount || 0).toFixed(2), 'Uploaded By': r.uploaded_by || '',
      'AI Confidence': r.ai_confidence != null ? `${r.ai_confidence}%` : 'N/A',
    })), `pending_${fileTag}`);

  const exportPendingPDF = () => downloadPDF(
    `${company?.name || 'Company'} — Pending Receipts`, periodLabel,
    [{ label: 'Pending Count', value: pending.length }],
    ['Date', 'Supplier', 'Category', 'Total', 'Uploaded By'],
    pending.map(r => [
      r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
      r.supplier_name || '-', formatCategory(r.category),
      `FJ$${(r.total_amount || 0).toFixed(2)}`, r.uploaded_by || '-',
    ]), `pending_${fileTag}`);

  const exportRejectedCSV = () => downloadCSV(
    rejected.map(r => ({
      Date: r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yyyy') : '',
      Supplier: r.supplier_name || '', Category: formatCategory(r.category),
      Total: (r.total_amount || 0).toFixed(2), 'Uploaded By': r.uploaded_by || '',
      'Reviewed By': r.reviewed_by || '', Notes: r.notes || '',
    })), `rejected_${fileTag}`);

  const exportRejectedPDF = () => downloadPDF(
    `${company?.name || 'Company'} — Rejected Receipts`, periodLabel,
    [{ label: 'Rejected Count', value: rejected.length }],
    ['Date', 'Supplier', 'Category', 'Total', 'Notes'],
    rejected.map(r => [
      r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
      r.supplier_name || '-', formatCategory(r.category),
      `FJ$${(r.total_amount || 0).toFixed(2)}`, (r.notes || '').substring(0, 30),
    ]), `rejected_${fileTag}`);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Business Reports" subtitle={periodLabel} />

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'this_month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
              { key: 'all_time', label: 'All Time' },
              { key: 'custom', label: 'Custom' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors border cursor-pointer ${filterMode === key ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-transparent text-muted-foreground hover:bg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {filterMode === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total (excl. VAT)', value: formatFJD(totalSubtotal) },
          { label: 'Total VAT', value: formatFJD(totalVAT) },
          { label: 'Total (incl. VAT)', value: formatFJD(totalExpenses) },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-primary/10 p-3 text-center">
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
            <p className="text-sm font-bold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses">
        <TabsList className="flex w-full overflow-x-auto gap-0.5 h-auto flex-wrap">
          {[
            { value: 'expenses', label: 'Expenses' },
            { value: 'vat', label: 'VAT' },
            { value: 'category', label: 'Categories' },
            { value: 'supplier', label: 'Suppliers' },
            { value: 'staff', label: 'Staff' },
            { value: 'pending', label: `Pending (${pending.length})` },
            { value: 'rejected', label: `Rejected (${rejected.length})` },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs px-3 py-1.5">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ── Expenses ─────────────────────────────────────────────────────── */}
        <TabsContent value="expenses" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportExpenseCSV} onPDF={exportExpensePDF} />
          <ReportTable
            headers={['Date', 'Supplier', 'Category', 'Total', 'VAT']}
            rows={approved.map(r => [
              r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
              r.supplier_name || '-', formatCategory(r.category),
              formatFJD(r.total_amount), formatFJD(r.vat_amount),
            ])}
            empty={`No approved receipts for ${periodLabel}`}
          />
        </TabsContent>

        {/* ── VAT ──────────────────────────────────────────────────────────── */}
        <TabsContent value="vat" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportVATCSV} onPDF={exportVATPDF} />
          <Card>
            <CardContent className="p-4 space-y-3">
              {[
                { label: 'Total Expenses (excl. VAT)', value: formatFJD(totalSubtotal) },
                { label: `VAT Rate`, value: `${company?.vat_rate || 12.5}%` },
                { label: 'Total VAT', value: formatFJD(totalVAT), highlight: true },
                { label: 'Total (incl. VAT)', value: formatFJD(totalExpenses), bold: true },
                { label: 'Approved Receipts', value: `${approved.length}` },
              ].map(row => (
                <div key={row.label} className={`flex justify-between py-2 border-b last:border-0 ${row.highlight ? 'text-accent-foreground' : ''}`}>
                  <span className={`text-sm ${row.bold ? 'font-semibold' : ''}`}>{row.label}</span>
                  <span className={`font-semibold ${row.bold ? 'text-primary' : ''}`}>{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <ReportTable
            headers={['Supplier', 'Receipt #', 'Subtotal', 'VAT Amount']}
            rows={approved.map(r => [r.supplier_name || '-', r.receipt_number || '-', formatFJD(r.subtotal), formatFJD(r.vat_amount)])}
            empty="No data"
          />
        </TabsContent>

        {/* ── Categories ───────────────────────────────────────────────────── */}
        <TabsContent value="category" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportCategoryCSV} onPDF={exportCategoryPDF} />
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatFJD(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ReportTable
                headers={['Category', 'Receipts', 'Total', 'VAT']}
                rows={categoryData.map(c => [c.name, c.count, formatFJD(c.total), formatFJD(c.vat)])}
              />
            </>
          ) : <Empty text="No data" />}
        </TabsContent>

        {/* ── Suppliers ────────────────────────────────────────────────────── */}
        <TabsContent value="supplier" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportSupplierCSV} onPDF={exportSupplierPDF} />
          {supplierData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={supplierData.slice(0, 7)} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => formatFJD(v)} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {supplierData.slice(0, 7).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <ReportTable
                headers={['Supplier', 'TIN', 'Receipts', 'Total', 'VAT']}
                rows={supplierData.map(s => [s.name, s.tin || '-', s.count, formatFJD(s.total), formatFJD(s.vat)])}
              />
            </>
          ) : <Empty text="No data" />}
        </TabsContent>

        {/* ── Staff ────────────────────────────────────────────────────────── */}
        <TabsContent value="staff" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportStaffCSV} onPDF={exportStaffPDF} />
          <ReportTable
            headers={['Staff', 'Uploads', 'Approved', 'Pending', 'Rejected', 'Value']}
            rows={staffData.map(s => [s.name, s.count, s.approved || 0, s.pending || 0, s.rejected || 0, formatFJD(s.total)])}
            empty="No upload activity"
          />
        </TabsContent>

        {/* ── Pending ──────────────────────────────────────────────────────── */}
        <TabsContent value="pending" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportPendingCSV} onPDF={exportPendingPDF} />
          <ReportTable
            headers={['Date', 'Supplier', 'Category', 'Total', 'Uploaded By', 'AI%']}
            rows={pending.map(r => [
              r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
              r.supplier_name || '-', formatCategory(r.category),
              formatFJD(r.total_amount), r.uploaded_by || '-',
              r.ai_confidence != null ? `${r.ai_confidence}%` : 'N/A',
            ])}
            empty={`No pending receipts for ${periodLabel}`}
          />
        </TabsContent>

        {/* ── Rejected ─────────────────────────────────────────────────────── */}
        <TabsContent value="rejected" className="space-y-3 mt-4">
          <ExportButtons onCSV={exportRejectedCSV} onPDF={exportRejectedPDF} />
          <ReportTable
            headers={['Date', 'Supplier', 'Category', 'Total', 'Reviewed By', 'Notes']}
            rows={rejected.map(r => [
              r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
              r.supplier_name || '-', formatCategory(r.category),
              formatFJD(r.total_amount), r.reviewed_by || '-',
              (r.notes || '').substring(0, 30),
            ])}
            empty={`No rejected receipts for ${periodLabel}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function ExportButtons({ onCSV, onPDF }) {
  return (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={onCSV} className="gap-1.5 text-xs h-8">
        <Download className="w-3 h-3" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={onPDF} className="gap-1.5 text-xs h-8">
        <FileText className="w-3 h-3" /> PDF
      </Button>
    </div>
  );
}

function ReportTable({ headers, rows, empty }) {
  if (!rows.length) return <Empty text={empty || 'No data'} />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j} className="text-xs whitespace-nowrap">{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Empty({ text }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}