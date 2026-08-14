import { useState, useMemo } from 'react';
import {
  Search, Plus, FileSpreadsheet, Trash2, Upload, X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import { FinanceExpense, ExpenseCategory, ExpenseType, FinancePaymentMethod } from '../../types/finance';
import { exportToCSV, parseCSVFile } from '../../lib/csvHelper';

interface Props {
  expenses: FinanceExpense[];
  onAddExpense: (exp: Omit<FinanceExpense, 'id' | 'created_at'>) => void;
  onUpdateExpense: (exp: FinanceExpense) => void;
  onDeleteExpense: (id: string) => void;
  onImportExpensesCSV: (imported: Omit<FinanceExpense, 'id' | 'created_at'>[]) => void;
}

export default function FinanceExpenses({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onImportExpensesCSV,
}: Props) {
  const { lang, formatPrice, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinanceExpense | null>(null);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('marketing');
  const [formType, setFormType] = useState<ExpenseType>('operational');
  const [formVendor, setFormVendor] = useState('');
  const [formAmount, setFormAmount] = useState(0);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formMethod, setFormMethod] = useState<FinancePaymentMethod>('cash');
  const [formRef, setFormRef] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.vendor_name.toLowerCase().includes(q) ||
        e.expense_number.toLowerCase().includes(q);

      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      const matchType = typeFilter === 'all' || e.expense_type === typeFilter;

      return matchSearch && matchCat && matchType;
    });
  }, [expenses, searchQuery, categoryFilter, typeFilter]);

  // Totals
  const totalExpenseSum = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const supplierExpenseSum = useMemo(() => filteredExpenses.filter((e) => e.expense_type === 'supplier').reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const operationalExpenseSum = useMemo(() => filteredExpenses.filter((e) => e.expense_type === 'operational').reduce((s, e) => s + e.amount, 0), [filteredExpenses]);

  const openAddModal = () => {
    setEditingExpense(null);
    setFormTitle('');
    setFormCategory('marketing');
    setFormType('operational');
    setFormVendor('');
    setFormAmount(0);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormMethod('cash');
    setFormRef('');
    setFormNotes('');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || formAmount <= 0) {
      showToast(tr('يرجى كتابة عنوان المصروف وتحديد المبلغ', 'Veuillez saisir le titre et le montant'), 'error');
      return;
    }

    if (editingExpense) {
      onUpdateExpense({
        ...editingExpense,
        title: formTitle,
        category: formCategory,
        expense_type: formType,
        vendor_name: formVendor,
        amount: Number(formAmount),
        expense_date: formDate,
        payment_method: formMethod,
        reference_number: formRef,
        notes: formNotes,
      });
      showToast(tr('تم تعديل المصروف بنجاح', 'Dépense modifiée'), 'success');
    } else {
      const expNum = `EXP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      onAddExpense({
        expense_number: expNum,
        title: formTitle,
        category: formCategory,
        expense_type: formType,
        vendor_name: formVendor || 'المورد / جهة عامة',
        amount: Number(formAmount),
        expense_date: formDate,
        payment_method: formMethod,
        reference_number: formRef,
        notes: formNotes,
      });
      showToast(tr('تم تسجيل المصروف بنجاح', 'Dépense enregistrée'), 'success');
    }
    setModalOpen(false);
  };

  const handleCSVImport = async (file: File) => {
    try {
      const rows = await parseCSVFile(file);
      const parsed: Omit<FinanceExpense, 'id' | 'created_at'>[] = rows.map((r, idx) => ({
        expense_number: r['Expense Number'] || `EXP-IMP-${idx + 1}`,
        title: r['Title'] || 'مصروف مستورد',
        category: (r['Category'] as ExpenseCategory) || 'operational',
        expense_type: r['Type'] === 'supplier' ? 'supplier' : 'operational',
        vendor_name: r['Vendor'] || 'مورد عام',
        amount: Number(r['Amount']) || 0,
        expense_date: r['Date'] || new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        notes: 'مستورد من CSV',
      }));
      onImportExpensesCSV(parsed);
      setImportModalOpen(false);
      showToast(tr(`تم استيراد ${parsed.length} مصروف بنجاح`, `${parsed.length} dépenses importées`), 'success');
    } catch {
      showToast(tr('فشل تحليل ملف CSV', 'Échec du fichier CSV'), 'error');
    }
  };

  const handleExportCSV = () => {
    const data = filteredExpenses.map((e) => ({
      'Expense Number': e.expense_number,
      'Title': e.title,
      'Category': e.category,
      'Type': e.expense_type,
      'Vendor': e.vendor_name,
      'Amount': e.amount,
      'Date': e.expense_date,
      'Payment Method': e.payment_method,
    }));
    exportToCSV(data, `Expenses_Export_${new Date().toISOString().split('T')[0]}`);
    showToast(tr('تم تصدير المصاريف إلى ملف CSV', 'Dépenses exportées'), 'success');
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">{tr('إجمالي المصاريف', 'Total Dépenses')}</span>
          <p className="text-xl font-black text-rose-400 mt-1">{formatPrice(totalExpenseSum)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">{tr('مصاريف الموردين والسلع (COGS)', 'Fournisseurs (COGS)')}</span>
          <p className="text-xl font-bold text-indigo-400 mt-1">{formatPrice(supplierExpenseSum)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">{tr('المصاريف التشغيلية (OpEx)', 'Opérationnel (OpEx)')}</span>
          <p className="text-xl font-bold text-amber-400 mt-1">{formatPrice(operationalExpenseSum)}</p>
        </div>
      </div>

      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('بحث بعنوان المصروف، اسم المورد...', 'Recherche par titre, fournisseur...')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('كل الفئات', 'Toutes catégories')}</option>
            <option value="shipping">{tr('الشحن والتوصيل', 'Livraison')}</option>
            <option value="marketing">{tr('التسويق والإعلانات', 'Marketing')}</option>
            <option value="inventory_purchase">{tr('شراء المخزون (Suppliers)', 'Inventaire')}</option>
            <option value="operational">{tr('مصاريف تشغيلية', 'Opérationnel')}</option>
            <option value="salaries">{tr('الرواتب والأجور', 'Salaires')}</option>
            <option value="utilities">{tr('الفواتير والكهرباء', 'Factures & Électricité')}</option>
            <option value="office_rent">{tr('إيجار المقر', 'Loyer')}</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('النوع (الكل)', 'Tous types')}</option>
            <option value="supplier">{tr('موردين (COGS)', 'Fournisseur')}</option>
            <option value="operational">{tr('تشغيلي (OpEx)', 'Opérationnel')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>{tr('استيراد CSV', 'Importer')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{tr('تصدير CSV', 'Exporter')}</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>{tr('إضافة مصروف', 'Nouvelle dépense')}</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3 text-start">{tr('الرقم', 'N°')}</th>
                <th className="py-3 px-3 text-start">{tr('عنوان المصروف', 'Titre')}</th>
                <th className="py-3 px-3 text-start">{tr('الفئة', 'Catégorie')}</th>
                <th className="py-3 px-3 text-start">{tr('النوع', 'Type')}</th>
                <th className="py-3 px-3 text-start">{tr('المورد / الجهة', 'Fournisseur')}</th>
                <th className="py-3 px-3 text-start">{tr('التاريخ', 'Date')}</th>
                <th className="py-3 px-3 text-end">{tr('المبلغ', 'Montant')}</th>
                <th className="py-3 px-3 text-center">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {tr('لا توجد مصاريف مسجلة', 'Aucune dépense enregistrée')}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-950/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-100">{e.expense_number}</td>
                    <td className="py-3 px-3 font-bold text-slate-200">{e.title}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded bg-slate-950 text-amber-300 font-semibold border border-slate-800">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${e.expense_type === 'supplier' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}>
                        {e.expense_type === 'supplier' ? tr('موردين (COGS)', 'Fournisseur') : tr('تشغيلي (OpEx)', 'Opérationnel')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{e.vendor_name}</td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(e.expense_date)}</td>
                    <td className="py-3 px-3 text-end font-bold text-rose-400">{formatPrice(e.amount)}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTargetId(e.id);
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

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{tr('تسجيل مصروف جديد', 'Nouvelle dépense')}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{tr('عنوان المصروف *', 'Titre *')}</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: إعلانات فايسبوك لشهر يوليو"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('فئة المصروف', 'Catégorie')}</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="marketing">التسويق والإعلانات</option>
                    <option value="shipping">الشحن والتوصيل</option>
                    <option value="inventory_purchase">شراء المخزون</option>
                    <option value="operational">تشغيلي عام</option>
                    <option value="salaries">الرواتب</option>
                    <option value="utilities">الكهرباء والإنترنت</option>
                    <option value="office_rent">إيجار المكتب</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('نوع المصروف', 'Type')}</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ExpenseType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="operational">تشغيلي (OpEx)</option>
                    <option value="supplier">موردين / تكلفة سلع (COGS)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('المورد / المستفيد', 'Fournisseur')}</label>
                  <input
                    type="text"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    placeholder="Meta Ads / Yalidine Express"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{tr('المبلغ (DZD) *', 'Montant *')}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-rose-400 font-bold"
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
                  {tr('حفظ المصروف', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{tr('استيراد مصاريف من CSV', 'Importer CSV')}</h3>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-2">
              <p>{tr('اختر ملف CSV يضم الأعمدة: Title, Category, Amount, Vendor, Date', 'Sélectionnez un fichier CSV contenant les colonnes requises.')}</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleCSVImport(e.target.files[0]);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300"
              />
            </div>
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
            await onDeleteExpense(deleteTargetId);
            showToast(tr('تم حذف المصروف بنجاح', 'Dépense supprimée'), 'success');
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
        title={tr('تأكيد حذف المصروف', 'Confirmer la suppression de la dépense')}
        description={tr('هل أنت متأكد من حذف هذا المصروف؟', 'Voulez-vous vraiment supprimer cette dépense ?')}
        error={deleteError}
      />
    </div>
  );
}
