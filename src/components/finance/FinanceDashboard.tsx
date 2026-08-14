import { useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle2,
  AlertCircle, Building2, ShoppingBag, PieChart, BarChart3,
  CreditCard, RefreshCw, Settings, ArrowUpRight
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { FinanceInvoice, FinanceExpense, FinancePayment, FinanceSettings } from '../../types/finance';

interface Props {
  invoices: FinanceInvoice[];
  expenses: FinanceExpense[];
  payments: FinancePayment[];
  settings: FinanceSettings;
  onUpdateSettings: (s: FinanceSettings) => void;
  onNavigateTab: (tab: string) => void;
}

export default function FinanceDashboard({
  invoices,
  expenses,
  payments,
  settings,
  onUpdateSettings,
  onNavigateTab,
}: Props) {
  const { lang, formatPrice, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [taxForm, setTaxForm] = useState<FinanceSettings>(settings);

  // Core metrics
  const stats = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === 'paid' || i.paid_amount > 0);
    const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid' || i.status === 'partially_paid');
    const refundedInvoices = invoices.filter((i) => i.status === 'refunded');

    const totalRevenue = invoices
      .filter((i) => i.status !== 'cancelled' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const retailRevenue = invoices
      .filter((i) => i.customer_type === 'retail' && i.status !== 'cancelled' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const wholesaleRevenue = invoices
      .filter((i) => i.customer_type === 'wholesale' && i.status !== 'cancelled' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const pendingPayments = invoices
      .filter((i) => i.status === 'unpaid' || i.status === 'partially_paid')
      .reduce((sum, i) => sum + i.balance_due, 0);

    const paidAmountTotal = invoices.reduce((sum, i) => sum + i.paid_amount, 0);
    const unpaidAmountTotal = invoices.reduce((sum, i) => sum + i.balance_due, 0);

    const refundedAmount = refundedInvoices.reduce((sum, i) => sum + i.total_amount, 0);

    return {
      totalRevenue,
      retailRevenue,
      wholesaleRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      pendingPayments,
      paidInvoicesCount: paidInvoices.length,
      paidAmountTotal,
      unpaidInvoicesCount: unpaidInvoices.length,
      unpaidAmountTotal,
      refundedAmount,
      refundedCount: refundedInvoices.length,
    };
  }, [invoices, expenses]);

  // Payment methods breakdown
  const paymentMethodStats = useMemo(() => {
    const counts: Record<string, number> = { cod: 0, baridimob: 0, bank_transfer: 0, cib_edahabia: 0, cash: 0, check: 0 };
    payments.forEach((p) => {
      counts[p.payment_method] = (counts[p.payment_method] || 0) + p.amount;
    });
    return counts;
  }, [payments]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(taxForm);
    showToast(tr('تم حفظ الإعدادات المالية بنجاح', 'Paramètres financiers enregistrés'), 'success');
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div 
          onClick={() => onNavigateTab('invoices')}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm hover:border-emerald-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">
              {tr('إجمالي الإيرادات', 'Revenu Total')}
            </span>
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-2">{formatPrice(stats.totalRevenue)}</p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{tr('تجزئة (B2C):', 'Retail:')} <strong className="text-slate-200">{formatPrice(stats.retailRevenue)}</strong></span>
            <span className="text-indigo-400 font-bold">{tr('جملة (B2B):', 'B2B:')} {formatPrice(stats.wholesaleRevenue)}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div 
          onClick={() => onNavigateTab('expenses')}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm hover:border-rose-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-rose-400 transition-colors">
              {tr('إجمالي المصاريف', 'Dépenses Totales')}
            </span>
            <div className="p-2.5 bg-rose-950/80 border border-rose-800/80 rounded-xl text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 mt-2">{formatPrice(stats.totalExpenses)}</p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{tr('عدد المصاريف:', 'Nombre:')} <strong className="text-slate-200">{expenses.length}</strong></span>
            <span className="text-rose-400 hover:underline font-bold flex items-center gap-0.5">
              {tr('إدارة المصاريف', 'Gérer')} <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div 
          onClick={() => onNavigateTab('reports')}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm hover:border-teal-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-teal-400 transition-colors">
              {tr('صافي الأرباح', 'Bénéfice Net')}
            </span>
            <div className={`p-2.5 rounded-xl border ${stats.netProfit >= 0 ? 'bg-teal-950/80 border-teal-800/80 text-teal-400' : 'bg-rose-950/80 border-rose-800/80 text-rose-400'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className={`text-2xl font-black mt-2 ${stats.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            {formatPrice(stats.netProfit)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{tr('هامش الربح:', 'Marge:')}</span>
            <span className={`px-2 py-0.5 rounded-full font-extrabold ${stats.profitMargin >= 20 ? 'bg-teal-950 border border-teal-700 text-teal-300' : 'bg-amber-950 border border-amber-700 text-amber-300'}`}>
              {stats.profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Pending Payments */}
        <div 
          onClick={() => onNavigateTab('invoices')}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm hover:border-amber-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
              {tr('مدفوعات معلقة', 'Paiements en Attente')}
            </span>
            <div className="p-2.5 bg-amber-950/80 border border-amber-800/80 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400 mt-2">{formatPrice(stats.pendingPayments)}</p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{tr('فواتير غير مسددة:', 'Inimpayées:')} <strong className="text-amber-300">{stats.unpaidInvoicesCount}</strong></span>
            <span className="text-amber-400 hover:underline font-bold flex items-center gap-0.5">
              {tr('متابعة الفواتير', 'Relancer')} <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Paid Invoices */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {tr('فواتير مدفوعة', 'Factures Payées')}
            </span>
            <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-100 mt-1">{stats.paidInvoicesCount} <span className="text-xs font-medium text-slate-400">({formatPrice(stats.paidAmountTotal)})</span></p>
        </div>

        {/* Unpaid Invoices */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {tr('فواتير غير مدفوعة', 'Factures Non Payées')}
            </span>
            <div className="p-2 bg-amber-950 border border-amber-800 text-amber-400 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-100 mt-1">{stats.unpaidInvoicesCount} <span className="text-xs font-medium text-slate-400">({formatPrice(stats.unpaidAmountTotal)})</span></p>
        </div>

        {/* Refunded Amount */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {tr('المبالغ المسترجعة', 'Montant Remboursé')}
            </span>
            <div className="p-2 bg-purple-950 border border-purple-800 text-purple-400 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-purple-300 mt-1">{formatPrice(stats.refundedAmount)} <span className="text-xs font-medium text-slate-400">({stats.refundedCount})</span></p>
        </div>

        {/* Wholesale vs Retail Ratio */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {tr('حجم مبيعات الجملة', 'Volume B2B')}
            </span>
            <div className="p-2 bg-indigo-950 border border-indigo-800 text-indigo-400 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-indigo-300 mt-1">
            {stats.totalRevenue > 0 ? ((stats.wholesaleRevenue / stats.totalRevenue) * 100).toFixed(1) : '0'}%
            <span className="text-xs font-normal text-slate-400 ms-2">من المبيعات</span>
          </p>
        </div>
      </div>

      {/* Visual Analytics & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retail vs Wholesale Revenue Comparison */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-slate-100 text-sm">{tr('مقارنة المبيعات: التجزئة (B2C) مقابل الجملة (B2B)', 'Aperçu Ventes: Retail vs Wholesale')}</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{invoices.length} {tr('فاتورة', 'factures')}</span>
          </div>

          {/* Visual Split Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                {tr('التجزئة:', 'Retail:')} {formatPrice(stats.retailRevenue)}
              </span>
              <span className="text-indigo-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {tr('الجملة (B2B):', 'B2B Wholesale:')} {formatPrice(stats.wholesaleRevenue)}
              </span>
            </div>
            <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800 p-0.5">
              <div
                className="bg-emerald-500 h-full rounded-s-full transition-all duration-500"
                style={{ width: `${stats.totalRevenue > 0 ? (stats.retailRevenue / stats.totalRevenue) * 100 : 50}%` }}
                title={`Retail: ${formatPrice(stats.retailRevenue)}`}
              />
              <div
                className="bg-indigo-500 h-full rounded-e-full transition-all duration-500"
                style={{ width: `${stats.totalRevenue > 0 ? (stats.wholesaleRevenue / stats.totalRevenue) * 100 : 50}%` }}
                title={`Wholesale: ${formatPrice(stats.wholesaleRevenue)}`}
              />
            </div>
          </div>

          {/* Revenue & Expenses Bar Visualization */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{tr('التحليل المالي السريع', 'Bilan Rapide')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">{tr('نسبة المصاريف للإيراد', 'Ratio Dépenses/Revenu')}</span>
                <p className="text-lg font-bold text-rose-400 mt-0.5">
                  {stats.totalRevenue > 0 ? ((stats.totalExpenses / stats.totalRevenue) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">{tr('نسبة تحصيل الديون', 'Taux de Recouvrement')}</span>
                <p className="text-lg font-bold text-teal-400 mt-0.5">
                  {stats.totalRevenue > 0 ? ((stats.paidAmountTotal / stats.totalRevenue) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <PieChart className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">{tr('توزيع طرق الدفع المحصلة', 'Méthodes de Paiement')}</h3>
          </div>

          <div className="space-y-3">
            {[
              { id: 'cod', label: tr('الدفع عند الاستلام (COD)', 'Livraison (COD)'), color: 'bg-amber-500' },
              { id: 'baridimob', label: tr('بريدي موب (BaridiMob)', 'BaridiMob'), color: 'bg-emerald-500' },
              { id: 'bank_transfer', label: tr('تحويل بنكي / CCP', 'Virement / CCP'), color: 'bg-blue-500' },
              { id: 'cib_edahabia', label: tr('CIB / الذهبية', 'CIB / Edahabia'), color: 'bg-indigo-500' },
              { id: 'cash', label: tr('نقداً بالمكتب', 'Espèces'), color: 'bg-teal-500' },
            ].map((m) => {
              const val = paymentMethodStats[m.id] || 0;
              const totalP = Object.values(paymentMethodStats).reduce((a, b) => a + b, 1);
              const pct = ((val / totalP) * 100).toFixed(0);

              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">{m.label}</span>
                    <span className="text-slate-400 font-mono">{formatPrice(val)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Payment Reconciliation & Recent Invoices */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-base">{tr('مطابقة وتسوية المعاملات الأخيرة', 'Réconciliation Récente')}</h3>
          </div>
          <button onClick={() => onNavigateTab('invoices')} className="text-xs font-bold text-emerald-400 hover:underline">
            {tr('عرض كل الفواتير', 'Voir toutes les factures')} →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3 text-start">{tr('الفاتورة', 'Facture')}</th>
                <th className="py-2.5 px-3 text-start">{tr('العميل', 'Client')}</th>
                <th className="py-2.5 px-3 text-start">{tr('القطاع', 'Secteur')}</th>
                <th className="py-2.5 px-3 text-start">{tr('التاريخ', 'Date')}</th>
                <th className="py-2.5 px-3 text-end">{tr('المبلغ Total', 'Montant')}</th>
                <th className="py-2.5 px-3 text-end">{tr('المدفوع', 'Payé')}</th>
                <th className="py-2.5 px-3 text-center">{tr('الحالة', 'Statut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invoices.slice(0, 6).map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-950/40 transition">
                  <td className="py-3 px-3 font-mono font-bold text-slate-100">{inv.invoice_number}</td>
                  <td className="py-3 px-3 font-medium text-slate-200">{inv.customer_name}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.customer_type === 'wholesale' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>
                      {inv.customer_type === 'wholesale' ? tr('جملة (B2B)', 'Wholesale') : tr('تجزئة', 'Retail')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{formatDate(inv.issue_date)}</td>
                  <td className="py-3 px-3 text-end font-bold text-slate-100">{formatPrice(inv.total_amount)}</td>
                  <td className="py-3 px-3 text-end font-semibold text-emerald-400">{formatPrice(inv.paid_amount)}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      inv.status === 'paid' ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' :
                      inv.status === 'partially_paid' ? 'bg-cyan-950 border border-cyan-800 text-cyan-400' :
                      inv.status === 'unpaid' ? 'bg-amber-950 border border-amber-800 text-amber-400' :
                      'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax & Fiscal Settings Box */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Settings className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-slate-100 text-sm">{tr('إعدادات الضرائب والعملة الرسمية للمتجر', 'Fiscalité & Devise du Magasin')}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">{tr('نسبة الضريبة TVA (%)', 'Taux de taxe (%)')}</label>
            <input
              type="number"
              min="0"
              max="100"
              value={taxForm.tax_rate}
              onChange={(e) => setTaxForm({ ...taxForm, tax_rate: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">{tr('عملة المتجر الرئيسية', 'Devise officielle')}</label>
            <input
              type="text"
              value={taxForm.currency}
              onChange={(e) => setTaxForm({ ...taxForm, currency: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">{tr('رقم التسجيل الجبائي (N° Fiscal)', 'N° Identification Fiscale')}</label>
            <input
              type="text"
              value={taxForm.fiscal_number}
              onChange={(e) => setTaxForm({ ...taxForm, fiscal_number: e.target.value })}
              placeholder="0020192837465..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1">{tr('بادئة الفواتير', 'Préfixe factures')}</label>
            <input
              type="text"
              value={taxForm.invoice_prefix}
              onChange={(e) => setTaxForm({ ...taxForm, invoice_prefix: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-950/50">
            {tr('حفظ الإعدادات المالية', 'Enregistrer la configuration')}
          </button>
        </div>
      </form>
    </div>
  );
}
