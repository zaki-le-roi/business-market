import { useState, useEffect, useMemo } from 'react';
import {
  Headphones, MessageSquare, LayoutDashboard, History, Zap, Bell
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/csvHelper';

import {
  SupportTicket, TicketStatus, TicketPriority,
  SupportAgent, SupportCannedResponse, TicketActivityLog,
  SupportNotification, LiveChatSession, TicketAttachment
} from '../../types/support';

import SupportDashboard from '../../components/support/SupportDashboard';
import SupportTicketList from '../../components/support/SupportTicketList';
import SupportTicketDetail from '../../components/support/SupportTicketDetail';
import SupportTicketModal from '../../components/support/SupportTicketModal';
import SupportLiveChatView from '../../components/support/SupportLiveChatView';
import SupportActivityLogView from '../../components/support/SupportActivityLogView';
import SupportNotificationsModal from '../../components/support/SupportNotificationsModal';
import SupportCsvImportModal from '../../components/support/SupportCsvImportModal';

// Initial Seed Fallback Data for Enterprise Support Center
const INITIAL_AGENTS: SupportAgent[] = [];
const INITIAL_CANNED_RESPONSES: SupportCannedResponse[] = [];
const INITIAL_TICKETS: SupportTicket[] = [];
const INITIAL_NOTIFICATIONS: SupportNotification[] = [];

export default function AdminSupport() {
  const { lang, dir } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Main State
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [agents] = useState<SupportAgent[]>(INITIAL_AGENTS);
  const [cannedResponses] = useState<SupportCannedResponse[]>(INITIAL_CANNED_RESPONSES);
  const [notifications, setNotifications] = useState<SupportNotification[]>(INITIAL_NOTIFICATIONS);
  const [activityLogs, setActivityLogs] = useState<TicketActivityLog[]>([
    {
      id: 'log-1',
      ticket_id: 'TK-2026-102',
      action: 'إنشاء تذكرة B2B',
      details: 'تذكرة طلب أسعار جملة جديدة',
      performed_by: 'شركة الأفق',
      timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    }
  ]);

  // Tab View Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tickets' | 'livechat' | 'logs'>('dashboard');

  // Filter pass-through from dashboard to ticket list
  const [listStatusFilter, setListStatusFilter] = useState<string>('all');
  const [listPriorityFilter, setListPriorityFilter] = useState<string>('all');
  const [listTypeFilter, setListTypeFilter] = useState<string>('all');

  // Detail View State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<SupportTicket | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  // Load from Supabase with Fallback
  useEffect(() => {
    async function loadSupabaseTickets() {
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          // Normalize format if needed
          setTickets(data as SupportTicket[]);
        }
      } catch {
        // Fallback to local memory seed state
      }
    }
    loadSupabaseTickets();
  }, []);

  // Helper for adding activity log
  const logActivity = (ticketId: string, action: string, details: string, user: string = 'المسؤول') => {
    const newLog: TicketActivityLog = {
      id: `act-${Date.now()}`,
      ticket_id: ticketId,
      action,
      details,
      performed_by: user,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  // Helper for adding notifications
  const pushNotification = (type: SupportNotification['type'], ticketId: string, ticketNum: string, message: string) => {
    const newNotif: SupportNotification = {
      id: `notif-${Date.now()}`,
      type,
      ticket_id: ticketId,
      ticket_number: ticketNum,
      message,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Unread Count
  const unreadNotifCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  // Handle Ticket Selection (Detail View)
  const handleSelectTicket = (ticket: SupportTicket) => {
    // Mark as read by admin
    const updated = tickets.map(t => (t.id === ticket.id ? { ...t, unread_by_admin: false } : t));
    setTickets(updated);
    setSelectedTicket({ ...ticket, unread_by_admin: false });
  };

  // Create or Update Ticket Handler
  const handleSaveTicketModal = (
    data: Partial<SupportTicket>,
    initialMessage?: string,
    initialAttachments?: TicketAttachment[]
  ) => {
    if (ticketToEdit) {
      // EDIT EXISTING TICKET
      const updatedTickets = tickets.map(t => {
        if (t.id === ticketToEdit.id) {
          return {
            ...t,
            ...data,
            updated_at: new Date().toISOString(),
          };
        }
        return t;
      });

      setTickets(updatedTickets);
      if (selectedTicket?.id === ticketToEdit.id) {
        setSelectedTicket({ ...selectedTicket, ...data });
      }

      logActivity(ticketToEdit.ticket_number, 'تعديل التذكرة', 'تم تحديث البيانات الأساسية للتذكرة');
      showToast(tr('تم حفظ تعديلات التذكرة بنجاح', 'Ticket mis à jour'), 'success');
      setTicketToEdit(null);
    } else {
      // CREATE NEW TICKET
      const ticketNum = `TK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const newTicket: SupportTicket = {
        id: `tk-${Date.now()}`,
        ticket_number: ticketNum,
        customer_name: data.customer_name || 'عميل',
        customer_phone: data.customer_phone || '0550000000',
        customer_email: data.customer_email || null,
        customer_type: data.customer_type || 'retail',
        company_name: data.company_name || null,
        subject: data.subject || 'بدون عنوان',
        category: data.category || 'general',
        priority: data.priority || 'medium',
        status: data.status || 'open',
        order_id: data.order_id || null,
        assigned_to_name: data.assigned_to_name || null,
        unread_by_admin: false,
        unread_by_customer: true,
        internal_notes: data.internal_notes || null,
        messages: [
          {
            id: `msg-${Date.now()}`,
            sender: 'customer',
            sender_name: data.customer_name,
            message: initialMessage || data.subject || 'طلب دعم',
            attachments: initialAttachments || [],
            created_at: new Date().toISOString(),
          }
        ],
        activity_log: [
          {
            id: `act-init-${Date.now()}`,
            ticket_id: ticketNum,
            action: 'إنشاء التذكرة',
            details: 'تم إنشاء التذكرة يدويًا في النظام',
            performed_by: 'المسؤول',
            timestamp: new Date().toISOString(),
          }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setTickets([newTicket, ...tickets]);
      logActivity(ticketNum, 'إنشاء تذكرة جديدة', `تم إطلاق التذكرة ${ticketNum} للعميل ${newTicket.customer_name}`);
      pushNotification('new_ticket', newTicket.id, ticketNum, `تذكرة جديدة: ${newTicket.subject}`);
      showToast(tr(`تم إنشاء التذكرة بنجاح برقم ${ticketNum}`, `Ticket ${ticketNum} créé`), 'success');
    }
  };

  // Delete Single Ticket
  const handleDeleteTicket = (ticketId: string) => {
    const target = tickets.find(t => t.id === ticketId);
    setTickets(tickets.filter(t => t.id !== ticketId));
    if (selectedTicket?.id === ticketId) setSelectedTicket(null);

    if (target) {
      logActivity(target.ticket_number, 'حذف التذكرة', `تم حذف التذكرة ${target.ticket_number} نهائياً`);
    }
    showToast(tr('تم حذف التذكرة بنجاح', 'Ticket supprimé'), 'info');
  };

  // Bulk Operations
  const handleBulkDelete = (ids: string[]) => {
    setTickets(tickets.filter(t => !ids.includes(t.id)));
    if (selectedTicket && ids.includes(selectedTicket.id)) setSelectedTicket(null);
    showToast(tr(`تم حذف ${ids.length} تذكرة بنجاح`, `${ids.length} tickets supprimés`), 'info');
  };

  const handleBulkChangeStatus = (ids: string[], status: TicketStatus) => {
    setTickets(tickets.map(t => (ids.includes(t.id) ? { ...t, status, updated_at: new Date().toISOString() } : t)));
    showToast(tr('تم تحديث حالة التذاكر المحددة', 'Statut mis à jour'), 'success');
  };

  const handleBulkAssign = (ids: string[], agentName: string) => {
    setTickets(tickets.map(t => (ids.includes(t.id) ? { ...t, assigned_to_name: agentName, updated_at: new Date().toISOString() } : t)));
    showToast(tr(`تم تخصيص التذاكر المحددة للوكيل ${agentName}`, `Assigné à ${agentName}`), 'success');
  };

  const handleBulkExport = (ids: string[]) => {
    const selectedList = tickets.filter(t => ids.includes(t.id));
    exportTicketsToCSV(selectedList, 'selected_support_tickets');
  };

  const handleExportAllCSV = () => {
    exportTicketsToCSV(tickets, 'all_support_tickets');
  };

  const exportTicketsToCSV = (list: SupportTicket[], filename: string) => {
    const formattedData = list.map(t => ({
      ticket_number: t.ticket_number,
      customer_name: t.customer_name,
      customer_phone: t.customer_phone,
      customer_email: t.customer_email || '',
      customer_type: t.customer_type,
      company_name: t.company_name || '',
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assigned_to: t.assigned_to_name || 'Unassigned',
      internal_notes: t.internal_notes || '',
      created_at: t.created_at,
    }));

    exportToCSV(formattedData, filename);
    showToast(tr('تم تصدير التذاكر إلى ملف CSV بنجاح', 'Exportation CSV réussie'), 'success');
  };

  // Detail View Reply Handler
  const handleSendReply = (
    ticketId: string,
    text: string,
    isInternal: boolean,
    attachments: TicketAttachment[]
  ) => {
    const target = tickets.find(t => t.id === ticketId);
    if (!target) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'admin' as const,
      sender_name: 'إدارة الدعم الفني',
      message: text,
      is_internal: isInternal,
      attachments,
      created_at: new Date().toISOString(),
    };

    const updatedMessages = [...target.messages, newMsg];
    const newStatus = isInternal ? target.status : 'pending';

    const updatedTicket = {
      ...target,
      status: newStatus as TicketStatus,
      messages: updatedMessages,
      unread_by_customer: !isInternal,
      updated_at: new Date().toISOString(),
    };

    setTickets(tickets.map(t => (t.id === ticketId ? updatedTicket : t)));
    setSelectedTicket(updatedTicket);

    logActivity(
      target.ticket_number,
      isInternal ? 'إضافة ملاحظة داخلية' : 'إرسال رد على التذكرة',
      isInternal ? 'تمت إضافة ملاحظة خاصة بطاقم الإدارة' : 'تم إرسال رد رسمي للعميل'
    );

    showToast(
      isInternal
        ? tr('تم حفظ الملاحظة الداخلية بنجاح', 'Note interne sauvegardée')
        : tr('تم إرسال الرد الرسمي للعميل بنجاح', 'Réponse envoyée au client'),
      'success'
    );
  };

  // Update Status in Detail View
  const handleUpdateStatus = (ticketId: string, status: TicketStatus) => {
    setTickets(tickets.map(t => (t.id === ticketId ? { ...t, status, updated_at: new Date().toISOString() } : t)));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status });
    }
    const target = tickets.find(t => t.id === ticketId);
    if (target) {
      logActivity(target.ticket_number, 'تغيير حالة التذكرة', `تم تغيير الحالة إلى ${status}`);
    }
    showToast(tr(`تم تغيير الحالة إلى ${status}`, 'Statut mis à jour'), 'success');
  };

  // Update Priority in Detail View
  const handleUpdatePriority = (ticketId: string, priority: TicketPriority) => {
    setTickets(tickets.map(t => (t.id === ticketId ? { ...t, priority, updated_at: new Date().toISOString() } : t)));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, priority });
    }
    showToast(tr(`تم تعديل الأولوية إلى ${priority}`, 'Priorité mise à jour'), 'success');
  };

  // Assign Agent in Detail View
  const handleAssignAgent = (ticketId: string, agentName: string) => {
    setTickets(tickets.map(t => (t.id === ticketId ? { ...t, assigned_to_name: agentName, updated_at: new Date().toISOString() } : t)));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, assigned_to_name: agentName });
    }
    const target = tickets.find(t => t.id === ticketId);
    if (target) {
      logActivity(target.ticket_number, 'تخصيص وكيل', `تم تخصيص التذكرة للوكيل ${agentName}`);
      pushNotification('ticket_assigned', ticketId, target.ticket_number, `تم تخصيص التذكرة ${target.ticket_number} إلى ${agentName}`);
    }
    showToast(tr(`تم تخصيص التذكرة للوكيل ${agentName}`, `Ticket assigné à ${agentName}`), 'success');
  };

  // Save Internal Note in Detail View
  const handleSaveInternalNote = (ticketId: string, note: string) => {
    setTickets(tickets.map(t => (t.id === ticketId ? { ...t, internal_notes: note, updated_at: new Date().toISOString() } : t)));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, internal_notes: note });
    }
    showToast(tr('تم حفظ الملاحظات الخاصة بالطاقم بنجاح', 'Notes enregistrées'), 'success');
  };

  // Convert Live Chat Session to Support Ticket
  const handleConvertChatToTicket = (session: LiveChatSession) => {
    const ticketNum = `TK-CHAT-${Math.floor(100 + Math.random() * 900)}`;

    const messagesTranscribed = session.messages.map(m => ({
      id: m.id,
      sender: m.sender === 'agent' ? ('admin' as const) : ('customer' as const),
      sender_name: m.sender_name,
      message: m.text,
      created_at: m.timestamp,
    }));

    const newTicket: SupportTicket = {
      id: `tk-chat-${Date.now()}`,
      ticket_number: ticketNum,
      customer_name: session.customer_name,
      customer_phone: session.customer_phone,
      customer_type: session.customer_type,
      subject: `محادثة دعم مباشرة مع ${session.customer_name}`,
      category: 'general',
      priority: 'high',
      status: 'open',
      unread_by_admin: false,
      unread_by_customer: false,
      internal_notes: 'تم تحويل هذه التذكرة تلقائياً من منصة المحادثات الحية المباشرة.',
      messages: messagesTranscribed,
      activity_log: [
        {
          id: `act-conv-${Date.now()}`,
          ticket_id: ticketNum,
          action: 'تحويل محادثة مباشرة لتذكرة',
          details: 'تم تفريغ وسجل المحادثة الحية في تذكرة دعم مخصصة',
          performed_by: 'المسؤول',
          timestamp: new Date().toISOString(),
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTickets([newTicket, ...tickets]);
    setSelectedTicket(newTicket);
    setActiveTab('tickets');
    logActivity(ticketNum, 'تحويل شات حي لتذكرة', `تم تحويل محادثة العميل ${session.customer_name}`);
    showToast(tr(`تم تحويل المحادثة الحية للتذكرة ${ticketNum} بنجاح`, `Converti en ticket ${ticketNum}`), 'success');
  };

  // CSV Import Callback
  const handleImportTickets = (importedTickets: SupportTicket[]) => {
    setTickets([...importedTickets, ...tickets]);
    logActivity('ALL', 'استيراد CSV', `تم استيراد ${importedTickets.length} تذكرة دعم بنجاح من ملف CSV`);
    showToast(tr(`تم استيراد ${importedTickets.length} تذكرة دعم بنجاح`, `${importedTickets.length} tickets importés`), 'success');
  };

  return (
    <div dir={dir} className="space-y-6 pb-12">
      {/* Module Title & Tab Navigation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Headphones className="w-7 h-7 text-emerald-400" />
            <span>{tr('مركز خدمة العملاء والدعم الفني', 'Centre de Support Client & B2B')}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {tr('منظومة إدارة التذاكر المتقدمة، المحادثات الحية، والعملاء التجاريين', 'Système de gestion des tickets, chat en direct et support client')}
          </p>
        </div>

        {/* Tab Pill Selectors & Notifications Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Notifications Trigger Button */}
          <button
            onClick={() => setNotifModalOpen(true)}
            className="relative p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-2xl transition"
            title={tr('التنبيهات والإشعارات', 'Notifications')}
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -end-1 px-1.5 py-0.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full animate-bounce">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Sub Tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto">
            {[
              { id: 'dashboard' as const, label: tr('لوحة القيادة', 'Tableau de bord'), icon: LayoutDashboard },
              { id: 'tickets' as const, label: tr('التذاكر', 'Tickets'), icon: MessageSquare, badge: tickets.length },
              { id: 'livechat' as const, label: tr('الشات الحي', 'Live Chat'), icon: Zap, isPulse: true },
              { id: 'logs' as const, label: tr('سجل الأنشطة', 'Historique'), icon: History },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'tickets') setSelectedTicket(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${tab.isPulse ? 'text-amber-400 animate-pulse' : ''}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Render Views */}
      {activeTab === 'dashboard' && (
        <SupportDashboard
          tickets={tickets}
          agents={agents}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onFilterStatus={(status) => setListStatusFilter(status)}
          onFilterPriority={(priority) => setListPriorityFilter(priority)}
          onFilterCustomerType={(type) => setListTypeFilter(type)}
          onCreateTicket={() => {
            setTicketToEdit(null);
            setCreateModalOpen(true);
          }}
        />
      )}

      {activeTab === 'tickets' && (
        <>
          {selectedTicket ? (
            <SupportTicketDetail
              ticket={selectedTicket}
              agents={agents}
              cannedResponses={cannedResponses}
              onCloseDetail={() => setSelectedTicket(null)}
              onSendReply={handleSendReply}
              onUpdateStatus={handleUpdateStatus}
              onUpdatePriority={handleUpdatePriority}
              onAssignAgent={handleAssignAgent}
              onSaveInternalNote={handleSaveInternalNote}
              onDeleteTicket={handleDeleteTicket}
            />
          ) : (
            <SupportTicketList
              tickets={tickets}
              agents={agents}
              selectedTicketId={selectedTicket ? (selectedTicket as SupportTicket).id : null}
              onSelectTicket={handleSelectTicket}
              onCreateTicket={() => {
                setTicketToEdit(null);
                setCreateModalOpen(true);
              }}
              onEditTicket={(ticket) => {
                setTicketToEdit(ticket);
                setCreateModalOpen(true);
              }}
              onDeleteTicket={handleDeleteTicket}
              onBulkDelete={handleBulkDelete}
              onBulkChangeStatus={handleBulkChangeStatus}
              onBulkAssign={handleBulkAssign}
              onBulkExport={handleBulkExport}
              onExportAllCSV={handleExportAllCSV}
              onOpenImportModal={() => setCsvModalOpen(true)}
              initialStatus={listStatusFilter}
              initialPriority={listPriorityFilter}
              initialCustomerType={listTypeFilter}
            />
          )}
        </>
      )}

      {activeTab === 'livechat' && (
        <SupportLiveChatView
          agents={agents}
          onConvertChatToTicket={handleConvertChatToTicket}
        />
      )}

      {activeTab === 'logs' && (
        <SupportActivityLogView
          logs={activityLogs}
          onRefreshLogs={() => showToast(tr('تم تحديث سجل الأنشطة', 'Historique mis à jour'), 'info')}
        />
      )}

      {/* Support Ticket Modal (Create / Edit) */}
      <SupportTicketModal
        isOpen={createModalOpen}
        ticketToEdit={ticketToEdit}
        agents={agents}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleSaveTicketModal}
      />

      {/* CSV Import Modal */}
      <SupportCsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImportTickets={handleImportTickets}
      />

      {/* Notifications Drawer Modal */}
      <SupportNotificationsModal
        isOpen={notifModalOpen}
        notifications={notifications}
        onClose={() => setNotifModalOpen(false)}
        onMarkAllRead={() => {
          setNotifications(notifications.map(n => ({ ...n, is_read: true })));
          showToast(tr('تم تحديد جميع الإشعارات كمقروءة', 'Toutes les notifications sont lues'), 'info');
        }}
        onSelectTicketByNumber={(ticketNum) => {
          const target = tickets.find(t => t.ticket_number === ticketNum);
          if (target) {
            handleSelectTicket(target);
            setActiveTab('tickets');
          }
        }}
      />
    </div>
  );
}
