import { X, Bell, Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SupportNotification } from '../../types/support';

interface Props {
  isOpen: boolean;
  notifications: SupportNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onSelectTicketByNumber: (ticketNum: string) => void;
}

export default function SupportNotificationsModal({
  isOpen,
  notifications,
  onClose,
  onMarkAllRead,
  onSelectTicketByNumber,
}: Props) {
  const { lang, formatDate } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 text-sm">
              {tr('إشعارات وتنبيهات الدعم الفني', 'Notifications Support')}
            </h3>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {tr('إجمالي الإشعارات:', 'Total:')} <strong className="text-slate-200">{notifications.length}</strong>
          </span>

          <button
            onClick={onMarkAllRead}
            className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{tr('تحديد الكل كمقروء', 'Tout marquer comme lu')}</span>
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-xs">{tr('لا توجد إشعارات جديدة حالياً', 'Aucune notification')}</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => {
                  onSelectTicketByNumber(n.ticket_number);
                  onClose();
                }}
                className={`p-3 rounded-xl border cursor-pointer transition space-y-1 ${
                  !n.is_read
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="font-mono text-emerald-400">#{n.ticket_number}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{formatDate(n.created_at)}</span>
                </div>
                <p className="text-xs text-slate-200">{n.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 text-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">
            {tr('إغلاق', 'Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
}
