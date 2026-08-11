import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemName?: string;
  confirmText?: string;
  isDeleting?: boolean;
  error?: string | null;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  isDeleting = false,
  error = null,
}: ConfirmDeleteModalProps) {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';

  if (!isOpen) return null;

  const defaultTitle = isAr
    ? 'تأكيد عملية الحذف'
    : lang === 'fr'
    ? 'Confirmer la suppression'
    : 'Confirm Deletion';

  const defaultDesc = isAr
    ? 'هل أنت متأكد من رغبتك في حذف هذا العنصر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.'
    : lang === 'fr'
    ? 'Êtes-vous sûr de vouloir supprimer cet élément définitivement ? Cette action est irréversible.'
    : 'Are you sure you want to permanently delete this item? This action cannot be undone.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex-shrink-0">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{title || defaultTitle}</h3>
            {itemName && (
              <p className="text-xs font-semibold text-rose-400 mt-0.5 line-clamp-1">
                "{itemName}"
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {description || defaultDesc}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{error}</div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {isAr ? 'إلغاء' : lang === 'fr' ? 'Annuler' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isAr ? 'جاري الحذف...' : lang === 'fr' ? 'Suppression...' : 'Deleting...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>{isAr ? 'حذف نهائي' : lang === 'fr' ? 'Supprimer' : 'Delete'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
