import { useState, useMemo } from 'react';
import {
  Printer, FileSpreadsheet, TrendingDown,
  DollarSign
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { FinanceInvoice, FinanceExpense, FinancePayment } from '../../types/finance';
import { printFinancialReport } from '../../utils/financePrint';
import { exportToCSV } from '../../lib/csvHelper';

interface Props {
  invoices: FinanceInvoice[];
  expenses: FinanceExpense[];
  payments?: FinancePayment[];
}

export default function FinanceReports({ invoices, expenses }: Props) {
  const { lang, formatPrice } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Time Range Presets
  const [periodPreset, setPeriodPreset] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // start of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState<'all' | 'retail' | 'wholesale'>('all');

  // Filter Data by Date Range & Segment
  const filteredMetrics = useMemo(() => {
    const now = new Date();
    let start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (periodPreset === 'daily') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (periodPreset === 'weekly') {
      start = new Date();
      start.setDate(now.getDate() - 7);
    } else if (periodPreset === 'monthly') {
      start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (periodPreset === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    // Filter invoices
    const periodInvoices = invoices.filter((i) => {
      const d = new Date(i.issue_date);
      const matchDate = d >= start && d <= end;
      const matchSeg = customerSegmentFilter === 'all' || i.customer_type === customerSegmentFilter;
      return matchDate && matchSeg;
    });

    // Filter expenses
    const periodExpenses = expenses.filter((e) => {
      const d = new Date(e.expense_date);
      return d >= start && d <= end;
    });

    const grossRevenue = periodInvoices
      .filter((i) => i.status !== 'cancelled' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const retailRevenue = periodInvoices
      .filter((i) => i.customer_type === 'retail' && i.status !== 'cancelled' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const wholesaleRevenue = periodInvoices
      .filter((i) => i.customer_type === 'wholesale' && i.status !== 'cancelled' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const supplierExpenses = periodExpenses
      .filter((e) => e.expense_type === 'supplier')
      .reduce((sum, e) => sum + e.amount, 0);

    const operationalExpenses = periodExpenses
      .filter((e) => e.expense_type === 'operational')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = supplierExpenses + operationalExpenses;
    const grossProfit = grossRevenue - supplierExpenses;
    const netProfit = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const unpaidAmount = periodInvoices.reduce((sum, i) => sum + i.balance_due, 0);

    return {
      grossRevenue,
      retailRevenue,
      wholesaleRevenue,
      supplierExpenses,
      operationalExpenses,
      totalExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      unpaidAmount,
      invoiceCount: periodInvoices.length,
      paidInvoicesCount: periodInvoices.filter((i) => i.status === 'paid').length,
    };
  }, [invoices, expenses, periodPreset, startDate, endDate, customerSegmentFilter]);

  const handlePrint = () => {
    const label =
      periodPreset === 'daily'
        ? tr('تقرير اليوم', 'Aujourd\'hui')
        : periodPreset === 'weekly'
        ? tr('تقرير الأسبوع الحلي', 'Cette Semaine')
        : periodPreset === 'monthly'
        ? tr('تقرير الشهر الحالي', 'Ce Mois')
        : periodPreset === 'yearly'
        ? tr('التقرير السنوي', 'Cette Année')
        : `${startDate} à ${endDate}`;

    printFinancialReport(
      label,
      {
        totalRevenue: filteredMetrics.grossRevenue,
        retailRevenue: filteredMetrics.retailRevenue,
        wholesaleRevenue: filteredMetrics.wholesaleRevenue,
        totalExpenses: filteredMetrics.totalExpenses,
        supplierExpenses: filteredMetrics.supplierExpenses,
        operationalExpenses: filteredMetrics.operationalExpenses,
        netProfit: filteredMetrics.netProfit,
        profitMargin: filteredMetrics.profitMargin,
        paidInvoicesCount: filteredMetrics.paidInvoicesCount,
        unpaidAmount: filteredMetrics.unpaidAmount,
      },
      isAr
    );
  };

  const handleExportCSV = () => {
    const data = [
      { Metric: 'Gross Revenue', Amount: filteredMetrics.grossRevenue },
      { Metric: 'Retail Revenue (B2C)', Amount: filteredMetrics.retailRevenue },
      { Metric: 'Wholesale Revenue (B2B)', Amount: filteredMetrics.wholesaleRevenue },
      { Metric: 'Supplier Expenses (COGS)', Amount: filteredMetrics.supplierExpenses },
      { Metric: 'Operational Expenses', Amount: filteredMetrics.operationalExpenses },
      { Metric: 'Total Expenses', Amount: filteredMetrics.totalExpenses },
      { Metric: 'Gross Profit', Amount: filteredMetrics.grossProfit },
      { Metric: 'Net Profit', Amount: filteredMetrics.netProfit },
      { Metric: 'Profit Margin (%)', Amount: `${filteredMetrics.profitMargin.toFixed(1)}%` },
      { Metric: 'Unpaid Receivables', Amount: filteredMetrics.unpaidAmount },
    ];
    exportToCSV(data, `Financial_Report_${periodPreset}_${new Date().toISOString().split('T')[0]}`);
    showToast(tr('تم تصدير التقرير المالي بنجاح', 'Rapport exporté en CSV'), 'success');
  };

  return (
    <div className="space-y-6">
      {/* Time & Segment Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodPreset(p)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                periodPreset === p
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {p === 'daily'
                ? tr('يومي', 'Quotidien')
                : p === 'weekly'
                ? tr('أسبوعي', 'Hebdomadaire')
                : p === 'monthly'
                ? tr('شهري', 'Mensuel')
                : p === 'yearly'
                ? tr('سنوي', 'Annuel')
                : tr('مخصص', 'Personnalisé')}
            </button>
          ))}

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 ms-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-slate-950 border border-slate-700/80 text-slate-100 placeholder:text-slate-500 caret-emerald-400 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors cursor-pointer"
              />
              <span className="text-slate-500">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-slate-950 border border-slate-700/80 text-slate-100 placeholder:text-slate-500 caret-emerald-400 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={customerSegmentFilter}
            onChange={(e) => setCustomerSegmentFilter(e.target.value as 'all' | 'retail' | 'wholesale')}
            style={{ colorScheme: 'dark' }}
            className="bg-slate-950 border border-slate-700/80 text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <option value="all">{tr('جميع المبيعات (B2C + B2B)', 'Toutes ventes')}</option>
            <option value="retail">{tr('مبيعات التجزئة (B2C) فقط', 'Retail (B2C) seulement')}</option>
            <option value="wholesale">{tr('مبيعات الجملة (B2B) فقط', 'Wholesale (B2B) seulement')}</option>
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{tr('طباعة / PDF', 'Imprimer PDF')}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{tr('تصدير CSV', 'CSV')}</span>
          </button>
        </div>
      </div>

      {/* Financial Statement Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100">{tr('قائمة الدخل والنتائج المالية الرسمية', 'Compte de Résultat Financier')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{tr('ملخص الإيرادات، التكاليف المباشرة، والمصاريف التشغيلية', 'Aperçu global des ventes, coûts et bénéfices')}</p>
          </div>
          <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold rounded-full uppercase">
            {periodPreset}
          </span>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-3 text-xs">
          {/* Revenue */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-slate-100">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                {tr('إجمالي المبيادات والإيرادات (Gross Revenue)', 'Chiffre d\'Affaires Brut')}
              </span>
              <span className="text-emerald-400 text-base">{formatPrice(filteredMetrics.grossRevenue)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
              <div>{tr('مبيعات التجزئة (B2C):', 'Retail (B2C):')} <strong className="text-slate-200">{formatPrice(filteredMetrics.retailRevenue)}</strong></div>
              <div>{tr('مبيعات الجملة (B2B):', 'Wholesale (B2B):')} <strong className="text-indigo-400">{formatPrice(filteredMetrics.wholesaleRevenue)}</strong></div>
            </div>
          </div>

          {/* COGS / Supplier Expenses */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-slate-100">
              <span className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                {tr('تكلفة البضاعة والموردين (Cost of Goods Sold - COGS)', 'Coût des Marchandises Vendues')}
              </span>
              <span className="text-rose-400 text-base">-{formatPrice(filteredMetrics.supplierExpenses)}</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex justify-between items-center text-sm font-extrabold text-slate-200">
            <span>{tr('إجمالي مجمل الربح (Gross Profit)', 'Marge Brute')}</span>
            <span className="text-teal-400">{formatPrice(filteredMetrics.grossProfit)}</span>
          </div>

          {/* Operational Expenses */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-slate-100">
              <span className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                {tr('المصاريف التشغيلية (تسويق، شحن، إيجار، رواتب)', 'Dépenses Opérationnelles (OpEx)')}
              </span>
              <span className="text-amber-400 text-base">-{formatPrice(filteredMetrics.operationalExpenses)}</span>
            </div>
          </div>

          {/* Net Profit Summary */}
          <div className="p-5 bg-gradient-to-r from-emerald-950/60 to-slate-950 rounded-2xl border-2 border-emerald-500/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{tr('صافي الدخل التشغيلي (Net Operating Profit)', 'Résultat Net D\'Exploitation')}</span>
              <p className="text-3xl font-black text-emerald-400 mt-1">{formatPrice(filteredMetrics.netProfit)}</p>
            </div>
            <div className="text-end">
              <span className="text-xs text-slate-400">{tr('هامش الربح الصافي:', 'Marge Nette:')}</span>
              <div className="text-2xl font-black text-teal-300">{filteredMetrics.profitMargin.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
