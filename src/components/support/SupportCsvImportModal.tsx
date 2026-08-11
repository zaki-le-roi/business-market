import { useState } from 'react';
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SupportTicket, TicketStatus, TicketPriority, CustomerSupportType, TicketCategory } from '../../types/support';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportTickets: (tickets: SupportTicket[]) => void;
}

export default function SupportCsvImportModal({
  isOpen,
  onClose,
  onImportTickets,
}: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [parsedPreview, setParsedPreview] = useState<Partial<SupportTicket>[]>([]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        parseCSV(content);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (csv: string) => {
    try {
      setError('');
      const lines = csv.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setError(tr('الملف يحتوي على صف واحد فقط، يتطلب وجود العناوين والبيانات', 'Fichier CSV vide ou invalide'));
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const results: Partial<SupportTicket>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length < 3) continue;

        const ticketNumIndex = headers.findIndex(h => h.includes('number') || h.includes('ticket') || h.includes('رقم'));
        const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('customer') || h.includes('اسم'));
        const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('هاتف'));
        const subjectIndex = headers.findIndex(h => h.includes('subject') || h.includes('موضوع'));
        const typeIndex = headers.findIndex(h => h.includes('type') || h.includes('نوع'));

        const ticketNum = ticketNumIndex >= 0 ? values[ticketNumIndex] : `TK-IMP-${Date.now().toString().slice(-4)}${i}`;
        const name = nameIndex >= 0 ? values[nameIndex] : (values[0] || 'عميل مستورد');
        const phone = phoneIndex >= 0 ? values[phoneIndex] : (values[1] || '0550000000');
        const subject = subjectIndex >= 0 ? values[subjectIndex] : (values[2] || 'تذكرة مستوردة من CSV');
        const custType: CustomerSupportType = (typeIndex >= 0 && values[typeIndex].toLowerCase().includes('wholesale')) ? 'wholesale' : 'retail';

        results.push({
          id: `imp-${Date.now()}-${i}`,
          ticket_number: ticketNum,
          customer_name: name,
          customer_phone: phone,
          customer_type: custType,
          subject: subject,
          category: 'general' as TicketCategory,
          priority: 'medium' as TicketPriority,
          status: 'open' as TicketStatus,
          unread_by_admin: true,
          unread_by_customer: false,
          messages: [
            {
              id: `imp-msg-${i}`,
              sender: 'customer',
              message: subject,
              created_at: new Date().toISOString(),
            }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      setParsedPreview(results);
    } catch {
      setError(tr('حدث خطأ أثناء معالجة ملف CSV', 'Erreur de lecture CSV'));
    }
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) return;
    onImportTickets(parsedPreview as SupportTicket[]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-slate-100 text-sm">
              {tr('استيراد التذاكر من ملف CSV', 'Importer Tickets CSV')}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center p-6 bg-slate-950 border-2 border-dashed border-slate-800 hover:border-blue-500 rounded-2xl cursor-pointer transition">
            <Upload className="w-8 h-8 text-blue-400 mb-2" />
            <span className="text-xs font-bold text-slate-200">
              {tr('اضغط هنا لرفع ملف CSV أو اسحبه هنا', 'Cliquez pour sélectionner un fichier CSV')}
            </span>
            <span className="text-[11px] text-slate-500 mt-1">
              (Headers: ticket_number, customer_name, customer_phone, subject, type)
            </span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>

          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                <span>{tr('معاينة التذاكر المعالجة:', 'Aperçu des tickets:')}</span>
                <span className="text-emerald-400 font-mono">{parsedPreview.length} {tr('تذكرة جاهزة', 'tickets')}</span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                {parsedPreview.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg text-slate-200">
                    <span className="font-mono text-emerald-400 font-bold">{item.ticket_number}</span>
                    <span className="font-semibold">{item.customer_name} ({item.customer_phone})</span>
                    <span className="truncate max-w-[150px] text-slate-400">{item.subject}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">
            {tr('إلغاء', 'Annuler')}
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>{tr('تأكيد استيراد التذاكر', 'Confirmer Import')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
