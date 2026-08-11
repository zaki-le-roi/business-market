import { useMemo } from 'react';
import {
  Headphones, MessageSquare, CheckCircle2, Clock,
  AlertTriangle, ArrowUpRight, TrendingUp, Users, Building2,
  BarChart3, Zap
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SupportTicket, SupportAgent } from '../../types/support';

interface Props {
  tickets: SupportTicket[];
  agents: SupportAgent[];
  onNavigateTab: (tab: 'tickets' | 'livechat' | 'logs') => void;
  onFilterStatus?: (status: string) => void;
  onFilterPriority?: (priority: string) => void;
  onFilterCustomerType?: (type: string) => void;
  onCreateTicket: () => void;
}

export default function SupportDashboard({
  tickets,
  agents,
  onNavigateTab,
  onFilterStatus,
  onFilterPriority,
  onFilterCustomerType,
  onCreateTicket,
}: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Computed Metrics
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress' || t.status === 'pending' || t.status === 'waiting_customer').length;
    const resolvedClosed = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length;
    const highCount = tickets.filter(t => t.priority === 'high' && t.status !== 'closed' && t.status !== 'resolved').length;
    const retailCount = tickets.filter(t => t.customer_type === 'retail').length;
    const wholesaleCount = tickets.filter(t => t.customer_type === 'wholesale').length;
    const unreadCount = tickets.filter(t => t.unread_by_admin).length;

    // Categories distribution
    const categoryCounts: Record<string, number> = {};
    tickets.forEach(t => {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });

    const resolutionRate = total > 0 ? Math.round((resolvedClosed / total) * 100) : 100;

    return {
      total,
      open,
      inProgress,
      resolvedClosed,
      urgentCount,
      highCount,
      retailCount,
      wholesaleCount,
      unreadCount,
      categoryCounts,
      resolutionRate,
      avgResponseTime: '12 min',
      avgResolutionTime: '2.4 hrs',
      satisfactionScore: '98.5%',
    };
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {tr('مركز خدمة العملاء والدعم الفني المتقدم', 'Centre de Support Client & B2B Advanced')}
            </h2>
            <p className="text-xs text-slate-400">
              {tr('إدارة التذاكر، الدعم المباشر، والعملاء وتتبع الأداء لحظة بلحظة', 'Gestion des tickets, support en direct, clients B2B & suivi en temps réel')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateTab('livechat')}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{tr('المحادثات المباشرة', 'Chat En Direct')}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={onCreateTicket}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{tr('إنشاء تذكرة جديدة', 'Nouveau Ticket')}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Tickets */}
        <div
          onClick={() => {
            if (onFilterStatus) onFilterStatus('open');
            onNavigateTab('tickets');
          }}
          className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">{tr('التذاكر المفتوحة', 'Tickets Ouverts')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{metrics.open}</span>
            <span className="text-xs text-blue-400 flex items-center gap-0.5">
              <span>{tr('تطلب المعالجة', 'À traiter')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (metrics.open / Math.max(1, metrics.total)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Urgent & High Priority */}
        <div
          onClick={() => {
            if (onFilterPriority) onFilterPriority('urgent');
            onNavigateTab('tickets');
          }}
          className="bg-slate-900 border border-slate-800 hover:border-rose-500/50 p-4 rounded-2xl cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">{tr('عاجلة ومرتفعة الأولوية', 'Urgents & Élevés')}</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-105 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{metrics.urgentCount + metrics.highCount}</span>
            <span className="text-xs text-rose-400 font-semibold">
              {metrics.urgentCount} {tr('عاجل جداً', 'Urgents')}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((metrics.urgentCount + metrics.highCount) / Math.max(1, metrics.total)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Resolved & Closed */}
        <div
          onClick={() => {
            if (onFilterStatus) onFilterStatus('resolved');
            onNavigateTab('tickets');
          }}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-2xl cursor-pointer transition group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">{tr('تم التثبيت والحل', 'Résolus & Fermés')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{metrics.resolvedClosed}</span>
            <span className="text-xs text-emerald-400 font-bold">
              {metrics.resolutionRate}% {tr('معدل الحل', 'Taux')}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.resolutionRate}%` }}
            />
          </div>
        </div>

        {/* Avg Response & CSAT */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">{tr('متوسط سرعة الاستجابة', 'Temps Réponse Moyen')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{metrics.avgResponseTime}</span>
            <span className="text-xs text-amber-400 font-semibold">
              {metrics.satisfactionScore} {tr('رضا العملاء', 'CSAT')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            {tr('متوسط زمن إغلاق التذكرة:', 'Résolution moyenne:')} <strong className="text-slate-300">{metrics.avgResolutionTime}</strong>
          </p>
        </div>
      </div>

      {/* Middle Section: Retail vs B2B & Category Distribution & Online Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Type Breakdown (Retail vs Wholesale B2B) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>{tr('نوعية العملاء (تجزئة / جملة B2B)', 'Type de Client (Détail / B2B)')}</span>
            </h3>
            <span className="text-xs text-slate-500">{metrics.total} {tr('تذكرة إجمالية', 'tickets au total')}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => {
                if (onFilterCustomerType) onFilterCustomerType('retail');
                onNavigateTab('tickets');
              }}
              className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl cursor-pointer transition text-center space-y-1"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mx-auto flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-400">{tr('عملاء التجزئة', 'Détail Retail')}</p>
              <p className="text-lg font-extrabold text-slate-100">{metrics.retailCount}</p>
            </div>

            <div
              onClick={() => {
                if (onFilterCustomerType) onFilterCustomerType('wholesale');
                onNavigateTab('tickets');
              }}
              className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl cursor-pointer transition text-center space-y-1"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-400">{tr('عملاء الجملة B2B', 'Gros B2B')}</p>
              <p className="text-lg font-extrabold text-slate-100">{metrics.wholesaleCount}</p>
            </div>
          </div>

          {/* Customer Unread Indicator */}
          {metrics.unreadCount > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                {tr('توجد تذاكر غير مقروءة بانتظار مراجعتك:', 'Tickets non lus en attente:')}
              </span>
              <strong className="font-extrabold text-amber-200">{metrics.unreadCount}</strong>
            </div>
          )}
        </div>

        {/* Categories Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>{tr('توزيع التذاكر حسب الفئة', 'Répartition par Catégorie')}</span>
            </h3>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {[
              { key: 'orders', name: tr('الطلبات والمبيعات', 'Commandes'), color: 'bg-emerald-500' },
              { key: 'shipping', name: tr('الشحن والتوصيل', 'Livraison & Expédition'), color: 'bg-blue-500' },
              { key: 'payments', name: tr('الدفع والفواتير', 'Paiements & Factures'), color: 'bg-purple-500' },
              { key: 'wholesale_b2b', name: tr('طلبات الجملة B2B', 'Demandes Gros B2B'), color: 'bg-amber-500' },
              { key: 'returns', name: tr('الإرجاع والاستبدال', 'Retours & Échanges'), color: 'bg-rose-500' },
              { key: 'product_inquiry', name: tr('استفسارات المنتجات', 'Infos Produits'), color: 'bg-cyan-500' },
              { key: 'general', name: tr('استفسارات عامة', 'Général'), color: 'bg-slate-500' },
            ].map(cat => {
              const count = metrics.categoryCounts[cat.key] || 0;
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{cat.name}</span>
                    <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className={`${cat.color} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Support Agents Team */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>{tr('فريق الدعم الفني المباشر', 'Équipe Support Technique')}</span>
            </h3>
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {agents.filter(a => a.is_online).length} {tr('متصل الآن', 'En ligne')}
            </span>
          </div>

          <div className="space-y-2.5">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-600">
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${agent.is_online ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{agent.name}</p>
                    <p className="text-[10px] text-slate-400">{agent.role}</p>
                  </div>
                </div>

                <div className="text-end">
                  <span className="text-xs font-extrabold text-slate-200">{agent.active_tickets_count}</span>
                  <p className="text-[10px] text-slate-500">{tr('تذكرة مخصصة', 'tickets')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Quick Feed Preview */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>{tr('أحدث التذاكر المفتوحة حديثاً', 'Derniers Tickets Récents')}</span>
          </h3>
          <button
            onClick={() => onNavigateTab('tickets')}
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>{tr('عرض كافة التذاكر', 'Voir tous les tickets')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {tickets.slice(0, 4).map(ticket => (
            <div
              key={ticket.id}
              onClick={() => onNavigateTab('tickets')}
              className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 px-2 rounded-xl transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400">{ticket.ticket_number}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    ticket.priority === 'urgent' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                    ticket.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                    ticket.priority === 'medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}>
                    {ticket.priority.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    ticket.customer_type === 'wholesale' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {ticket.customer_type === 'wholesale' ? 'B2B Wholesale' : 'Retail'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-200">{ticket.subject}</p>
                <p className="text-[11px] text-slate-400">{ticket.customer_name} • {ticket.customer_phone}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                  ticket.status === 'open' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                  ticket.status === 'in_progress' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                  ticket.status === 'waiting_customer' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                  ticket.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {ticket.status}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(ticket.created_at).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
