import { useState, useMemo } from 'react';
import {
  Search, Plus, Trash2, CheckSquare, Square,
  Download, Upload, ChevronLeft, ChevronRight, Eye, Edit2,
  UserCheck, MessageSquare, RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SupportTicket, TicketStatus, SupportAgent } from '../../types/support';

interface Props {
  tickets: SupportTicket[];
  agents: SupportAgent[];
  selectedTicketId: string | null;
  onSelectTicket: (ticket: SupportTicket) => void;
  onCreateTicket: () => void;
  onEditTicket: (ticket: SupportTicket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkChangeStatus: (ids: string[], status: TicketStatus) => void;
  onBulkAssign: (ids: string[], agentName: string) => void;
  onBulkExport: (ids: string[]) => void;
  onExportAllCSV: () => void;
  onOpenImportModal: () => void;
  // External filter initial values if passed from dashboard
  initialStatus?: string;
  initialPriority?: string;
  initialCustomerType?: string;
}

export default function SupportTicketList({
  tickets,
  agents,
  selectedTicketId,
  onSelectTicket,
  onCreateTicket,
  onEditTicket,
  onDeleteTicket,
  onBulkDelete,
  onBulkChangeStatus,
  onBulkAssign,
  onBulkExport,
  onExportAllCSV,
  onOpenImportModal,
  initialStatus = 'all',
  initialPriority = 'all',
  initialCustomerType = 'all',
}: Props) {
  const { lang, formatDate } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>(initialPriority);
  const [typeFilter, setTypeFilter] = useState<string>(initialCustomerType);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNumber = ticket.ticket_number.toLowerCase().includes(q);
        const matchName = ticket.customer_name.toLowerCase().includes(q);
        const matchPhone = ticket.customer_phone.includes(q);
        const matchEmail = (ticket.customer_email || '').toLowerCase().includes(q);
        const matchSubject = ticket.subject.toLowerCase().includes(q);
        const matchCompany = (ticket.company_name || '').toLowerCase().includes(q);
        const matchOrder = (ticket.order_id || '').toLowerCase().includes(q);
        if (!matchNumber && !matchName && !matchPhone && !matchEmail && !matchSubject && !matchCompany && !matchOrder) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;

      // Priority
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;

      // Customer Type
      if (typeFilter !== 'all' && ticket.customer_type !== typeFilter) return false;

      // Category
      if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;

      // Agent
      if (agentFilter !== 'all') {
        if (agentFilter === 'unassigned' && ticket.assigned_to_name) return false;
        if (agentFilter !== 'unassigned' && ticket.assigned_to_name !== agentFilter) return false;
      }

      // Read status
      if (readFilter === 'unread' && !ticket.unread_by_admin) return false;
      if (readFilter === 'read' && ticket.unread_by_admin) return false;

      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter, typeFilter, categoryFilter, agentFilter, readFilter]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  // Bulk Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedTickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedTickets.map(t => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            {tr('قائمة التذاكر وطلبات الدعم', 'Liste des Tickets de Support')}
          </h3>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold rounded-full border border-emerald-500/20">
            {filteredTickets.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>{tr('استيراد CSV', 'Importer CSV')}</span>
          </button>

          <button
            onClick={onExportAllCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{tr('تصدير الكل CSV', 'Exporter Tout')}</span>
          </button>

          <button
            onClick={onCreateTicket}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{tr('إنشاء تذكرة', 'Nouveau Ticket')}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={tr('بحث برقم التذكرة، العميل، الهاتف، الموضوع...', 'Recherche par #, client, tél, sujet...')}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 placeholder-slate-500 text-xs rounded-xl ps-9 pe-3 py-2.5 transition outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 transition outline-none"
            >
              <option value="all">{tr('جميع الحالات', 'Tous les Statuts')}</option>
              <option value="open">{tr('مفتوحة', 'Ouvert')}</option>
              <option value="pending">{tr('قيد الانتظار', 'En attente')}</option>
              <option value="waiting_customer">{tr('في انتظار العميل', 'Attente Client')}</option>
              <option value="in_progress">{tr('قيد المعالجة', 'En cours')}</option>
              <option value="resolved">{tr('تم الحل', 'Résolu')}</option>
              <option value="closed">{tr('مغلقة', 'Fermé')}</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 transition outline-none"
            >
              <option value="all">{tr('جميع الأولويات', 'Toutes Priorités')}</option>
              <option value="urgent">{tr('عاجلة جداً (Urgent)', 'Urgent')}</option>
              <option value="high">{tr('مرتفعة (High)', 'Élevée')}</option>
              <option value="medium">{tr('متوسطة (Medium)', 'Moyenne')}</option>
              <option value="low">{tr('منخفضة (Low)', 'Basse')}</option>
            </select>
          </div>

          {/* Customer Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 transition outline-none"
            >
              <option value="all">{tr('جميع نوعيات العملاء', 'Tous les types')}</option>
              <option value="retail">{tr('تجزئة (Retail)', 'Détail')}</option>
              <option value="wholesale">{tr('جملة (Wholesale B2B)', 'Gros B2B')}</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 transition outline-none"
            >
              <option value="all">{tr('جميع الفئات', 'Toutes Catégories')}</option>
              <option value="orders">{tr('الطلبات', 'Commandes')}</option>
              <option value="shipping">{tr('الشحن', 'Livraison')}</option>
              <option value="payments">{tr('الدفع والفواتير', 'Paiement')}</option>
              <option value="wholesale_b2b">{tr('جملة B2B', 'Gros B2B')}</option>
              <option value="returns">{tr('الإرجاع', 'Retour')}</option>
              <option value="product_inquiry">{tr('استفسار منتج', 'Produits')}</option>
              <option value="general">{tr('عام', 'Général')}</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row (Agent & Read Filter) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>{tr('الوكيل المخصص:', 'Agent:')}</span>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs outline-none"
              >
                <option value="all">{tr('الكل', 'Tous')}</option>
                <option value="unassigned">{tr('غير مخصص', 'Non assigné')}</option>
                {agents.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span>{tr('الحالة الحركية:', 'Lecture:')}</span>
              <select
                value={readFilter}
                onChange={(e) => setReadFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs outline-none"
              >
                <option value="all">{tr('جميع التذاكر', 'Tous')}</option>
                <option value="unread">{tr('غير مقروءة فقط', 'Non lus uniquement')}</option>
                <option value="read">{tr('مقروءة', 'Lus')}</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setTypeFilter('all');
              setCategoryFilter('all');
              setAgentFilter('all');
              setReadFilter('all');
              setCurrentPage(1);
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{tr('إعادة ضبط الفلاتر', 'Réinitialiser')}</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Controls Toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-950/40 border border-emerald-500/40 p-3.5 rounded-2xl shadow-lg">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>
              {tr('تم تحديد', 'Sélectionné')} {selectedIds.length} {tr('من التذاكر', 'tickets')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Change Status */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBulkChangeStatus(selectedIds, e.target.value as TicketStatus);
                  e.target.value = '';
                }
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
            >
              <option value="">{tr('تغيير الحالة لـ...', 'Changer le statuts...')}</option>
              <option value="open">{tr('مفتوحة', 'Ouvert')}</option>
              <option value="in_progress">{tr('قيد المعالجة', 'En cours')}</option>
              <option value="resolved">{tr('تم الحل', 'Résolu')}</option>
              <option value="closed">{tr('مغلقة', 'Fermé')}</option>
            </select>

            {/* Quick Assign Agent */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBulkAssign(selectedIds, e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
            >
              <option value="">{tr('تخصيص لوكيل...', 'Assigner à...')}</option>
              {agents.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>

            <button
              onClick={() => onBulkExport(selectedIds)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{tr('تصدير المحدد', 'Exporter')}</span>
            </button>

            <button
              onClick={() => {
                onBulkDelete(selectedIds);
                setSelectedIds([]);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{tr('حذف المحدد', 'Supprimer')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table / Data View */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 text-center w-10">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-200">
                    {selectedIds.length === paginatedTickets.length && paginatedTickets.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-start">{tr('التذكرة', 'Ticket')}</th>
                <th className="p-3 text-start">{tr('العميل', 'Client')}</th>
                <th className="p-3 text-start">{tr('الموضوع والعنوان', 'Sujet')}</th>
                <th className="p-3 text-center">{tr('الأولوية', 'Priorité')}</th>
                <th className="p-3 text-center">{tr('الحالة', 'Statut')}</th>
                <th className="p-3 text-start">{tr('الوكيل المخصص', 'Agent')}</th>
                <th className="p-3 text-end">{tr('التاريخ', 'Date')}</th>
                <th className="p-3 text-center">{tr('إجراءات', 'Actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-200 font-medium">
              {paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="text-sm font-semibold">{tr('لا توجد تذاكر تطابق شروط البحث', 'Aucun ticket trouvé')}</p>
                    <p className="text-xs text-slate-600 mt-1">{tr('جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر', 'Essayez de modifier votre recherche')}</p>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((ticket) => {
                  const isSelected = selectedIds.includes(ticket.id);
                  const isCurrentActive = selectedTicketId === ticket.id;

                  return (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-slate-800/50 transition ${
                        isCurrentActive ? 'bg-slate-800/80 border-s-4 border-s-emerald-500' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button onClick={() => toggleSelectOne(ticket.id)} className="text-slate-400 hover:text-slate-200">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Ticket Number & Category */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {ticket.unread_by_admin && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Unread" />
                          )}
                          <div>
                            <span className="font-mono font-bold text-emerald-400 text-xs block">{ticket.ticket_number}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {ticket.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="p-3">
                        <div>
                          <p className="font-bold text-slate-100 text-xs flex items-center gap-1">
                            <span>{ticket.customer_name}</span>
                            {ticket.customer_type === 'wholesale' && (
                              <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-400 text-[10px] font-extrabold rounded border border-amber-500/20">
                                B2B
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono" dir="ltr">{ticket.customer_phone}</p>
                          {ticket.company_name && (
                            <p className="text-[10px] text-slate-500 truncate max-w-[140px]">{ticket.company_name}</p>
                          )}
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="p-3 max-w-xs">
                        <p className="font-semibold text-slate-200 text-xs truncate">{ticket.subject}</p>
                        {ticket.order_id && (
                          <span className="text-[10px] font-mono text-blue-400">Order: {ticket.order_id}</span>
                        )}
                      </td>

                      {/* Priority Badge */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                          ticket.priority === 'urgent' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          ticket.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          ticket.priority === 'medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {ticket.priority.toUpperCase()}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                          ticket.status === 'open' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          ticket.status === 'in_progress' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          ticket.status === 'waiting_customer' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          ticket.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          'bg-slate-950 text-slate-400 border-slate-800'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>

                      {/* Assigned Agent */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          <span>{ticket.assigned_to_name || tr('غير مخصص', 'Non assigné')}</span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="p-3 text-end font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDate(ticket.created_at)}
                      </td>

                      {/* Quick Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectTicket(ticket)}
                            title={tr('عرض التفاصيل والمحادثة', 'Voir conversations')}
                            className="p-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onEditTicket(ticket)}
                            title={tr('تعديل التذكرة', 'Éditer')}
                            className="p-1.5 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTicket(ticket.id)}
                            title={tr('حذف', 'Supprimer')}
                            className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination Footer Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>{tr('عرض الصفحات:', 'Affichage:')}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              {tr('إجمالي التذاكر المفلترة:', 'Total:')} <strong className="text-slate-200">{filteredTickets.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-slate-900 border border-slate-800 disabled:opacity-40 rounded-lg text-slate-200 hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-slate-200">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-slate-900 border border-slate-800 disabled:opacity-40 rounded-lg text-slate-200 hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
