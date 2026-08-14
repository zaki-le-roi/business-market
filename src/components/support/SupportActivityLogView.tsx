import { useState, useMemo } from 'react';
import { History, Search, RefreshCw, User } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { TicketActivityLog } from '../../types/support';

interface Props {
  logs: TicketActivityLog[];
  onRefreshLogs?: () => void;
}

export default function SupportActivityLogView({ logs, onRefreshLogs }: Props) {
  const { lang, formatDate } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [search, setSearch] = useState('');

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      l =>
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.performed_by.toLowerCase().includes(q) ||
        l.ticket_id.toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            {tr('سجل نشاطات وعمليات الدعم الفني الكامل', 'Historique Complet des Activités')}
          </h3>
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-mono font-bold rounded-full border border-amber-500/20">
            {filteredLogs.length}
          </span>
        </div>

        {onRefreshLogs && (
          <button
            onClick={onRefreshLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{tr('تحديث السجل', 'Raffraîchir')}</span>
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('بحث في السجل الإداري برقم التذكرة، الوكيل، الإجراء...', 'Recherche par ticket, agent, action...')}
            className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl ps-9 pe-3 py-2.5 outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-xs font-semibold">{tr('لا توجد سجلات نشاط مسجلة حالياً', 'Aucune activité trouvée')}</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded border border-amber-500/20">
                      {log.action}
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-400">#{log.ticket_id}</span>
                  </div>
                  <p className="text-xs text-slate-200">{log.details}</p>
                </div>

                <div className="text-end text-xs text-slate-400 space-y-0.5">
                  <p className="font-semibold text-slate-300 flex items-center gap-1 justify-end">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>{log.performed_by}</span>
                  </p>
                  <p className="font-mono text-[10px] text-slate-500">{formatDate(log.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
