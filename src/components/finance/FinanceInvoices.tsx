import { useState, useMemo } from 'react';
import {
  Search, Plus, Trash2, Printer, Send, Edit2, CheckSquare, Square,
  ChevronLeft, ChevronRight, FileSpreadsheet, X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import { FinanceInvoice, FinanceInvoiceItem, CustomerType, InvoiceStatus, FinanceSettings } from '../../types/finance';
import { printFinanceInvoice } from '../../utils/financePrint';
import { exportToCSV } from '../../lib/csvHelper';

interface Props {
  invoices: FinanceInvoice[];
  settings: FinanceSettings;
  onAddInvoice: (inv: Omit<FinanceInvoice, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateInvoice: (inv: FinanceInvoice) => void;
  onDeleteInvoice: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkUpdateStatus: (ids: string[], status: InvoiceStatus) => void;
}

export default function FinanceInvoices({
  invoices,
  settings,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onBulkDelete,
  onBulkUpdateStatus,
}: Props) {
  const { lang, formatPrice, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<FinanceInvoice | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    id?: string;
    number?: string;
    error?: string | null;
  }>({ isOpen: false, type: 'single' });
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State for Create / Edit
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formCustomerType, setFormCustomerType] = useState<CustomerType>('retail');
  const [formIssueDate, setFormIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [formItems, setFormItems] = useState<FinanceInvoiceItem[]>([
    { id: '1', description: 'منتج / خدمة', quantity: 1, unit_price: 1000, total: 1000 }
  ]);
  const [formTaxRate, setFormTaxRate] = useState(settings.tax_rate || 0);
  const [formShipping, setFormShipping] = useState(0);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formPaidAmount, setFormPaidAmount] = useState(0);
  const [formStatus, setFormStatus] = useState<InvoiceStatus>('unpaid');
  const [formNotes, setFormNotes] = useState('');

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_name.toLowerCase().includes(q) ||
        (inv.customer_phone && inv.customer_phone.includes(q)) ||
        (inv.order_number && inv.order_number.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchType = typeFilter === 'all' || inv.customer_type === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [invoices, searchQuery, statusFilter, typeFilter]);

  // Paginated list
  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Selection handlers
  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);
  const isAllSelected = paginatedInvoices.length > 0 && paginatedInvoices.every((i) => selectedIds[i.id]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      paginatedInvoices.forEach((i) => { next[i.id] = true; });
      setSelectedIds(next);
    }
  };

  const openCreateModal = () => {
    setEditingInvoice(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerEmail('');
    setFormCustomerType('retail');
    setFormIssueDate(new Date().toISOString().split('T')[0]);
    setFormTaxRate(settings.tax_rate || 0);
    setFormShipping(0);
    setFormDiscount(0);
    setFormPaidAmount(0);
    setFormStatus('unpaid');
    setFormNotes('');
    setFormItems([{ id: '1', description: 'منتج / خدمة', quantity: 1, unit_price: 1000, total: 1000 }]);
    setCreateModalOpen(true);
  };

  const openEditModal = (inv: FinanceInvoice) => {
    setEditingInvoice(inv);
    setFormCustomerName(inv.customer_name);
    setFormCustomerPhone(inv.customer_phone || '');
    setFormCustomerEmail(inv.customer_email || '');
    setFormCustomerType(inv.customer_type);
    setFormIssueDate(inv.issue_date);
    setFormDueDate(inv.due_date);
    setFormItems(inv.items.length > 0 ? inv.items : [{ id: '1', description: 'منتج', quantity: 1, unit_price: inv.total_amount, total: inv.total_amount }]);
    setFormTaxRate(inv.tax_rate);
    setFormShipping(inv.shipping_amount);
    setFormDiscount(inv.discount_amount);
    setFormPaidAmount(inv.paid_amount);
    setFormStatus(inv.status);
    setFormNotes(inv.notes || '');
    setCreateModalOpen(true);
  };

  const handleAddItem = () => {
    setFormItems([
      ...formItems,
      { id: Date.now().toString(), description: '', quantity: 1, unit_price: 0, total: 0 }
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof FinanceInvoiceItem, value: string | number) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      item.total = Number(item.quantity) * Number(item.unit_price);
    }
    updated[index] = item;
    setFormItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Subtotals calculation
  const calculatedSubtotal = useMemo(() => formItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0), [formItems]);
  const calculatedTax = useMemo(() => (calculatedSubtotal * (Number(formTaxRate) || 0)) / 100, [calculatedSubtotal, formTaxRate]);
  const calculatedTotal = useMemo(() => calculatedSubtotal + calculatedTax + Number(formShipping) - Number(formDiscount), [calculatedSubtotal, calculatedTax, formShipping, formDiscount]);
  const calculatedBalance = useMemo(() => Math.max(0, calculatedTotal - Number(formPaidAmount)), [calculatedTotal, formPaidAmount]);

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      showToast(tr('يرجى إدخال اسم العميل', 'Veuillez saisir le nom du client'), 'error');
      return;
    }

    if (editingInvoice) {
      const updated: FinanceInvoice = {
        ...editingInvoice,
        customer_name: formCustomerName,
        customer_phone: formCustomerPhone,
        customer_email: formCustomerEmail,
        customer_type: formCustomerType,
        issue_date: formIssueDate,
        due_date: formDueDate,
        items: formItems,
        subtotal: calculatedSubtotal,
        tax_rate: formTaxRate,
        tax_amount: calculatedTax,
        shipping_amount: formShipping,
        discount_amount: formDiscount,
        total_amount: calculatedTotal,
        paid_amount: formPaidAmount,
        balance_due: calculatedBalance,
        status: calculatedBalance === 0 && calculatedTotal > 0 ? 'paid' : formStatus,
        notes: formNotes,
        updated_at: new Date().toISOString(),
      };
      onUpdateInvoice(updated);
      showToast(tr('تم تحديث الفاتورة بنجاح', 'Facture mise à jour'), 'success');
    } else {
      const invNum = `${settings.invoice_prefix || 'INV-2026-'}${Math.floor(1000 + Math.random() * 9000)}`;
      onAddInvoice({
        invoice_number: invNum,
        customer_name: formCustomerName,
        customer_phone: formCustomerPhone,
        customer_email: formCustomerEmail,
        customer_type: formCustomerType,
        issue_date: formIssueDate,
        due_date: formDueDate,
        items: formItems,
        subtotal: calculatedSubtotal,
        tax_rate: formTaxRate,
        tax_amount: calculatedTax,
        shipping_amount: formShipping,
        discount_amount: formDiscount,
        total_amount: calculatedTotal,
        paid_amount: formPaidAmount,
        balance_due: calculatedBalance,
        status: calculatedBalance === 0 && calculatedTotal > 0 ? 'paid' : formStatus,
        notes: formNotes,
      });
      showToast(tr('تم إنشاء الفاتورة الجديدة بنجاح', 'Facture créée avec succès'), 'success');
    }
    setCreateModalOpen(false);
  };

  const handleExportSelectedCSV = () => {
    const selectedList = invoices.filter((i) => selectedIds[i.id]);
    const exportData = (selectedList.length > 0 ? selectedList : filteredInvoices).map((i) => ({
      'Invoice Number': i.invoice_number,
      'Customer Name': i.customer_name,
      'Customer Phone': i.customer_phone || '',
      'Customer Type': i.customer_type,
      'Issue Date': i.issue_date,
      'Due Date': i.due_date,
      'Total Amount': i.total_amount,
      'Paid Amount': i.paid_amount,
      'Balance Due': i.balance_due,
      'Status': i.status,
    }));
    exportToCSV(exportData, `Invoices_Export_${new Date().toISOString().split('T')[0]}`);
    showToast(tr('تم تصدير الفواتير إلى ملف CSV', 'Factures exportées en CSV'), 'success');
  };

  const handleSendInvoiceNotification = (inv: FinanceInvoice) => {
    showToast(
      tr(
        `تم إرسال الفاتورة ${inv.invoice_number} إلى العميل ${inv.customer_name} عبر الواتساب/البريد الإلكتروني`,
        `Facture ${inv.invoice_number} envoyée au client ${inv.customer_name}`
      ),
      'success'
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('بحث برقم الفاتورة، اسم العميل، الهاتف...', 'Recherche par N° facture, nom client, tél...')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('جميع الحالات', 'Tous les statuts')}</option>
            <option value="paid">{tr('مدفوع بالكامل', 'Payé')}</option>
            <option value="partially_paid">{tr('مدفوع جزئياً', 'Payé partiellement')}</option>
            <option value="unpaid">{tr('غير مدفوع', 'Non payé')}</option>
            <option value="refunded">{tr('مسترجع', 'Remboursé')}</option>
            <option value="cancelled">{tr('ملغى', 'Annulé')}</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('كل القطاعات', 'Tous secteurs')}</option>
            <option value="retail">{tr('تجزئة (B2C)', 'Retail (B2C)')}</option>
            <option value="wholesale">{tr('جملة (B2B)', 'Wholesale (B2B)')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSelectedCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{tr('تصدير CSV', 'Exporter CSV')}</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>{tr('إنشاء فاتورة جديدة', 'Nouvelle facture')}</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between bg-emerald-950/60 border border-emerald-800/80 px-4 py-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <CheckSquare className="w-4 h-4" />
            <span>{tr(`تم تحديد ${selectedCount} فاتورة`, `${selectedCount} factures sélectionnées`)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
                onBulkUpdateStatus(ids, 'paid');
                setSelectedIds({});
                showToast(tr('تم تعيين الفواتير المحددة كمدفوعة', 'Factures marquées comme payées'), 'success');
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition"
            >
              {tr('تحديد كمدفوعة', 'Marquer Payées')}
            </button>
            <button
              onClick={() => {
                const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
                onBulkUpdateStatus(ids, 'unpaid');
                setSelectedIds({});
                showToast(tr('تم تعيين الفواتير المحددة كغير مدفوعة', 'Factures marquées non payées'), 'info');
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition"
            >
              {tr('تحديد كغير مدفوعة', 'Marquer Non Payées')}
            </button>
            <button
              onClick={() => {
                const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
                setDeleteModal({
                  isOpen: true,
                  type: 'bulk',
                  number: `${ids.length}`,
                  error: null,
                });
              }}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{tr('حذف المحدد', 'Supprimer')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3 text-center w-10">
                  <button onClick={toggleSelectAll}>
                    {isAllSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="py-3 px-3 text-start">{tr('رقم الفاتورة', 'N° Facture')}</th>
                <th className="py-3 px-3 text-start">{tr('اسم العميل', 'Client')}</th>
                <th className="py-3 px-3 text-start">{tr('القطاع', 'Secteur')}</th>
                <th className="py-3 px-3 text-start">{tr('تاريخ الاصدار / الاستحقاق', 'Dates')}</th>
                <th className="py-3 px-3 text-end">{tr('الإجمالي', 'Total')}</th>
                <th className="py-3 px-3 text-end">{tr('المدفوع', 'Payé')}</th>
                <th className="py-3 px-3 text-end">{tr('المتبقي', 'Solde')}</th>
                <th className="py-3 px-3 text-center">{tr('الحالة', 'Statut')}</th>
                <th className="py-3 px-3 text-center">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    {tr('لا توجد فواتير مطابقة للبحث', 'Aucune facture trouvée')}
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const isChecked = !!selectedIds[inv.id];
                  return (
                    <tr key={inv.id} className={`hover:bg-slate-950/40 transition ${isChecked ? 'bg-emerald-950/20' : ''}`}>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => setSelectedIds({ ...selectedIds, [inv.id]: !isChecked })}>
                          {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-100">
                        {inv.invoice_number}
                        {inv.order_number && (
                          <span className="block text-[10px] font-normal text-slate-400">#{inv.order_number}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {inv.customer_name}
                        {inv.customer_phone && <span className="block text-[10px] font-normal text-slate-400" dir="ltr">{inv.customer_phone}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.customer_type === 'wholesale' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>
                          {inv.customer_type === 'wholesale' ? tr('جملة (B2B)', 'Wholesale') : tr('تجزئة', 'Retail')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        <div>{formatDate(inv.issue_date)}</div>
                        <div className="text-[10px] text-amber-400 font-mono">{tr('استحقاق:', 'Échéance:')} {formatDate(inv.due_date)}</div>
                      </td>
                      <td className="py-3 px-3 text-end font-bold text-slate-100">{formatPrice(inv.total_amount)}</td>
                      <td className="py-3 px-3 text-end font-semibold text-emerald-400">{formatPrice(inv.paid_amount)}</td>
                      <td className="py-3 px-3 text-end font-bold text-amber-400">{formatPrice(inv.balance_due)}</td>
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
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => printFinanceInvoice(inv, settings, isAr)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                            title={tr('طباعة / PDF', 'Imprimer / PDF')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendInvoiceNotification(inv)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                            title={tr('إرسال الفاتورة', 'Envoyer')}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(inv)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                            title={tr('تعديل', 'Modifier')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteModal({
                                isOpen: true,
                                type: 'single',
                                id: inv.id,
                                number: inv.invoice_number,
                                error: null,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            title={tr('حذف', 'Supprimer')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            {tr(`عرض ${paginatedInvoices.length} من إجمالي ${filteredInvoices.length} فاتورة`, `Affichage de ${paginatedInvoices.length} sur ${filteredInvoices.length} factures`)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-200">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Invoice Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {editingInvoice ? tr('تعديل الفاتورة', 'Modifier la facture') : tr('إنشاء فاتورة جديدة', 'Créer une facture')}
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('اسم العميل *', 'Nom du client *')}</label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('رقم الهاتف', 'Téléphone')}</label>
                  <input
                    type="text"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('نوع القطاع', 'Secteur')}</label>
                  <select
                    value={formCustomerType}
                    onChange={(e) => setFormCustomerType(e.target.value as CustomerType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="retail">{tr('تجزئة (B2C)', 'Retail')}</option>
                    <option value="wholesale">{tr('جملة (B2B)', 'Wholesale')}</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200">{tr('عناصر الفاتورة', 'Articles de la facture')}</h4>
                  <button type="button" onClick={handleAddItem} className="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> {tr('إضافة عنصر', 'Ajouter article')}
                  </button>
                </div>

                {formItems.map((item, idx) => (
                  <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder={tr('وصف المنتج / الخدمة', 'Description')}
                        value={item.description}
                        onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="السعر"
                        value={item.unit_price}
                        onChange={(e) => handleUpdateItem(idx, 'unit_price', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs text-end font-mono"
                      />
                    </div>
                    <div className="col-span-2 text-end font-bold text-emerald-400 font-mono">
                      {formatPrice(item.total)}
                    </div>
                    <div className="col-span-1 text-center">
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-500 hover:text-rose-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals & Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-3">
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{tr('نسبة الضريبة TVA (%)', 'Taxe (%)')}</label>
                    <input
                      type="number"
                      value={formTaxRate}
                      onChange={(e) => setFormTaxRate(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">{tr('مصاريف الشحن', 'Frais livraison')}</label>
                    <input
                      type="number"
                      value={formShipping}
                      onChange={(e) => setFormShipping(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>{tr('المجموع الفرعي:', 'Sous-total:')}</span>
                    <span>{formatPrice(calculatedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{tr('الضريبة:', 'Taxe:')}</span>
                    <span>+{formatPrice(calculatedTax)}</span>
                  </div>
                  <div className="flex justify-between text-slate-100 font-bold border-t border-slate-800 pt-1 text-sm">
                    <span>{tr('الإجمالي النهائي:', 'Montant Total:')}</span>
                    <span className="text-emerald-400">{formatPrice(calculatedTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  {tr('حفظ الفاتورة', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          setIsDeleting(true);
          try {
            if (deleteModal.type === 'single' && deleteModal.id) {
              await onDeleteInvoice(deleteModal.id);
              showToast(tr('تم حذف الفاتورة بنجاح', 'Facture supprimée'), 'success');
            } else if (deleteModal.type === 'bulk') {
              const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
              await onBulkDelete(ids);
              setSelectedIds({});
              showToast(tr('تم حذف الفواتير المحددة بنجاح', 'Factures supprimées'), 'success');
            }
            setDeleteModal({ isOpen: false, type: 'single' });
          } catch (e: unknown) {
            console.error(e);
            const msg = (e as Error)?.message || tr('حدث خطأ أثناء الحذف', 'Erreur de suppression');
            setDeleteModal(prev => ({ ...prev, error: msg }));
            showToast(msg, 'error');
          } finally {
            setIsDeleting(false);
          }
        }}
        isDeleting={isDeleting}
        itemName={deleteModal.number}
        title={deleteModal.type === 'bulk' ? tr('تأكيد حذف الفواتير المحددة', 'Confirmer la suppression des factures') : tr('تأكيد حذف الفاتورة', 'Confirmer la suppression de la facture')}
        description={deleteModal.type === 'bulk' ? tr('هل أنت متأكد من حذف الفواتير المحددة؟', 'Voulez-vous vraiment supprimer les factures sélectionnées ?') : tr('هل أنت متأكد من حذف هذه الفاتورة؟', 'Voulez-vous vraiment supprimer cette facture ?')}
        error={deleteModal.error}
      />
    </div>
  );
}
