import { useState, useEffect } from 'react';
import {
  X, Plus, Edit2, Paperclip, User, Building2, Check, AlertCircle
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  SupportTicket, TicketStatus, TicketPriority, CustomerSupportType,
  TicketCategory, SupportAgent, TicketAttachment
} from '../../types/support';

interface Props {
  isOpen: boolean;
  ticketToEdit: SupportTicket | null;
  agents: SupportAgent[];
  onClose: () => void;
  onSave: (data: Partial<SupportTicket>, initialMessage?: string, initialAttachments?: TicketAttachment[]) => void;
}

export default function SupportTicketModal({
  isOpen,
  ticketToEdit,
  agents,
  onClose,
  onSave,
}: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const isEdit = !!ticketToEdit;

  // Form State
  const [customerType, setCustomerType] = useState<CustomerSupportType>('retail');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [orderId, setOrderId] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [status, setStatus] = useState<TicketStatus>('open');
  const [assignedAgent, setAssignedAgent] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ticketToEdit) {
      setCustomerType(ticketToEdit.customer_type || 'retail');
      setCustomerName(ticketToEdit.customer_name || '');
      setCustomerPhone(ticketToEdit.customer_phone || '');
      setCustomerEmail(ticketToEdit.customer_email || '');
      setCompanyName(ticketToEdit.company_name || '');
      setOrderId(ticketToEdit.order_id || '');
      setSubject(ticketToEdit.subject || '');
      setCategory(ticketToEdit.category || 'general');
      setPriority(ticketToEdit.priority || 'medium');
      setStatus(ticketToEdit.status || 'open');
      setAssignedAgent(ticketToEdit.assigned_to_name || '');
      setInternalNotes(ticketToEdit.internal_notes || '');
      setInitialMessage('');
      setAttachments([]);
    } else {
      setCustomerType('retail');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCompanyName('');
      setOrderId('');
      setSubject('');
      setCategory('general');
      setPriority('medium');
      setStatus('open');
      setAssignedAgent('');
      setInitialMessage('');
      setInternalNotes('');
      setAttachments([]);
    }
    setError('');
  }, [ticketToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAtts: TicketAttachment[] = Array.from(files).map((f, i) => ({
      id: `modal-att-${Date.now()}-${i}`,
      name: f.name,
      url: URL.createObjectURL(f),
      size: Math.round(f.size / 1024),
      type: f.type || 'file',
    }));

    setAttachments([...attachments, ...newAtts]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !subject.trim()) {
      setError(tr('يرجى ملء جميع الحقول الإلزامية (اسم العميل، رقم الهاتف، موضوع التذكرة)', 'Veuillez remplir les champs obligatoires (nom, téléphone, sujet)'));
      return;
    }

    if (customerType === 'wholesale' && !companyName.trim()) {
      setError(tr('يرجى كتابة اسم الشركة لعملاء الجملة B2B', 'Nom de la société B2B obligatoire'));
      return;
    }

    if (!isEdit && !initialMessage.trim()) {
      setError(tr('يرجى كتابة نص الرسالة أو وصف المشكلة للتذكرة الجديدة', 'Veuillez décrire le problème dans le message initial'));
      return;
    }

    onSave(
      {
        customer_type: customerType,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        company_name: companyName || null,
        order_id: orderId || null,
        subject,
        category,
        priority,
        status,
        assigned_to_name: assignedAgent || null,
        internal_notes: internalNotes || null,
      },
      initialMessage,
      attachments
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {isEdit ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                {isEdit ? tr('تعديل تذكرة الدعم', 'Éditer le Ticket') : tr('إنشاء تذكرة دعم جديدة', 'Nouveau Ticket de Support')}
              </h3>
              <p className="text-xs text-slate-400">
                {isEdit ? tr('تعديل البيانات الأساسية والتعيينات', 'Modifier les données du ticket') : tr('إدخال بيانات التذكرة ورسالة العميل الأساسية', 'Créer un nouveau ticket de support')}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Type Selector (Retail vs Wholesale B2B) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">{tr('نوع العميل:', 'Type de client:')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('retail')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition ${
                  customerType === 'retail'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{tr('عميل تجزئة (Retail)', 'Client Détail')}</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomerType('wholesale')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition ${
                  customerType === 'wholesale'
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{tr('عميل جملة B2B (Wholesale)', 'Client Gros B2B')}</span>
              </button>
            </div>
          </div>

          {/* Customer Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">{tr('اسم العميل *', 'Nom du client *')}</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={tr('أدخل اسم العميل الكامل...', 'Nom complet')}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">{tr('رقم الهاتف *', 'Téléphone *')}</label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0550123456"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">{tr('البريد الإلكتروني', 'Email')}</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="client@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              />
            </div>

            {customerType === 'wholesale' ? (
              <div>
                <label className="text-xs font-bold text-amber-300 block mb-1">{tr('اسم الشركة B2B *', 'Nom de la société B2B *')}</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={tr('شركة التوزيع المحدودة...', 'Nom EURL / SARL')}
                  className="w-full bg-slate-950 border border-amber-500/40 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">{tr('رقم الطلب المرتبط (إن وجد)', 'N° Commande (optionnel)')}</label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="ORD-9821"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Ticket Meta Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">{tr('الفئة', 'Catégorie')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              >
                <option value="general">{tr('عام', 'Général')}</option>
                <option value="orders">{tr('الطلبات', 'Commandes')}</option>
                <option value="shipping">{tr('الشحن والتوصيل', 'Livraison')}</option>
                <option value="payments">{tr('الدفع والفواتير', 'Paiements')}</option>
                <option value="wholesale_b2b">{tr('طلبات الجملة B2B', 'Gros B2B')}</option>
                <option value="returns">{tr('الإرجاع والضمان', 'Retours')}</option>
                <option value="product_inquiry">{tr('استفسار عن منتج', 'Produits')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">{tr('الأولوية', 'Priorité')}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              >
                <option value="low">{tr('منخفضة (Low)', 'Basse')}</option>
                <option value="medium">{tr('متوسطة (Medium)', 'Moyenne')}</option>
                <option value="high">{tr('مرتفعة (High)', 'Élevée')}</option>
                <option value="urgent">{tr('عاجلة جداً (Urgent)', 'Urgent')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">{tr('تعيين لوكيل الدعم', 'Assigner à')}</label>
              <select
                value={assignedAgent}
                onChange={(e) => setAssignedAgent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
              >
                <option value="">{tr('غير مخصص', 'Non assigné')}</option>
                {agents.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">{tr('موضوع التذكرة *', 'Sujet du ticket *')}</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={tr('عنوان المختصر للمشكلة أو الاستفسار...', 'Ex: Retard de livraison commande #123')}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Initial Message (For Create Only) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">{tr('تفاصيل المشكلة / رسالة العميل الأولى *', 'Message initial / Description *')}</label>
              <textarea
                rows={3}
                required
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder={tr('اكتب تفاصيل الطلب أو شكوى العميل بالكامل...', 'Décrivez le problème en détail...')}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3 outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Internal Notes */}
          <div>
            <label className="text-xs font-bold text-amber-300 block mb-1">{tr('ملاحظات داخلية خاصة بالطاقم (اختياري)', 'Notes internes staff (Optionnel)')}</label>
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder={tr('ملاحظات لا يراها العميل...', 'Notes visibles par le staff uniquement...')}
              className="w-full bg-slate-950 border border-slate-800 text-amber-200 text-xs rounded-xl p-2.5 outline-none focus:border-amber-500"
            />
          </div>

          {/* Attachments Section */}
          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">{tr('المرفقات والصور:', 'Pièces jointes:')}</label>
                <label className="text-xs text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{tr('إضافة ملفات', 'Ajouter fichiers')}</span>
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                      <span>{att.name}</span>
                      <button type="button" onClick={() => handleRemoveAttachment(att.id)} className="text-slate-500 hover:text-rose-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              {tr('إلغاء', 'Annuler')}
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? tr('حفظ التغييرات', 'Enregistrer') : tr('تأكيد وإنشاء التذكرة', 'Créer Ticket')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
