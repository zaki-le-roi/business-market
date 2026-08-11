import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface AppConfig {
  latest_version_code: number;
  latest_version_name: string;
  is_mandatory?: boolean;
  notes_ar?: string;
  notes_fr?: string;
  download_url?: string;
}

export default function AppUpdateChecker() {
  const { lang, dir } = useLanguage();
  const [updateAvailable, setUpdateAvailable] = useState<AppConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      // Current app version code in web preview / android app
      const CURRENT_VERSION_CODE = 100; // default version code

      const { data } = await supabase.from('app_config').select('*').single();
      if (data && data.latest_version_code > CURRENT_VERSION_CODE) {
        setUpdateAvailable(data as AppConfig);
      }
    } catch {
      // Ignore network errors on background update check
    }
  };

  if (!updateAvailable || dismissed) return null;

  const notes = lang === 'ar' ? updateAvailable.notes_ar : updateAvailable.notes_fr;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto bg-slate-900 border border-emerald-500/50 shadow-2xl rounded-2xl p-4 text-slate-100" dir={dir}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl">
            <Download className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-emerald-400">
              {lang === 'ar' ? `تحديث جديد متوفر v${updateAvailable.latest_version_name}` : `New Update Available v${updateAvailable.latest_version_name}`}
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">{notes || (lang === 'ar' ? 'تحديث جديد لتحسين الأداء واستقرار التطبيق' : 'Performance and stability improvements')}</p>
          </div>
        </div>
        {!updateAvailable.is_mandatory && (
          <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <a
          href={updateAvailable.download_url || `https://github.com/zaki-le-roi/business-market-releases/releases/latest`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'تحميل التحديث الآن' : 'Download Update APK'}</span>
        </a>
      </div>
    </div>
  );
}
