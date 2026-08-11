import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, FileText, CreditCard, DollarSign, TrendingDown,
  BarChart3, History
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

import {
  FinanceInvoice, FinancePayment, FinanceExpense, FinanceActivityLog,
  FinanceSettings, InvoiceStatus
} from '../../types/finance';

import FinanceDashboard from '../../components/finance/FinanceDashboard';
import FinanceInvoices from '../../components/finance/FinanceInvoices';
import FinancePayments from '../../components/finance/FinancePayments';
import FinanceExpenses from '../../components/finance/FinanceExpenses';
import FinanceReports from '../../components/finance/FinanceReports';
import FinanceActivityLogView from '../../components/finance/FinanceActivityLogView';

import { ensureAuthenticatedAdmin } from '../../lib/storage';
import {
  fetchInvoicesFromDB,
  upsertInvoiceInDB,
  deleteInvoiceFromDB,
  fetchPaymentsFromDB,
  upsertPaymentInDB,
  deletePaymentFromDB,
  fetchExpensesFromDB,
  upsertExpenseInDB,
  deleteExpenseFromDB,
  fetchFinanceLogsFromDB,
  addFinanceLogToDB,
  loadInvoicesLocal,
  loadPaymentsLocal,
  loadExpensesLocal,
  loadLogsLocal,
} from '../../lib/financeStore';

export default function AdminFinance() {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'payments' | 'expenses' | 'reports' | 'logs'>('dashboard');

  // Main Finance Entities State
  const [invoices, setInvoices] = useState<FinanceInvoice[]>(() => loadInvoicesLocal());
  const [payments, setPayments] = useState<FinancePayment[]>(() => loadPaymentsLocal());
  const [expenses, setExpenses] = useState<FinanceExpense[]>(() => loadExpensesLocal());
  const [activityLogs, setActivityLogs] = useState<FinanceActivityLog[]>(() => loadLogsLocal());

  const [settings, setSettings] = useState<FinanceSettings>(() => {
    const saved = localStorage.getItem('store_finance_settings');
    return saved ? JSON.parse(saved) : { tax_rate: 0, currency: 'DZD', fiscal_number: '', invoice_prefix: 'INV-2026-' };
  });

  const [loading, setLoading] = useState(false);

  // Fetch all finance data from Supabase
  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const [invData, payData, expData, logData] = await Promise.all([
        fetchInvoicesFromDB(),
        fetchPaymentsFromDB(),
        fetchExpensesFromDB(),
        fetchFinanceLogsFromDB()
      ]);
      setInvoices(invData);
      setPayments(payData);
      setExpenses(expData);
      setActivityLogs(logData);
    } catch (e) {
      console.error('Error fetching finance data from DB:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    localStorage.setItem('store_finance_settings', JSON.stringify(settings));
  }, [settings]);

  // Invoice Handlers
  const handleAddInvoice = async (newInv: Omit<FinanceInvoice, 'id' | 'created_at' | 'updated_at'>) => {
    await ensureAuthenticatedAdmin();
    const invoiceNum = newInv.invoice_number || `${settings.invoice_prefix}${Date.now().toString().slice(-4)}`;
    const invPayload: Partial<FinanceInvoice> = {
      ...newInv,
      invoice_number: invoiceNum,
      balance_due: newInv.total_amount - (newInv.paid_amount || 0)
    };
    const res = await upsertInvoiceInDB(invPayload);
    if (res.success) {
      await addFinanceLogToDB('invoice_created', isAr ? 'مدير النظام' : 'Admin', `تم إنشاء الفاتورة ${invoiceNum} بقيمة ${invPayload.total_amount} دج للعميل ${invPayload.customer_name}`);
      await loadFinanceData();
    }
  };

  const handleUpdateInvoice = async (updated: FinanceInvoice) => {
    await ensureAuthenticatedAdmin();
    const invPayload = {
      ...updated,
      balance_due: updated.total_amount - updated.paid_amount
    };
    const res = await upsertInvoiceInDB(invPayload);
    if (res.success) {
      await addFinanceLogToDB('invoice_updated', isAr ? 'مدير النظام' : 'Admin', `تم تعديل الفاتورة ${updated.invoice_number} - الحالة الحالية: ${updated.status}`);
      await loadFinanceData();
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    await ensureAuthenticatedAdmin();
    const res = await deleteInvoiceFromDB(id);
    if (res.success) {
      if (inv) {
        await addFinanceLogToDB('invoice_deleted', isAr ? 'مدير النظام' : 'Admin', `تم حذف الفاتورة ${inv.invoice_number}`);
      }
      await loadFinanceData();
    }
  };

  const handleBulkDeleteInvoices = async (ids: string[]) => {
    await ensureAuthenticatedAdmin();
    for (const id of ids) {
      await deleteInvoiceFromDB(id);
    }
    await addFinanceLogToDB('bulk_invoices_deleted', isAr ? 'مدير النظام' : 'Admin', `تم حذف ${ids.length} فاتورة دفعة واحدة`);
    await loadFinanceData();
  };

  const handleBulkUpdateInvoiceStatus = async (ids: string[], status: InvoiceStatus) => {
    await ensureAuthenticatedAdmin();
    for (const id of ids) {
      const inv = invoices.find(i => i.id === id);
      if (inv) {
        const paid = status === 'paid' ? inv.total_amount : status === 'draft' || status === 'unpaid' ? 0 : inv.paid_amount;
        const balance = Math.max(0, inv.total_amount - paid);
        await upsertInvoiceInDB({
          ...inv,
          status,
          paid_amount: paid,
          balance_due: balance
        });
      }
    }
    await addFinanceLogToDB('bulk_status_changed', isAr ? 'مدير النظام' : 'Admin', `تم تغيير حالة ${ids.length} فاتورة إلى ${status}`);
    await loadFinanceData();
  };

  // Payment Handlers
  const handleAddPayment = async (newPay: Omit<FinancePayment, 'id' | 'created_at'>) => {
    await ensureAuthenticatedAdmin();
    const payNum = newPay.payment_number || `PAY-${Date.now().toString().slice(-6)}`;
    const res = await upsertPaymentInDB({ ...newPay, payment_number: payNum });
    if (res.success) {
      // Update attached invoice if applicable
      if (newPay.invoice_id) {
        const inv = invoices.find((i) => i.id === newPay.invoice_id);
        if (inv) {
          const nextPaid = inv.paid_amount + newPay.amount;
          const nextBalance = Math.max(0, inv.total_amount - nextPaid);
          const nextStatus: InvoiceStatus = nextBalance === 0 ? 'paid' : nextPaid > 0 ? 'partially_paid' : inv.status;
          await upsertInvoiceInDB({
            ...inv,
            paid_amount: nextPaid,
            balance_due: nextBalance,
            status: nextStatus
          });
        }
      }

      await addFinanceLogToDB('payment_recorded', isAr ? 'مدير النظام' : 'Admin', `تم تسجيل دفعة قدرها ${newPay.amount} دج من العميل ${newPay.customer_name}`);
      await loadFinanceData();
    }
  };

  const handleUpdatePayment = async (updated: FinancePayment) => {
    await ensureAuthenticatedAdmin();
    const res = await upsertPaymentInDB(updated);
    if (res.success) {
      await addFinanceLogToDB('payment_updated', isAr ? 'مدير النظام' : 'Admin', `تم تعديل سجل الدفع ${updated.payment_number}`);
      await loadFinanceData();
    }
  };

  const handleDeletePayment = async (id: string) => {
    const target = payments.find((p) => p.id === id);
    await ensureAuthenticatedAdmin();
    const res = await deletePaymentFromDB(id);
    if (res.success) {
      if (target) {
        await addFinanceLogToDB('payment_deleted', isAr ? 'مدير النظام' : 'Admin', `تم حذف سجل الدفع ${target.payment_number}`);
      }
      await loadFinanceData();
    }
  };

  // Expense Handlers
  const handleAddExpense = async (newExp: Omit<FinanceExpense, 'id' | 'created_at'>) => {
    await ensureAuthenticatedAdmin();
    const expNum = newExp.expense_number || `EXP-${Date.now().toString().slice(-6)}`;
    const res = await upsertExpenseInDB({ ...newExp, expense_number: expNum });
    if (res.success) {
      await addFinanceLogToDB('expense_added', isAr ? 'مدير النظام' : 'Admin', `تم تسجيل مصروف جديد بقيمة ${newExp.amount} دج (${newExp.title})`);
      await loadFinanceData();
    }
  };

  const handleUpdateExpense = async (updated: FinanceExpense) => {
    await ensureAuthenticatedAdmin();
    const res = await upsertExpenseInDB(updated);
    if (res.success) {
      await addFinanceLogToDB('expense_updated', isAr ? 'مدير النظام' : 'Admin', `تم تعديل المصروف ${updated.expense_number}`);
      await loadFinanceData();
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    await ensureAuthenticatedAdmin();
    const res = await deleteExpenseFromDB(id);
    if (res.success) {
      if (target) {
        await addFinanceLogToDB('expense_deleted', isAr ? 'مدير النظام' : 'Admin', `تم حذف المصروف ${target.expense_number}`);
      }
      await loadFinanceData();
    }
  };

  const handleImportExpensesCSV = async (imported: Omit<FinanceExpense, 'id' | 'created_at'>[]) => {
    await ensureAuthenticatedAdmin();
    for (let i = 0; i < imported.length; i++) {
      const exp = imported[i];
      const expNum = exp.expense_number || `EXP-IMP-${Date.now().toString().slice(-4)}-${i}`;
      await upsertExpenseInDB({ ...exp, expense_number: expNum });
    }
    await addFinanceLogToDB('expenses_imported_csv', isAr ? 'مدير النظام' : 'Admin', `تم استيراد ${imported.length} مصروف عن طريق CSV`);
    await loadFinanceData();
  };

  return (
    <div dir={dir} className="space-y-6 pb-12 text-slate-100">
      {/* Module Title & Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100">
                {tr('الإدارة المالية والمحاسبة', 'Gestion Financière & Comptabilité')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {tr('إدارة الفواتير، الدفعات المحصلة، المصاريف، والتقارير المالية الرسمية', 'Factures, paiements, dépenses et rapports financiers')}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector Pill */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto">
          {[
            { id: 'dashboard' as const, label: tr('لوحة القيادة', 'Tableau de bord'), icon: LayoutDashboard },
            { id: 'invoices' as const, label: tr('الفواتير', 'Factures'), icon: FileText, badge: invoices.length },
            { id: 'payments' as const, label: tr('الدفعات', 'Paiements'), icon: CreditCard, badge: payments.length },
            { id: 'expenses' as const, label: tr('المصاريف', 'Dépenses'), icon: TrendingDown, badge: expenses.length },
            { id: 'reports' as const, label: tr('التقارير المالية', 'Rapports'), icon: BarChart3 },
            { id: 'logs' as const, label: tr('سجّل الأنشطة', 'Historique'), icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-emerald-800 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Indicator Bar */}
      {loading && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-emerald-400 animate-pulse">
          <DollarSign className="w-4 h-4 animate-spin" />
          <span>{tr('جاري تزامن البيانات المالية مع قاعدة البيانات...', 'Synchronisation des données financières...')}</span>
        </div>
      )}

      {/* Render Active View */}
      {activeTab === 'dashboard' && (
        <FinanceDashboard
          invoices={invoices}
          expenses={expenses}
          payments={payments}
          settings={settings}
          onUpdateSettings={setSettings}
          onNavigateTab={(tab) => setActiveTab(tab as 'dashboard' | 'invoices' | 'payments' | 'expenses' | 'reports' | 'logs')}
        />
      )}

      {activeTab === 'invoices' && (
        <FinanceInvoices
          invoices={invoices}
          settings={settings}
          onAddInvoice={handleAddInvoice}
          onUpdateInvoice={handleUpdateInvoice}
          onDeleteInvoice={handleDeleteInvoice}
          onBulkDelete={handleBulkDeleteInvoices}
          onBulkUpdateStatus={handleBulkUpdateInvoiceStatus}
        />
      )}

      {activeTab === 'payments' && (
        <FinancePayments
          payments={payments}
          invoices={invoices}
          onAddPayment={handleAddPayment}
          onUpdatePayment={handleUpdatePayment}
          onDeletePayment={handleDeletePayment}
        />
      )}

      {activeTab === 'expenses' && (
        <FinanceExpenses
          expenses={expenses}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          onImportExpensesCSV={handleImportExpensesCSV}
        />
      )}

      {activeTab === 'reports' && (
        <FinanceReports
          invoices={invoices}
          expenses={expenses}
          payments={payments}
        />
      )}

      {activeTab === 'logs' && (
        <FinanceActivityLogView activityLogs={activityLogs} />
      )}
    </div>
  );
}
