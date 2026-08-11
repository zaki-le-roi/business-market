import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FinanceActivityLog } from '../../types/finance';

interface Props {
  activityLogs: FinanceActivityLog[];
}

export default function FinanceActivityLogView({ activityLogs }: Props) {
  const { lang, formatDate } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.details.toLowerCase().includes(q) ||
        log.user_name.toLowerCase().includes(q) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(q));

      const matchAction = actionFilter === 'all' || log.action_type === actionFilter;

      return matchSearch && matchAction;
    });
  }, [activityLogs, searchQuery, actionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('بحث في سجّلات النشاط المالي...', 'Rechercher dans l\'historique financier...')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{tr('كل الأنشطة', 'Toutes actions')}</option>
            <option value="invoice_created">{tr('إنشاء فاتورة', 'Création facture')}</option>
            <option value="payment_recorded">{tr('تسجيل دفع', 'Paiement enregistré')}</option>
            <option value="expense_added">{tr('إضافة مصروف', 'Dépense ajoutée')}</option>
            <option value="invoice_status_changed">{tr('تغيير حالة فاتورة', 'Changement statut')}</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3 text-start">{tr('التاريخ والوقت', 'Date & Heure')}</th>
                <th className="py-3 px-3 text-start">{tr('المستخدم', 'Utilisateur')}</th>
                <th className="py-3 px-3 text-start">{tr('نوع النشاط', 'Type d\'Action')}</th>
                <th className="py-3 px-3 text-start">{tr('تفاصيل المعاملة المالية', 'Détails de l\'action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    {tr('لا توجد سجلات نشاط مطابقة', 'Aucun historique trouvé')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-950/40 transition">
                    <td className="py-3 px-3 text-slate-400 font-mono" dir="ltr">{formatDate(log.created_at)}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{log.user_name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-emerald-400 border border-slate-800 uppercase">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-medium">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
