import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { formatFJD, formatCategory } from '@/lib/formatCurrency';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const COLORS = ['hsl(174,62%,32%)', 'hsl(36,80%,56%)', 'hsl(210,60%,50%)', 'hsl(150,50%,45%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)', 'hsl(50,70%,50%)'];

const MONTHS = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' },
  { value: '2', label: 'March' }, { value: '3', label: 'April' },
  { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' },
  { value: '8', label: 'September' }, { value: '9', label: 'October' },
  { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

export default function Reports() {
  const { company, canExport } = useCompany();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));

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

  const filtered = useMemo(() => {
    return receipts.filter(r => {
      if (!r.receipt_date) return false;
      const d = new Date(r.receipt_date);
      return d.getMonth() === Number(month) && d.getFullYear() === Number(year) && r.status === 'approved';
    });
  }, [receipts, month, year]);

  const totalExpenses = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalVAT = filtered.reduce((s, r) => s + (r.vat_amount || 0), 0);
  const totalSubtotal = filtered.reduce((s, r) => s + (r.subtotal || 0), 0);

  // Category data
  const categoryData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const cat = r.category || 'other';
      if (!map[cat]) map[cat] = { count: 0, total: 0, vat: 0 };
      map[cat].count++;
      map[cat].total += r.total_amount || 0;
      map[cat].vat += r.vat_amount || 0;
    });
    return Object.entries(map).map(([name, d]) => ({
      name: formatCategory(name), ...d
    })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Supplier data
  const supplierData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const sup = r.supplier_name || 'Unknown';
      if (!map[sup]) map[sup] = { count: 0, total: 0, vat: 0 };
      map[sup].count++;
      map[sup].total += r.total_amount || 0;
      map[sup].vat += r.vat_amount || 0;
    });
    return Object.entries(map).map(([name, d]) => ({
      name, ...d
    })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Staff data
  const staffData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const email = r.uploaded_by || 'Unknown';
      if (!map[email]) map[email] = { count: 0, total: 0 };
      map[email].count++;
      map[email].total += r.total_amount || 0;
    });
    return Object.entries(map).map(([email, d]) => {
      const member = members.find(m => m.user_email === email);
      return { name: member?.user_name || email, ...d };
    }).sort((a, b) => b.count - a.count);
  }, [filtered, members]);

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(String(y));

  const exportPDF = () => {
    const monthLabel = MONTHS[Number(month)].label;
    const lines = [];
    lines.push(`${company?.name || 'Company'} — Expense Report`);
    lines.push(`Period: ${monthLabel} ${year}`);
    lines.push(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);
    lines.push('');
    lines.push(`Subtotal: FJ$${totalSubtotal.toFixed(2)}`);
    lines.push(`VAT (${company?.vat_rate || 12.5}%): FJ$${totalVAT.toFixed(2)}`);
    lines.push(`Total: FJ$${totalExpenses.toFixed(2)}`);
    lines.push(`Receipts: ${filtered.length}`);
    lines.push('');
    lines.push('--- RECEIPT DETAILS ---');
    filtered.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yyyy') : 'No date'} | ${r.supplier_name || 'Unknown'} | ${formatCategory(r.category)} | FJ$${(r.total_amount || 0).toFixed(2)} (VAT: FJ$${(r.vat_amount || 0).toFixed(2)})`);
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report_${monthLabel}_${year}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExpenseCSV = () => {
    const data = filtered.map(r => ({
      Date: r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM/yyyy') : '',
      Supplier: r.supplier_name || '',
      'Supplier TIN': r.supplier_tin || '',
      'Receipt #': r.receipt_number || '',
      Category: formatCategory(r.category),
      Subtotal: r.subtotal || 0,
      'VAT Rate': r.vat_rate || 0,
      'VAT Amount': r.vat_amount || 0,
      Total: r.total_amount || 0,
      Payment: r.payment_method || '',
      'Uploaded By': r.uploaded_by || '',
    }));
    exportCSV(data, `expenses_${MONTHS[Number(month)].label}_${year}`);
  };

  const monthLabel = MONTHS[Number(month)].label;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="text-lg font-bold">{formatFJD(totalSubtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VAT</p>
              <p className="text-lg font-bold text-accent-foreground">{formatFJD(totalVAT)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-primary">{formatFJD(totalExpenses)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="expenses">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="vat">VAT</TabsTrigger>
          <TabsTrigger value="category">Categories</TabsTrigger>
          <TabsTrigger value="supplier">Suppliers</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Monthly Expense Report</h2>
            {canExport && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportExpenseCSV} className="gap-2">
                  <Download className="w-3 h-3" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
                  <FileText className="w-3 h-3" /> PDF
                </Button>
              </div>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No approved receipts for {monthLabel} {year}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.receipt_date ? format(new Date(r.receipt_date), 'dd/MM') : '-'}</TableCell>
                      <TableCell className="text-xs font-medium">{r.supplier_name || '-'}</TableCell>
                      <TableCell className="text-xs">{formatCategory(r.category)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{formatFJD(r.total_amount)}</TableCell>
                      <TableCell className="text-xs text-right">{formatFJD(r.vat_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vat" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">VAT Summary</h2>
            {canExport && (
              <Button variant="outline" size="sm" onClick={() => exportCSV([
                { Description: 'Total Sales/Expenses (excl. VAT)', Amount: totalSubtotal.toFixed(2) },
                { Description: `VAT @ ${company?.vat_rate || 12.5}%`, Amount: totalVAT.toFixed(2) },
                { Description: 'Total (incl. VAT)', Amount: totalExpenses.toFixed(2) },
                { Description: 'Number of Receipts', Amount: filtered.length },
              ], `vat_summary_${monthLabel}_${year}`)} className="gap-2">
                <Download className="w-3 h-3" /> CSV
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between py-2 border-b"><span className="text-sm">Total Expenses (excl. VAT)</span><span className="font-semibold">{formatFJD(totalSubtotal)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-sm">VAT Rate</span><span className="font-semibold">{company?.vat_rate || 12.5}%</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-sm">Total VAT</span><span className="font-semibold text-accent-foreground">{formatFJD(totalVAT)}</span></div>
              <div className="flex justify-between py-2"><span className="text-sm font-semibold">Total (incl. VAT)</span><span className="font-bold text-primary">{formatFJD(totalExpenses)}</span></div>
              <div className="text-xs text-muted-foreground">{filtered.length} approved receipt(s) for {monthLabel} {year}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Category Report</h2>
            {canExport && (
              <Button variant="outline" size="sm" onClick={() => exportCSV(
                categoryData.map(c => ({ Category: c.name, Receipts: c.count, Total: c.total.toFixed(2), VAT: c.vat.toFixed(2) })),
                `categories_${monthLabel}_${year}`
              )} className="gap-2">
                <Download className="w-3 h-3" /> CSV
              </Button>
            )}
          </div>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatFJD(v)} />
                </PieChart>
              </ResponsiveContainer>
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Receipts</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {categoryData.map(c => (
                    <TableRow key={c.name}><TableCell className="text-xs">{c.name}</TableCell><TableCell className="text-xs text-right">{c.count}</TableCell><TableCell className="text-xs text-right font-medium">{formatFJD(c.total)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
        </TabsContent>

        <TabsContent value="supplier" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Supplier Report</h2>
            {canExport && (
              <Button variant="outline" size="sm" onClick={() => exportCSV(
                supplierData.map(s => ({ Supplier: s.name, Receipts: s.count, Total: s.total.toFixed(2), VAT: s.vat.toFixed(2) })),
                `suppliers_${monthLabel}_${year}`
              )} className="gap-2">
                <Download className="w-3 h-3" /> CSV
              </Button>
            )}
          </div>
          {supplierData.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Receipts</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">VAT</TableHead></TableRow></TableHeader>
              <TableBody>
                {supplierData.map(s => (
                  <TableRow key={s.name}><TableCell className="text-xs font-medium">{s.name}</TableCell><TableCell className="text-xs text-right">{s.count}</TableCell><TableCell className="text-xs text-right font-medium">{formatFJD(s.total)}</TableCell><TableCell className="text-xs text-right">{formatFJD(s.vat)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
        </TabsContent>

        <TabsContent value="staff" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Staff Upload Report</h2>
            {canExport && (
              <Button variant="outline" size="sm" onClick={() => exportCSV(
                staffData.map(s => ({ Staff: s.name, Uploads: s.count, 'Total Value': s.total.toFixed(2) })),
                `staff_${monthLabel}_${year}`
              )} className="gap-2">
                <Download className="w-3 h-3" /> CSV
              </Button>
            )}
          </div>
          {staffData.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead className="text-right">Uploads</TableHead><TableHead className="text-right">Total Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {staffData.map(s => (
                  <TableRow key={s.name}><TableCell className="text-xs font-medium">{s.name}</TableCell><TableCell className="text-xs text-right">{s.count}</TableCell><TableCell className="text-xs text-right font-medium">{formatFJD(s.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}