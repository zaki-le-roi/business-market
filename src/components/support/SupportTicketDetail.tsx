import { useState } from 'react';
import {
  Send, Paperclip, Lock, Printer, Phone, Mail, Building2,
  ShoppingBag, Trash2, Edit2, ArrowLeft, X, Check, MessageSquare
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  SupportTicket, TicketStatus, TicketPriority,
  SupportAgent, SupportCannedResponse, TicketAttachment
} from '../../types/support';

interface Props {
  ticket: SupportTicket;
  agents: SupportAgent[];
  cannedResponses: SupportCannedResponse[];
  onCloseDetail: () => void;
  onSendReply: (ticketId: string, text: string, isInternal: boolean, attachments: TicketAttachment[]) => void;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => void;
  onUpdatePriority: (ticketId: string, priority: TicketPriority) => void;
  onAssignAgent: (ticketId: string, agentName: string) => void;
  onSaveInternalNote: (ticketId: string, note: string) => void;
  onDeleteTicket: (ticketId: string) => void;
}

export default function SupportTicketDetail({
  ticket,
  agents,
  cannedResponses,
  onCloseDetail,
  onSendReply,
  onUpdateStatus,
  onUpdatePriority,
  onAssignAgent,
  onSaveInternalNote,
  onDeleteTicket,
}: Props) {
  const { lang, formatDate } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Reply Form State
  const [replyText, setReplyText] = useState('');
  const [isInternalMode, setIsInternalMode] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<TicketAttachment[]>([]);

  // Internal Notes Sidebar State
  const [editingNotes, setEditingNotes] = useState(false);
  const [internalNotesText, setInternalNotesText] = useState(ticket.internal_notes || '');

  // File Upload Simulator
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: TicketAttachment[] = Array.from(files).map((f, index) => ({
      id: `att-${Date.now()}-${index}`,
      name: f.name,
      url: URL.createObjectURL(f),
      size: Math.round(f.size / 1024), // KB
      type: f.type || 'file',
    }));

    setPendingAttachments([...pendingAttachments, ...newAttachments]);
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments(pendingAttachments.filter(a => a.id !== id));
  };

  const handleSend = () => {
    if (!replyText.trim() && pendingAttachments.length === 0) return;
    onSendReply(ticket.id, replyText, isInternalMode, pendingAttachments);
    setReplyText('');
    setPendingAttachments([]);
  };

  const handleApplyCannedResponse = (responseId: string) => {
    const resp = cannedResponses.find(r => r.id === responseId);
    if (!resp) return;
    const text = isAr ? resp.content_ar : resp.content_fr;
    setReplyText(prev => (prev ? `${prev}\n${text}` : text));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-sm">
      {/* Detail Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3">
          <button
            onClick={onCloseDetail}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title={tr('رجوع للقائمة', 'Retour')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-extrabold text-emerald-400 text-sm">{ticket.ticket_number}</span>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                ticket.customer_type === 'wholesale' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
              }`}>
                {ticket.customer_type === 'wholesale' ? 'B2B Wholesale' : 'Retail'}
              </span>
              <span className="text-xs text-slate-400 font-medium">Category: {ticket.category}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{ticket.subject}</h2>
          </div>
        </div>

        {/* Action Selectors (Status, Priority, Agent) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <select
            value={ticket.status}
            onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition"
          >
            <option value="open">{tr('مفتوحة (Open)', 'Ouvert')}</option>
            <option value="in_progress">{tr('قيد المعالجة (In Progress)', 'En cours')}</option>
            <option value="waiting_customer">{tr('في انتظار العميل (Waiting)', 'Attente Client')}</option>
            <option value="pending">{tr('معلقة (Pending)', 'En attente')}</option>
            <option value="resolved">{tr('تم الحل (Resolved)', 'Résolu')}</option>
            <option value="closed">{tr('مغلقة (Closed)', 'Fermé')}</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={ticket.priority}
            onChange={(e) => onUpdatePriority(ticket.id, e.target.value as TicketPriority)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition"
          >
            <option value="urgent">{tr('عاجلة (Urgent)', 'Urgent')}</option>
            <option value="high">{tr('مرتفعة (High)', 'Élevée')}</option>
            <option value="medium">{tr('متوسطة (Medium)', 'Moyenne')}</option>
            <option value="low">{tr('منخفضة (Low)', 'Basse')}</option>
          </select>

          {/* Assigned Agent */}
          <select
            value={ticket.assigned_to_name || ''}
            onChange={(e) => onAssignAgent(ticket.id, e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition"
          >
            <option value="">{tr('تعيين وكيل...', 'Assigner agent...')}</option>
            {agents.map(a => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            title={tr('طباعة التذكرة', 'Imprimer')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDeleteTicket(ticket.id)}
            title={tr('حذف التذكرة', 'Supprimer')}
            className="p-2 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid: Main Conversation Thread + Sidebar Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Main Column: Message Thread & Reply Box */}
        <div className="lg:col-span-2 space-y-4">
          {/* Thread Header */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              {tr('تاريخ وسجل المحادثات', 'Historique des messages')} ({ticket.messages?.length || 0})
            </span>
            <span className="font-mono text-[11px]">
              {tr('أنشئت:', 'Créé:')} {formatDate(ticket.created_at)}
            </span>
          </div>

          {/* Messages Stream */}
          <div className="space-y-4 max-h-[480px] overflow-y-auto p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
            {ticket.messages?.map((msg, index) => {
              const isAdmin = msg.sender === 'admin';
              const isInternal = msg.is_internal;

              if (isInternal) {
                return (
                  <div key={msg.id || index} className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        {tr('ملاحظة داخلية خاصة بالفريق', 'Note Interne Staff')} ({msg.sender_name || 'Admin'})
                      </span>
                      <span className="font-mono text-[10px] text-amber-500">{formatDate(msg.created_at)}</span>
                    </div>
                    <p className="text-xs text-amber-200 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 font-semibold">
                    <span>{isAdmin ? (msg.sender_name || tr('فريق الدعم (Admin)', 'Support Admin')) : ticket.customer_name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{formatDate(msg.created_at)}</span>
                  </div>

                  <div className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed space-y-2 ${
                    isAdmin
                      ? 'bg-emerald-600 text-white shadow-md rounded-te-none'
                      : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-ts-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.message}</p>

                    {/* Attachments if any */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="pt-2 border-t border-white/20 space-y-1">
                        <span className="text-[10px] font-bold block opacity-80">{tr('المرفقات:', 'Pièces jointes:')}</span>
                        <div className="flex flex-wrap gap-2">
                          {msg.attachments.map(att => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-black/20 hover:bg-black/30 rounded-lg text-[11px] text-white font-mono transition"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              <span className="opacity-60 text-[9px]">({att.size}KB)</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Form */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
            {/* Mode Selector & Quick Replies */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInternalMode(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    !isInternalMode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{tr('رد علني للعميل', 'Réponse Publique')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInternalMode(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    isInternalMode ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{tr('ملاحظة داخلية للفريق', 'Note Interne')}</span>
                </button>
              </div>

              {/* Quick Canned Responses */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleApplyCannedResponse(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 outline-none"
              >
                <option value="">{tr('الردود الجاهزة (Canned Replies)...', 'Réponses Rapides...')}</option>
                {cannedResponses.map(cr => (
                  <option key={cr.id} value={cr.id}>{cr.title}</option>
                ))}
              </select>
            </div>

            {/* Textarea */}
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isInternalMode
                  ? tr('اكتب ملاحظة داخلية تظهر فقط لأعضاء فريق الدعم...', 'Écrivez une note interne pour le staff...')
                  : tr('اكتب الرد الرسمي للعميل هنا...', 'Tapez la réponse officielle au client...')
              }
              className={`w-full bg-slate-900 border text-slate-100 text-xs rounded-xl p-3 outline-none focus:ring-1 transition ${
                isInternalMode ? 'border-amber-500/40 focus:ring-amber-500' : 'border-slate-800 focus:ring-emerald-500'
              }`}
            />

            {/* Pending Attachments List */}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {pendingAttachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                    <Paperclip className="w-3 h-3 text-emerald-400" />
                    <span className="truncate max-w-[130px]">{att.name}</span>
                    <button onClick={() => removePendingAttachment(att.id)} className="text-slate-500 hover:text-rose-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Form Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                <span>{tr('إرفاق ملف / صورة', 'Joindre un fichier')}</span>
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                onClick={handleSend}
                disabled={!replyText.trim() && pendingAttachments.length === 0}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-md disabled:opacity-40 ${
                  isInternalMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isInternalMode ? tr('حفظ الملاحظة', 'Enregistrer Note') : tr('إرسال الرد', 'Envoyer Réponse')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Info & Internal Notes Box */}
        <div className="space-y-4">
          {/* Customer Profile Card */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>{tr('معلومات العميل', 'Profil Client')}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                ticket.customer_type === 'wholesale' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}>
                {ticket.customer_type === 'wholesale' ? 'B2B Wholesale' : 'Retail'}
              </span>
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <p className="text-slate-400 text-[11px]">{tr('اسم العميل:', 'Nom:')}</p>
                <p className="font-bold text-slate-100">{ticket.customer_name}</p>
              </div>

              <div>
                <p className="text-slate-400 text-[11px]">{tr('رقم الهاتف:', 'Téléphone:')}</p>
                <p className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>{ticket.customer_phone}</span>
                </p>
              </div>

              {ticket.customer_email && (
                <div>
                  <p className="text-slate-400 text-[11px]">{tr('البريد الإلكتروني:', 'Email:')}</p>
                  <p className="font-mono text-slate-300 flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span>{ticket.customer_email}</span>
                  </p>
                </div>
              )}

              {ticket.company_name && (
                <div>
                  <p className="text-slate-400 text-[11px]">{tr('اسم الشركة (B2B):', 'Société B2B:')}</p>
                  <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-amber-400" />
                    <span>{ticket.company_name}</span>
                  </p>
                </div>
              )}

              {ticket.order_id && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-slate-400 text-[11px]">{tr('الطلب المرتبط:', 'Commande liée:')}</p>
                  <p className="font-mono text-blue-400 font-bold flex items-center gap-1.5">
                    <ShoppingBag className="w-3 h-3 text-blue-400" />
                    <span>#{ticket.order_id}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Persistent Admin Internal Notes Card */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{tr('ملاحظات الموظفين الخاصة', 'Notes Internes Staff')}</span>
              </h3>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{tr('تعديل', 'Éditer')}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onSaveInternalNote(ticket.id, internalNotesText);
                    setEditingNotes(false);
                  }}
                  className="text-emerald-400 hover:underline text-xs font-bold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{tr('حفظ', 'Sauvegarder')}</span>
                </button>
              )}
            </div>

            {editingNotes ? (
              <textarea
                rows={4}
                value={internalNotesText}
                onChange={(e) => setInternalNotesText(e.target.value)}
                placeholder={tr('اكتب ملاحظات الإدارة الخاصة بهذه التذكرة والعميل...', 'Notes pour les admins...')}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-amber-200 outline-none focus:border-amber-500"
              />
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {ticket.internal_notes || tr('لا توجد ملاحظات خاصة مدونة حالياً', 'Aucune note enregistrée')}
              </p>
            )}
          </div>

          {/* Ticket Activity Mini Timeline */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-800">
              {tr('تتبع النشاطات الأخيرة', 'Séquence des Activités')}
            </h3>

            <div className="space-y-2.5 max-h-48 overflow-y-auto text-xs">
              {ticket.activity_log && ticket.activity_log.length > 0 ? (
                ticket.activity_log.map(log => (
                  <div key={log.id} className="border-s-2 border-slate-700 ps-2.5 py-0.5 space-y-0.5">
                    <p className="text-slate-200 font-bold text-[11px]">{log.action}</p>
                    <p className="text-slate-400 text-[10px]">{log.details}</p>
                    <p className="text-slate-500 text-[9px] font-mono">{formatDate(log.timestamp)} ({log.performed_by})</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-[11px] italic">{tr('تم إنشاء التذكرة وبدء المتابعة', 'Ticket créé')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
