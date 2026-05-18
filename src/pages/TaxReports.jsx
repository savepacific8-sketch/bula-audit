import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText, Shield, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { jsPDF } from 'jspdf';
import PageHeader from '@/components/layout/PageHeader';

const CATEGORIES = [
  'office_supplies','utilities','rent','transport','food_beverage','equipment',
  'repairs_maintenance','professional_services','marketing','insurance',
  'inventory','wages','telecommunications','travel','other',
];

// VAT types eligible for input tax credit under Fiji VAT Act
const VAT_CREDIT_TYPES = ['inclusive', 'exclusive'];

function inRange(r, from, to) {
  if (!r.receipt_date) return false;
  const d = new Date(r.receipt_date);
  return d >= from && d <= to;
}

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function buildFRCSPdf(company, periodLabel, vatRows, summary) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;
  let y = 14;

  // ── Header block ──
  doc.setFillColor(30, 130, 115);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('FIJI REVENUE AND CUSTOMS SERVICE', W / 2, 10, { align: 'center' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('VAT Input Tax Credit Schedule — Section 41 VAT Decree 1991', W / 2, 17, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')} (Fiji Time)`, W / 2, 23, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y = 36;

  // ── Taxpayer details ──
  doc.setFillColor(245, 247, 250);
  doc.rect(10, y, W - 20, 26, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('TAXPAYER DETAILS', 14, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`Business Name:`, 14, y + 14); doc.text(company?.name || '—', 55, y + 14);
  doc.text(`TIN:`, 14, y + 20); doc.text(company?.tin || '—', 55, y + 20);
  doc.text(`Period:`, 110, y + 14); doc.text(periodLabel, 128, y + 14);
  doc.text(`VAT Registered:`, 110, y + 20); doc.text(company?.vat_registered ? 'YES' : 'NO', 138, y + 20);
  y += 34;

  // ── Summary box ──
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 14, y); y += 5;
  const summaryItems = [
    ['Total Purchases (excl. VAT)', formatFJD(summary.totalSubtotal)],
    ['Total VAT Input Credits', formatFJD(summary.totalVAT)],
    ['Total Purchases (incl. VAT)', formatFJD(summary.totalGross)],
    ['Number of Tax Invoices', String(summary.count)],
    ['Zero-rated / Exempt Purchases', formatFJD(summary.totalExempt)],
  ];
  summaryItems.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, W - 14, y, { align: 'right' });
    y += 5.5;
  });
  y += 4;

  // ── Table ──
  const colX = [14, 38, 72, 100, 120, 140, 165, 183];
  const headers = ['Date', 'Supplier', 'Supp. TIN', 'Rcpt #', 'Category', 'Subtotal', 'VAT', 'Total'];

  doc.setFillColor(30, 130, 115);
  doc.rect(10, y - 1, W - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  headers.forEach((h, i) => doc.text(h, colX[i], y + 4));
  doc.setTextColor(0, 0, 0);
  y += 9;

  let rowFill = false;
  vatRows.forEach((r, idx) => {
    if (y > 268) {
      doc.addPage();
      y = 14;
      // re-draw header
      doc.setFillColor(30, 130, 115);
      doc.rect(10, y - 1, W - 20, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      headers.forEach((h, i) => doc.text(h, colX[i], y + 4));
      doc.setTextColor(0, 0, 0);
      y += 9;
    }
    if (rowFill) { doc.setFillColor(248, 250, 252); doc.rect(10, y - 3.5, W - 20, 6, 'F'); }
    rowFill = !rowFill;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const cells = [
      r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '-',
      (r.supplier_name || '-').substring(0, 18),
      r.supplier_tin || '-',
      (r.receipt_number || '-').substring(0, 10),
      formatCategory(r.category).substring(0, 16),
      `FJ$${(r.subtotal || 0).toFixed(2)}`,
      `FJ$${(r.vat_amount || 0).toFixed(2)}`,
      `FJ$${(r.total_amount || 0).toFixed(2)}`,
    ];
    cells.forEach((c, i) => doc.text(c, colX[i], y + 2));
    y += 6;
  });

  // ── Totals row ──
  y += 2;
  doc.setFillColor(220, 240, 236);
  doc.rect(10, y - 3, W - 20, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('TOTALS', 14, y + 2);
  doc.text(`FJ$${summary.totalSubtotal.toFixed(2)}`, colX[5], y + 2);
  doc.text(`FJ$${summary.totalVAT.toFixed(2)}`, colX[6], y + 2);
  doc.text(`FJ$${summary.totalGross.toFixed(2)}`, colX[7], y + 2);
  y += 14;

  // ── Declaration ──
  doc.setFontSize(7.5); doc.setFont('helvetica', 'italic');
  doc.text(
    'I declare that the information in this schedule is true and correct to the best of my knowledge.',
    14, y
  );
  y += 10;
  doc.line(14, y, 80, y);
  doc.line(110, y, 176, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text('Authorised Signatory', 14, y);
  doc.text('Date', 110, y);

  doc.save(`FRCS_VAT_Input_Credits_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

export default function TaxReports() {
  const { company } = useCompany();
  const now = new Date();

  const [periodMode, setPeriodMode] = useState('this_month');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [filterTIN, setFilterTIN] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterVATType, setFilterVATType] = useState('all');

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', company?.id],
    queryFn: () => base44.entities.Receipt.filter({ company_id: company?.id }),
    enabled: !!company?.id,
  });

  const { fromDate, toDate, periodLabel } = useMemo(() => {
    if (periodMode === 'this_month') {
      return { fromDate: startOfMonth(now), toDate: endOfMonth(now), periodLabel: format(now, 'MMMM yyyy') };
    }
    if (periodMode === 'last_month') {
      const lm = subMonths(now, 1);
      return { fromDate: startOfMonth(lm), toDate: endOfMonth(lm), periodLabel: format(lm, 'MMMM yyyy') };
    }
    if (periodMode === 'all_time') {
      return { fromDate: new Date('2000-01-01'), toDate: new Date('2100-12-31'), periodLabel: 'All Time' };
    }
    const from = customFrom ? new Date(customFrom) : startOfMonth(now);
    const to = customTo ? new Date(customTo + 'T23:59:59') : endOfMonth(now);
    return { fromDate: from, toDate: to, periodLabel: `${customFrom} to ${customTo}` };
  }, [periodMode, customFrom, customTo]);

  // Base: approved receipts in range
  const baseReceipts = useMemo(() =>
    receipts.filter(r => r.status === 'approved' && inRange(r, fromDate, toDate)),
    [receipts, fromDate, toDate]
  );

  // Apply filters
  const filtered = useMemo(() => baseReceipts.filter(r => {
    if (filterTIN && !(r.supplier_tin || '').toLowerCase().includes(filterTIN.toLowerCase())) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    if (filterVATType !== 'all' && r.vat_type !== filterVATType) return false;
    return true;
  }), [baseReceipts, filterTIN, filterCategory, filterVATType]);

  // Receipts eligible for input tax credit
  const creditEligible = useMemo(() => filtered.filter(r => VAT_CREDIT_TYPES.includes(r.vat_type) && (r.vat_amount || 0) > 0), [filtered]);
  const nonCredit = useMemo(() => filtered.filter(r => !VAT_CREDIT_TYPES.includes(r.vat_type) || !(r.vat_amount > 0)), [filtered]);

  const summary = useMemo(() => ({
    totalSubtotal: creditEligible.reduce((s, r) => s + (r.subtotal || 0), 0),
    totalVAT: creditEligible.reduce((s, r) => s + (r.vat_amount || 0), 0),
    totalGross: creditEligible.reduce((s, r) => s + (r.total_amount || 0), 0),
    count: creditEligible.length,
    totalExempt: nonCredit.reduce((s, r) => s + (r.total_amount || 0), 0),
  }), [creditEligible, nonCredit]);

  // VAT by category breakdown
  const byCategory = useMemo(() => {
    const map = {};
    creditEligible.forEach(r => {
      const cat = r.category || 'other';
      if (!map[cat]) map[cat] = { count: 0, subtotal: 0, vat: 0, gross: 0 };
      map[cat].count++; map[cat].subtotal += r.subtotal || 0;
      map[cat].vat += r.vat_amount || 0; map[cat].gross += r.total_amount || 0;
    });
    return Object.entries(map).sort(([,a],[,b]) => b.vat - a.vat).map(([cat, d]) => ({ cat, ...d }));
  }, [creditEligible]);

  // VAT by supplier
  const bySupplier = useMemo(() => {
    const map = {};
    creditEligible.forEach(r => {
      const key = r.supplier_tin || r.supplier_name || 'Unknown';
      if (!map[key]) map[key] = { name: r.supplier_name || '—', tin: r.supplier_tin || '—', count: 0, vat: 0, gross: 0 };
      map[key].count++; map[key].vat += r.vat_amount || 0; map[key].gross += r.total_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.vat - a.vat);
  }, [creditEligible]);

  const hasFilters = filterTIN || filterCategory !== 'all' || filterVATType !== 'all';

  const handleDownloadPDF = () => buildFRCSPdf(company, periodLabel, creditEligible, summary);

  const handleDownloadCSV = () => downloadCSV(
    creditEligible.map(r => ({
      'Tax Period': periodLabel,
      'Taxpayer Name': company?.name || '',
      'Taxpayer TIN': company?.tin || '',
      'Receipt Date': r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yyyy') : '',
      'Supplier Name': r.supplier_name || '',
      'Supplier TIN': r.supplier_tin || '',
      'Receipt Number': r.receipt_number || '',
      'Category': formatCategory(r.category),
      'VAT Type': r.vat_type || '',
      'VAT Rate (%)': r.vat_rate ?? '',
      'Subtotal (FJD)': (r.subtotal || 0).toFixed(2),
      'VAT Amount (FJD)': (r.vat_amount || 0).toFixed(2),
      'Total (FJD)': (r.total_amount || 0).toFixed(2),
      'Payment Method': r.payment_method || '',
    })),
    `FRCS_VAT_Input_Credits_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}`
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="VAT Summary"
        subtitle={`Input tax credits — FRCS formatted · ${periodLabel}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-1.5 text-xs h-8 bg-white/10 border-white/20 text-white hover:bg-white/20" disabled={!creditEligible.length}>
              <Download className="w-3 h-3" /> CSV
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} className="gap-1.5 text-xs h-8 text-white" style={{ background: 'hsl(var(--accent))' }} disabled={!creditEligible.length}>
              <FileText className="w-3 h-3" /> FRCS PDF
            </Button>
          </div>
        }
      />

      {/* Period selector */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {[['this_month','This Month'],['last_month','Last Month'],['all_time','All Time'],['custom','Custom']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriodMode(v)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors cursor-pointer ${periodMode === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {l}
              </button>
            ))}
          </div>
          {periodMode === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">From</Label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div><Label className="text-xs">To</Label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
            <Filter className="w-3 h-3" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs mb-1 block">Supplier TIN</Label>
            <Input placeholder="Search TIN..." value={filterTIN} onChange={e => setFilterTIN(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{formatCategory(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">VAT Type</Label>
            <Select value={filterVATType} onValueChange={setFilterVATType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inclusive">Inclusive</SelectItem>
                <SelectItem value="exclusive">Exclusive</SelectItem>
                <SelectItem value="zero_rated">Zero Rated</SelectItem>
                <SelectItem value="exempt">Exempt</SelectItem>
                <SelectItem value="no_vat">No VAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Excl. VAT', value: formatFJD(summary.totalSubtotal), color: 'bg-primary/10' },
          { label: 'VAT Input Credit', value: formatFJD(summary.totalVAT), color: 'bg-accent/20' },
          { label: 'Incl. VAT', value: formatFJD(summary.totalGross), color: 'bg-secondary' },
          { label: 'Tax Invoices', value: summary.count, color: 'bg-secondary' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className="text-base font-bold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Company info reminder */}
      {(!company?.tin || !company?.vat_registered) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Incomplete company profile: </span>
            {!company?.tin && 'TIN not set. '}
            {!company?.vat_registered && 'Company not marked as VAT registered. '}
            <a href="/company" className="underline font-medium">Update in Company Profile →</a>
          </div>
        </div>
      )}

      {/* Credit-eligible table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Input Tax Credit Schedule
            {hasFilters && <Badge variant="secondary" className="text-[10px]">Filtered</Badge>}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{creditEligible.length} invoices</span>
        </CardHeader>
        <CardContent className="p-0">
          {creditEligible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No VAT-eligible receipts found for {periodLabel}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Date','Supplier','TIN','Receipt #','Category','VAT Type','Subtotal','VAT','Total'].map(h => (
                      <TableHead key={h} className="text-[10px] whitespace-nowrap font-semibold">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditEligible.map((r, i) => (
                    <TableRow key={r.id || i}>
                      <TableCell className="text-xs whitespace-nowrap">{r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '—'}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{r.supplier_name || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{r.supplier_tin || <span className="text-amber-500">missing</span>}</TableCell>
                      <TableCell className="text-xs">{r.receipt_number || '—'}</TableCell>
                      <TableCell className="text-xs">{formatCategory(r.category)}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[9px] px-1">{r.vat_type || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatFJD(r.subtotal)}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-primary font-semibold">{formatFJD(r.vat_amount)}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-semibold">{formatFJD(r.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={6} className="text-xs font-bold">TOTAL</TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">{formatFJD(summary.totalSubtotal)}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold text-primary">{formatFJD(summary.totalVAT)}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">{formatFJD(summary.totalGross)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VAT by Category */}
      {byCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">VAT Credits by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Category','Invoices','Subtotal','VAT Credit','Total'].map(h => (
                      <TableHead key={h} className="text-[10px] whitespace-nowrap font-semibold">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.map(({ cat, count, subtotal, vat, gross }) => (
                    <TableRow key={cat}>
                      <TableCell className="text-xs">{formatCategory(cat)}</TableCell>
                      <TableCell className="text-xs">{count}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatFJD(subtotal)}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-primary font-semibold">{formatFJD(vat)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatFJD(gross)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VAT by Supplier */}
      {bySupplier.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">VAT Credits by Supplier</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Supplier','TIN','Invoices','VAT Credit','Total'].map(h => (
                      <TableHead key={h} className="text-[10px] whitespace-nowrap font-semibold">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySupplier.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs max-w-[140px] truncate">{s.name}</TableCell>
                      <TableCell className={`text-xs font-mono ${!s.tin || s.tin === '—' ? 'text-amber-500' : ''}`}>
                        {s.tin && s.tin !== '—' ? s.tin : 'missing'}
                      </TableCell>
                      <TableCell className="text-xs">{s.count}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-primary font-semibold">{formatFJD(s.vat)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatFJD(s.gross)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-creditable receipts */}
      {nonCredit.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" /> Non-Creditable Receipts ({nonCredit.length})
            </CardTitle>
            <p className="text-xs text-amber-600 mt-0.5">Zero-rated, exempt, or no-VAT receipts — not eligible for input tax credit</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Date','Supplier','Category','VAT Type','Total'].map(h => (
                      <TableHead key={h} className="text-[10px] whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonCredit.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yy') : '—'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]">{r.supplier_name || '—'}</TableCell>
                      <TableCell className="text-xs">{formatCategory(r.category)}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-[9px] px-1">{r.vat_type || '—'}</Badge></TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatFJD(r.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}