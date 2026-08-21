import { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../contexts/LanguageContext';
import {
  checkForUpdate,
  startAutomaticUpdate,
  launchInstaller,
  requestInstallPermission,
  RemoteVersionManifest,
  AppVersionInfo,
  UpdateDownloadProgress
} from '../services/appUpdater';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready_to_install' | 'error';

export default function AppUpdateChecker() {
  const { lang, dir } = useLanguage();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [manifest, setManifest] = useState<RemoteVersionManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState<AppVersionInfo | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isStartedRef = useRef(false);

  useEffect(() => {
    // Run update check on mount
    runUpdateCheck();

    // Re-check periodically every 30 minutes
    const interval = setInterval(() => {
      runUpdateCheck();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const runUpdateCheck = async () => {
    // Only proceed on native Android platform or in dev mode
    const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    if (!isAndroid) {
      return;
    }

    try {
      setStatus('checking');
      const result = await checkForUpdate();
      setCurrentVersion(result.currentVersion);

      if (result.updateAvailable && result.remoteManifest) {
        setManifest(result.remoteManifest);
        setStatus('available');

        // Automatically start the download and installation!
        if (!isStartedRef.current) {
          isStartedRef.current = true;
          triggerAutoDownload(result.remoteManifest);
        }
      } else {
        setStatus('idle');
      }
    } catch (err) {
      console.warn('Background update check failed:', err);
      setStatus('idle');
    }
  };

  const triggerAutoDownload = (targetManifest: RemoteVersionManifest) => {
    setStatus('downloading');
    setProgress(0);
    setErrorMessage(null);

    startAutomaticUpdate(
      targetManifest.apkUrl,
      (prog: UpdateDownloadProgress) => {
        if (prog.percent >= 0) {
          setProgress(prog.percent);
        }
      },
      () => {
        // Download complete - native plugin will launch installer automatically
        setStatus('ready_to_install');
        setProgress(100);
      },
      (err: string) => {
        console.error('Update download error:', err);
        setStatus('error');
        setErrorMessage(err);
      }
    );
  };

  const handleManualInstallClick = async () => {
    try {
      await launchInstaller();
    } catch {
      await requestInstallPermission();
    }
  };

  const handleRetry = () => {
    if (manifest) {
      triggerAutoDownload(manifest);
    } else {
      runUpdateCheck();
    }
  };

  if (dismissed || status === 'idle' || status === 'checking') {
    return null;
  }

  const notes = lang === 'ar' ? manifest?.notes_ar : manifest?.notes_fr;

  return (
    <div
      className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl rounded-2xl p-4 text-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-300"
      dir={dir}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl flex-shrink-0">
            {status === 'downloading' ? (
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            ) : status === 'ready_to_install' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : status === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <Download className="w-5 h-5 animate-bounce text-emerald-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-emerald-400 truncate">
                {status === 'downloading'
                  ? (lang === 'ar' ? `جاري تحديث التطبيق إلى v${manifest?.versionName}` : `Updating App to v${manifest?.versionName}`)
                  : status === 'ready_to_install'
                  ? (lang === 'ar' ? 'التحديث جاهز للتثبيت' : 'Update Ready to Install')
                  : status === 'error'
                  ? (lang === 'ar' ? 'تعذر إكمال التحديث' : 'Update Error')
                  : (lang === 'ar' ? `تحديث جديد v${manifest?.versionName}` : `New Update v${manifest?.versionName}`)}
              </h4>
              {manifest?.versionName && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                  {currentVersion?.versionName ? `v${currentVersion.versionName} → v${manifest.versionName}` : `v${manifest.versionName}`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 line-clamp-2">
              {status === 'downloading'
                ? (lang === 'ar' ? `جاري تحميل حزمة التحديث تلقائياً... (${progress}%)` : `Downloading update automatically... (${progress}%)`)
                : status === 'ready_to_install'
                ? (lang === 'ar' ? 'جاري فتح مثبت الحزم لإكمال التحديث...' : 'Opening package installer to finalize update...')
                : status === 'error'
                ? (errorMessage || (lang === 'ar' ? 'حدث خطأ أثناء تنزيل التحديث' : 'An error occurred during download'))
                : (notes || (lang === 'ar' ? 'تحسينات في الأداء والميزات الجديدة' : 'Performance and stability improvements'))}
            </p>
          </div>
        </div>
        {!manifest?.isMandatory && status !== 'downloading' && (
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Live Download Progress Bar */}
      {status === 'downloading' && (
        <div className="mt-3.5 space-y-1.5">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>{lang === 'ar' ? 'تنزيل تلقائي في الخلفية' : 'Background auto-download'}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* Ready to Install or Error Actions */}
      {status === 'ready_to_install' && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleManualInstallClick}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تثبيت التحديث الآن' : 'Install Update Now'}</span>
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs text-center rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
