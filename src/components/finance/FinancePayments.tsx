import { useState, useMemo } from 'react';
import {
  Search, Plus, Trash2, X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import { FinancePayment, FinanceInvoice, FinancePaymentMethod, CustomerType } from '../../types/finance';

interface Props {
  payments: FinancePayment[];
  invoices: FinanceInvoice[];
  onAddPayment: (payment: Omit<FinancePayment, 'id' | 'created_at'>) => void;
  onUpdatePayment: (payment: FinancePayment) => void;
  onDeletePayment: (id: string) => void;
}

export default function FinancePayments({
  payments,
  invoices,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
}: Props) {
  const { lang, formatPrice, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<FinancePayment | null>(null);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerType, setFormCustomerType] = useState<CustomerType>('retail');
  const [formAmount, setFormAmount] = useState(0);
  const [formMethod, setFormMethod] = useState<FinancePaymentMethod>('baridimob');
  const [formRefNumber, setFormRefNumber] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.payment_number.toLowerCase().includes(q) ||
        p.customer_name.toLowerCase().includes(q) ||
        (p.reference_number && p.reference_number.toLowerCase().includes(q)) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q));

      const matchMethod = methodFilter === 'all' || p.payment_method === methodFilter;
      const matchType = typeFilter === 'all' || p.customer_type === typeFilter;

      return matchSearch && matchMethod && matchType;
    });
  }, [payments, searchQuery, methodFilter, typeFilter]);

  const openRecordModal = () => {
    setEditingPayment(null);
    setSelectedInvoiceId('');
    setFormCustomerName('');
    setFormCustomerType('retail');
    setFormAmount(0);
    setFormMethod('baridimob');
    setFormRefNumber('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setModalOpen(true);
  };

  const handleSelectInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const target = invoices.find((i) => i.id === invId);
    if (target) {
      setFormCustomerName(target.customer_name);
      setFormCustomerType(target.customer_type);
      setFormAmount(target.balance_due);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim() || formAmount <= 0) {
      showToast(tr('يرجى التأكد من إدخال اسم العميل والمبلغ المستلم', 'Veuillez vérifier les informations'), 'error');
      return;
    }

    const targetInv = invoices.find((i) => i.id === selectedInvoiceId);

    if (editingPayment) {
      onUpdatePayment({
        ...editingPayment,
        customer_name: formCustomerName,
        customer_type: formCustomerType,
        amount: Number(formAmount),
        payment_method: formMethod,
        reference_number: formRefNumber,
        payment_date: formDate,
        notes: formNotes,
      });
      showToast(tr('تم تعديل سجل الدفع بنجاح', 'Paiement mis à jour'), 'success');
    } else {
      const payNum = `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      onAddPayment({
        payment_number: payNum,
        invoice_id: selectedInvoiceId || undefined,
        invoice_number: targetInv?.invoice_number,
        order_number: targetInv?.order_number,
        customer_name: formCustomerName,
        customer_type: formCustomerType,
        amount: Number(formAmount),
        payment_method: formMethod,
        reference_number: formRefNumber || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        payment_date: formDate,
        status: 'completed',
        notes: formNotes,
      });
      showToast(tr('تم تسجيل الدفعة بنجاح', 'Paiement enregistré'), 'success');
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('بحث بالمرجع، الفاتورة، اسم العميل...', 'Recherche par référence, client, N°...')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('كل الطرق', 'Toutes méthodes')}</option>
            <option value="cod">{tr('الدفع عند الاستلام (COD)', 'COD')}</option>
            <option value="baridimob">{tr('بريدي موب (BaridiMob)', 'BaridiMob')}</option>
            <option value="bank_transfer">{tr('تحويل بنكي / CCP', 'Virement / CCP')}</option>
            <option value="cib_edahabia">{tr('CIB / الذهبية', 'CIB / Edahabia')}</option>
            <option value="cash">{tr('نقداً (Espèces)', 'Espèces')}</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('كل القطاعات', 'Tous secteurs')}</option>
            <option value="retail">{tr('تجزئة (B2C)', 'Retail')}</option>
            <option value="wholesale">{tr('جملة (B2B)', 'Wholesale')}</option>
          </select>
        </div>

        <button
          onClick={openRecordModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-950/50"
        >
          <Plus className="w-4 h-4" />
          <span>{tr('تسجيل دفعة جديدة', 'Enregistrer un paiement')}</span>
        </button>
      </div>

      {/* Payment Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3 text-start">{tr('رقم العملية', 'N° Paiement')}</th>
                <th className="py-3 px-3 text-start">{tr('الفاتورة المرتبطة', 'Réf. Facture')}</th>
                <th className="py-3 px-3 text-start">{tr('العميل', 'Client')}</th>
                <th className="py-3 px-3 text-start">{tr('طريقة الدفع', 'Méthode')}</th>
                <th className="py-3 px-3 text-start">{tr('رقم المرجع / المعاملة', 'Réf. Transaction')}</th>
                <th className="py-3 px-3 text-start">{tr('التاريخ', 'Date')}</th>
                <th className="py-3 px-3 text-end">{tr('المبلغ', 'Montant')}</th>
                <th className="py-3 px-3 text-center">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {tr('لا توجد عمليات دفع مسجلة', 'Aucun paiement enregistré')}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-950/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-100">{p.payment_number}</td>
                    <td className="py-3 px-3 font-mono text-emerald-400">{p.invoice_number || '-'}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {p.customer_name}
                      <span className={`block text-[10px] ${p.customer_type === 'wholesale' ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {p.customer_type === 'wholesale' ? 'جملة (B2B)' : 'تجزئة'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-bold border border-slate-800 uppercase">
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-400">{p.reference_number || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(p.payment_date)}</td>
                    <td className="py-3 px-3 text-end font-bold text-emerald-400">{formatPrice(p.amount)}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTargetId(p.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {tr('تسجيل عملية دفع جديدة', 'Enregistrer un paiement')}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{tr('ربط بمستحق الفاتورة (اختياري)', 'Lier à une facture')}</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleSelectInvoiceChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{tr('-- اختر فاتورة غير مدفوعة --', '-- Sélectionner facture --')}</option>
                  {invoices
                    .filter((i) => i.balance_due > 0)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_number} - {i.customer_name} ({formatPrice(i.balance_due)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('اسم العميل *', 'Client *')}</label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('المبلغ المستلم *', 'Montant *')}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold font-mono text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('طريقة الدفع', 'Méthode')}</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as FinancePaymentMethod)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="baridimob">بريدي موب (BaridiMob)</option>
                    <option value="bank_transfer">تحويل بنكي / CCP</option>
                    <option value="cib_edahabia">بطاقة CIB / الذهبية</option>
                    <option value="cod">الدفع عند الاستلام (COD)</option>
                    <option value="cash">نقداً (Espèces)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('رقم المرجع / المعاملة', 'Réf. Transaction')}</label>
                  <input
                    type="text"
                    value={formRefNumber}
                    onChange={(e) => setFormRefNumber(e.target.value)}
                    placeholder="e.g. RIP / CCP 00129384"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  {tr('تأكيد الدفعة', 'Valider le paiement')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          if (!deleteTargetId) return;
          setIsDeleting(true);
          setDeleteError(null);
          try {
            await onDeletePayment(deleteTargetId);
            showToast(tr('تم حذف سجل الدفع', 'Paiement supprimé'), 'success');
            setDeleteTargetId(null);
          } catch (e: unknown) {
            console.error(e);
            const msg = (e as Error)?.message || tr('حدث خطأ أثناء الحذف', 'Erreur de suppression');
            setDeleteError(msg);
            showToast(msg, 'error');
          } finally {
            setIsDeleting(false);
          }
        }}
        isDeleting={isDeleting}
        title={tr('تأكيد حذف الدفعة', 'Confirmer la suppression du paiement')}
        description={tr('هل أنت متأكد من حذف هذا السجل الدفع؟', 'Voulez-vous vraiment supprimer ce paiement ?')}
        error={deleteError}
      />
    </div>
  );
}
