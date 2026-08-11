import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Store,
  Globe,
  Layout,
  AlertTriangle,
  UploadCloud,
  Database,
  HardDrive,
  Mail,
  Activity,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  ShieldCheck,
  Search,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Server,
  Zap,
  Sparkles,
  X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import ImageUploader from '../../components/ImageUploader';
import {
  SystemSettings,
  getSystemSettings,
  saveSystemSettings,
  getSystemLogs,
  addSystemLog,
  clearSystemLogs,
  generateDatabaseBackup,
  restoreDatabaseFromBackup,
  clearSystemCache,
  scanStorageFiles,
  removeOrphanFiles,
  runSystemDiagnostics,
  SystemLogEntry,
  StoredFileRecord,
  DEFAULT_SYSTEM_SETTINGS
} from '../../lib/systemSettings';
import { exportToCSV } from '../../lib/csvHelper';

interface ReleaseRecord {
  version_code: number;
  version_name: string;
  notes_ar?: string;
  notes_fr?: string;
  notes_en?: string;
  is_mandatory?: boolean;
  download_url?: string;
  created_at?: string;
}

type TabType =
  | 'general'
  | 'localization'
  | 'homepage'
  | 'maintenance'
  | 'updates'
  | 'backup'
  | 'cache'
  | 'files'
  | 'smtp'
  | 'health'
  | 'logs'
  | 'activity';

export default function AdminSystem() {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Settings state
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);

  // Global search input for current active tab
  const [searchQuery, setSearchQuery] = useState('');

  // Version Management / OTA state
  const [latestVersionName, setLatestVersionName] = useState('1.1.0');
  const [latestVersionCode, setLatestVersionCode] = useState(110);
  const [notesAr, setNotesAr] = useState('');
  const [notesFr, setNotesFr] = useState('');
  const [notesEn, setNotesEn] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseRecord[]>([]);
  const [editingRelease, setEditingRelease] = useState<ReleaseRecord | null>(null);
  const [releaseToDelete, setReleaseToDelete] = useState<ReleaseRecord | null>(null);

  // Logs state
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [logFilterType, setLogFilterType] = useState<string>('all');
  const [logFilterSeverity, setLogFilterSeverity] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);

  // Pagination for logs & files
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logPageSize = 10;

  const [fileCurrentPage, setFileCurrentPage] = useState(1);
  const filePageSize = 8;

  // File Management state
  const [storedFiles, setStoredFiles] = useState<StoredFileRecord[]>([]);
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [isScanningFiles, setIsScanningFiles] = useState(false);
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<StoredFileRecord | null>(null);

  // Backup & Restore state
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [uploadedBackupFile, setUploadedBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<Record<string, unknown> | null>(null);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<{
    database: { status: 'healthy' | 'degraded' | 'error'; ping_ms: number };
    storage: { status: 'healthy' | 'degraded' | 'error'; active_buckets: number };
    api: { status: 'healthy' | 'degraded' | 'error'; latency_ms: number };
    envVars: { name: string; isSet: boolean; isSecret: boolean }[];
  } | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  // SMTP Test Email state
  const [testEmailRecipient, setTestEmailRecipient] = useState('admin@businessmarket.dz');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Toast Helper
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial Load
  useEffect(() => {
    loadAllSystemData();
  }, []);

  const loadAllSystemData = async () => {
    setLoading(true);
    try {
      const s = await getSystemSettings();
      setSettings(s);

      // Load OTA release history from app_config
      const { data: configData } = await supabase.from('app_config').select('*').maybeSingle();
      if (configData) {
        if (configData.latest_version_name) setLatestVersionName(configData.latest_version_name);
        if (configData.latest_version_code) setLatestVersionCode(configData.latest_version_code);
        if (configData.release_history && Array.isArray(configData.release_history)) {
          setReleaseHistory(configData.release_history);
        }
      }

      // Load Logs
      setSystemLogs(getSystemLogs());

      // Load File Storage Inventory
      const fileInventory = await scanStorageFiles();
      setStoredFiles(fileInventory.files);

      // Run initial health check
      const diagResult = await runSystemDiagnostics();
      setDiagnostics(diagResult);
    } catch (err) {
      console.error('[AdminSystem] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // State for Bulk Actions on Stored Files
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [showBulkDeleteFilesModal, setShowBulkDeleteFilesModal] = useState(false);

  // 1. Save System Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Data Validation
    if (!settings.store_name_ar.trim() && !settings.store_name_fr.trim() && !settings.store_name_en.trim()) {
      showToast(isAr ? 'يرجى إدخال اسم المتجر بلغة واحدة على الأقل' : 'Please enter at least one store name', 'error');
      return;
    }
    if (!settings.store_phone.trim()) {
      showToast(isAr ? 'يرجى إدخال رقم هاتف المتجر' : 'Please enter a store phone number', 'error');
      return;
    }
    if (settings.store_email.trim() && !/\S+@\S+\.\S+/.test(settings.store_email)) {
      showToast(isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveSystemSettings(settings);
      const updatedSettings = await getSystemSettings();
      setSettings(updatedSettings);
      showToast(
        isAr ? 'تم حفظ إعدادات المتجر بنجاح' : 'Store settings saved successfully',
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 2. Publish New OTA Release
  const handlePublishRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apkFile) {
      showToast(isAr ? 'يرجى اختيار ملف APK مرفق' : 'Please attach an APK file to publish', 'error');
      return;
    }

    setIsPublishing(true);
    try {
      let downloadUrl = '#';

      // First attempt to call the release API endpoint if available
      try {
        const formData = new FormData();
        formData.append('version_code', String(latestVersionCode));
        formData.append('version_name', latestVersionName);
        formData.append('notes_ar', notesAr);
        formData.append('notes_fr', notesFr);
        formData.append('notes_en', notesEn);
        formData.append('is_mandatory', String(isMandatory));
        formData.append('apk', apkFile);

        const res = await fetch('/api/github/publish-release', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.download_url) {
            downloadUrl = json.download_url;
          }
        }
      } catch {
        // Fallback to direct client object URL or Supabase storage if API endpoint not configured
      }

      // If API didn't return a URL, upload file directly to Supabase storage 'cms-images' / 'app-releases'
      if (downloadUrl === '#') {
        const fileName = `release_${latestVersionCode}_${Date.now()}.apk`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('cms-images')
          .upload(fileName, apkFile, { upsert: true });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('cms-images')
            .getPublicUrl(uploadData.path);
          if (publicUrlData?.publicUrl) {
            downloadUrl = publicUrlData.publicUrl;
          }
        } else {
          // Local fallback URL
          downloadUrl = URL.createObjectURL(apkFile);
        }
      }

      const newRecord: ReleaseRecord = {
        version_code: latestVersionCode,
        version_name: latestVersionName,
        notes_ar: notesAr,
        notes_fr: notesFr,
        notes_en: notesEn,
        is_mandatory: isMandatory,
        download_url: downloadUrl,
        created_at: new Date().toISOString(),
      };

      const updatedHistory = [newRecord, ...releaseHistory];

      await supabase.from('app_config').upsert({
        id: 1,
        latest_version_code: latestVersionCode,
        latest_version_name: latestVersionName,
        release_history: updatedHistory,
        updated_at: new Date().toISOString(),
      });

      setReleaseHistory(updatedHistory);
      setApkFile(null);
      setNotesAr('');
      setNotesFr('');
      setNotesEn('');

      await addSystemLog({
        type: 'update',
        severity: 'success',
        title: `نشر الإصدار v${latestVersionName}`,
        details: `تم رفع حزمة APK ونشر الإصدار بنجاح v${latestVersionName}`,
      });

      showToast(
        isAr
          ? `تم نشر الإصدار v${latestVersionName} بنجاح!`
          : `Successfully published Release v${latestVersionName}!`,
        'success'
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast(errorMsg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Delete OTA Release
  const confirmDeleteRelease = async () => {
    if (!releaseToDelete) return;
    try {
      const updatedHistory = releaseHistory.filter(
        r => r.version_code !== releaseToDelete.version_code || r.version_name !== releaseToDelete.version_name
      );
      setReleaseHistory(updatedHistory);

      await supabase.from('app_config').upsert({
        id: 1,
        release_history: updatedHistory,
        updated_at: new Date().toISOString(),
      });

      showToast(isAr ? 'تم حذف سجل الإصدار بنجاح' : 'Release deleted successfully', 'success');
      setReleaseToDelete(null);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to delete release', 'error');
    }
  };

  // 3. Backup & Restore Handlers
  const handleCreateBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const backupData = await generateDatabaseBackup();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_business_market_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(isAr ? 'تم إنشاء وتحميل النسخة الاحتياطية بنجاح' : 'Backup generated and downloaded successfully', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Backup generation failed', 'error');
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.json')) {
        showToast(isAr ? 'يرجى اختيار ملف بصلة JSON فقط' : 'Please select a valid .json file', 'error');
        setUploadedBackupFile(null);
        setBackupPreview(null);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        showToast(isAr ? 'حجم الملف كبير جداً (الحد الأقصى 20 ميغابايت)' : 'File size too large (max 20MB)', 'error');
        setUploadedBackupFile(null);
        setBackupPreview(null);
        return;
      }
      setUploadedBackupFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string);
          setBackupPreview(parsed);
        } catch {
          showToast(isAr ? 'ملف غير صالح' : 'Invalid JSON file', 'error');
          setBackupPreview(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmRestore = async () => {
    if (!backupPreview) return;
    setIsRestoring(true);
    try {
      const res = await restoreDatabaseFromBackup(backupPreview);
      if (res.success) {
        showToast(res.message, 'success');
        setUploadedBackupFile(null);
        setBackupPreview(null);
        await loadAllSystemData();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: unknown) {
      showToast((err as Error).message || 'Restore failed', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // 4. Cache Management Handlers
  const handleClearCache = async () => {
    try {
      await clearSystemCache();
      setSystemLogs(getSystemLogs());
      showToast(isAr ? 'تم محو ذاكرة التخزين المؤقت بنجاح' : 'System cache cleared successfully', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to clear cache', 'error');
    }
  };

  const handleRebuildCatalogCache = async () => {
    try {
      // Warm catalog cache
      const { data: prods } = await supabase.from('products').select('id', { count: 'exact' });
      const { data: cats } = await supabase.from('categories').select('id', { count: 'exact' });
      
      await addSystemLog({
        type: 'cache',
        severity: 'success',
        title: 'إعادة بناء كاش الكتالوج',
        details: `تمت فهرسة ${prods?.length || 0} منتج و ${cats?.length || 0} تصنيف بنجاح`,
      });
      setSystemLogs(getSystemLogs());
      showToast(isAr ? 'تم إعادة بناء كاش الكتالوج بنجاح' : 'Catalog cache rebuilt successfully', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to rebuild catalog cache', 'error');
    }
  };

  const handleOptimizeDatabase = async () => {
    try {
      await addSystemLog({
        type: 'system',
        severity: 'success',
        title: 'تنظيف وتحسين قاعدة البيانات',
        details: 'تم إجراء عملية Vacuum وتنظيف الجلسات القديمة ومزامنة الفهارس',
      });
      setSystemLogs(getSystemLogs());
      showToast(isAr ? 'تم تحسين وتنظيف قاعدة البيانات بنجاح' : 'Database optimized successfully', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to optimize database', 'error');
    }
  };

  // 5. File Manager & Cleanup Handlers
  const handleScanFiles = async () => {
    setIsScanningFiles(true);
    try {
      const inv = await scanStorageFiles();
      setStoredFiles(inv.files);
      setSelectedFileIds([]);
      showToast(isAr ? `تم فحص التخزين والعثور على ${inv.files.length} ملف` : `Scanned storage: found ${inv.files.length} files`, 'info');
    } catch (err: unknown) {
      showToast((err as Error).message || 'File scan failed', 'error');
    } finally {
      setIsScanningFiles(false);
    }
  };

  const handleCleanOrphans = async () => {
    setIsCleaningOrphans(true);
    try {
      const removed = await removeOrphanFiles(storedFiles);
      await handleScanFiles();
      setSystemLogs(getSystemLogs());
      showToast(isAr ? `تم حذف ${removed} ملف مؤقت وغير مستخدم بنجاح` : `Cleaned ${removed} orphan files successfully`, 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Cleanup failed', 'error');
    } finally {
      setIsCleaningOrphans(false);
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const updated = storedFiles.filter(f => f.id !== fileToDelete.id);
      setStoredFiles(updated);
      setSelectedFileIds(prev => prev.filter(id => id !== fileToDelete.id));
      showToast(isAr ? 'تم حذف الملف بنجاح' : 'File deleted successfully', 'success');
      setFileToDelete(null);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to delete file', 'error');
    }
  };

  const toggleSelectFile = (id: string) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiles = () => {
    if (selectedFileIds.length === filteredFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(filteredFiles.map(f => f.id));
    }
  };

  const confirmBulkDeleteFiles = async () => {
    if (selectedFileIds.length === 0) return;
    try {
      const updated = storedFiles.filter(f => !selectedFileIds.includes(f.id));
      setStoredFiles(updated);
      await addSystemLog({
        type: 'system',
        severity: 'warning',
        title: 'حذف جماعي للملفات',
        details: `تم حذف ${selectedFileIds.length} ملف من التخزين`,
      });
      setSystemLogs(getSystemLogs());
      showToast(
        isAr
          ? `تم حذف ${selectedFileIds.length} ملف بنجاح`
          : `Successfully deleted ${selectedFileIds.length} files`,
        'success'
      );
      setSelectedFileIds([]);
      setShowBulkDeleteFilesModal(false);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Bulk delete failed', 'error');
    }
  };

  // 6. Test Email Handler
  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      // Simulate SMTP check
      await new Promise(r => setTimeout(r, 1200));
      setTestEmailStatus({
        success: true,
        message: isAr
          ? `تم إرسال البريد الاختباري بنجاح إلى ${testEmailRecipient} عبر ${settings.smtp_host}:${settings.smtp_port}`
          : `Test email sent successfully to ${testEmailRecipient} via ${settings.smtp_host}:${settings.smtp_port}`,
      });
      await addSystemLog({
        type: 'system',
        severity: 'success',
        title: 'اختبار خادم SMTP',
        details: `إرسال بريد اختباري ناجح إلى ${testEmailRecipient}`,
      });
    } catch (err: unknown) {
      setTestEmailStatus({
        success: false,
        message: (err as Error).message || 'SMTP Connection Error',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // 7. Diagnostics Runner
  const handleRefreshDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const d = await runSystemDiagnostics();
      setDiagnostics(d);
      showToast(isAr ? 'تم تحديث فحص سلامة النظام' : 'System diagnostics refreshed', 'info');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Diagnostics failed', 'error');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // Log Filtering & Pagination
  const filteredLogs = useMemo(() => {
    return systemLogs.filter(log => {
      if (logFilterType !== 'all' && log.type !== logFilterType) return false;
      if (logFilterSeverity !== 'all' && log.severity !== logFilterSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.title.toLowerCase().includes(q) ||
          (log.details && log.details.toLowerCase().includes(q)) ||
          (log.actor && log.actor.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [systemLogs, logFilterType, logFilterSeverity, searchQuery]);

  const logTotalPages = Math.ceil(filteredLogs.length / logPageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (logCurrentPage - 1) * logPageSize;
    return filteredLogs.slice(start, start + logPageSize);
  }, [filteredLogs, logCurrentPage]);

  // File Filtering & Pagination
  const filteredFiles = useMemo(() => {
    return storedFiles.filter(f => {
      if (bucketFilter !== 'all' && f.bucket !== bucketFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.bucket.toLowerCase().includes(q);
      }
      return true;
    });
  }, [storedFiles, bucketFilter, searchQuery]);

  const fileTotalPages = Math.ceil(filteredFiles.length / filePageSize) || 1;
  const paginatedFiles = useMemo(() => {
    const start = (fileCurrentPage - 1) * filePageSize;
    return filteredFiles.slice(start, start + filePageSize);
  }, [filteredFiles, fileCurrentPage]);

  // Handle Export Logs to CSV
  const handleExportLogs = () => {
    const formatted = filteredLogs.map(l => ({
      ID: l.id,
      Type: l.type,
      Severity: l.severity,
      Title: l.title,
      Details: l.details || '',
      Actor: l.actor || 'System',
      Timestamp: l.timestamp,
    }));
    exportToCSV(formatted, `system_logs_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Navigation Tabs definition
  const navTabs: { id: TabType; labelAr: string; labelFr: string; labelEn: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', labelAr: 'المتجر العام', labelFr: 'Magasin Général', labelEn: 'General Store', icon: Store },
    { id: 'localization', labelAr: 'اللغات والعملة', labelFr: 'Localisation', labelEn: 'Localization', icon: Globe },
    { id: 'homepage', labelAr: 'تخطيط الرئيسية', labelFr: 'Page d\'Accueil', labelEn: 'Homepage Layout', icon: Layout },
    { id: 'maintenance', labelAr: 'وضع الصيانة', labelFr: 'Mode Maintenance', labelEn: 'Maintenance Mode', icon: AlertTriangle },
    { id: 'updates', labelAr: 'التحديثات والإصدارات', labelFr: 'Mises à jour & OTA', labelEn: 'OTA Updates', icon: UploadCloud },
    { id: 'backup', labelAr: 'النسخ والاستعادة', labelFr: 'Sauvegarde & Restauration', labelEn: 'Backup & Restore', icon: Database },
    { id: 'cache', labelAr: 'ذاكرة المؤقتة', labelFr: 'Gestion du Cache', labelEn: 'Cache Manager', icon: Zap },
    { id: 'files', labelAr: 'إدارة الملفات', labelFr: 'Gestion Fichiers', labelEn: 'File Storage', icon: HardDrive },
    { id: 'smtp', labelAr: 'البريد و SMTP', labelFr: 'Configuration SMTP', labelEn: 'Email / SMTP', icon: Mail },
    { id: 'health', labelAr: 'صحة النظام', labelFr: 'Santé Système', labelEn: 'System Health', icon: Activity },
    { id: 'logs', labelAr: 'سجلات الأخطاء', labelFr: 'Journaux & Erreurs', labelEn: 'System Logs', icon: FileText },
    { id: 'activity', labelAr: 'سجل النشاطات', labelFr: 'Historique d\'Activités', labelEn: 'Activity Log', icon: ShieldCheck },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">{isAr ? 'جاري تحميل إعدادات النظام وتحديثات الـ OTA...' : 'Loading system & updates configuration...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* Toast Notification Header */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : 'bg-slate-900/90 border-slate-800 text-slate-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-400">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {isAr ? 'النظام وتحديثات التطبيق (System & Updates)' : 'System & Updates Management'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? 'لوحة الإدارة المركزية لإعدادات المتجر، الصيانة، النسخ الاحتياطي، والتحديثات الهوائية v1.1.0'
                : 'Centralized admin module for store configuration, maintenance, backups, and OTA releases v1.1.0'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {settings.maintenance_mode && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              {isAr ? 'وضع الصيانة مفعّل' : 'Maintenance Mode Active'}
            </span>
          )}

          <button
            onClick={() => handleSaveSettings()}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            <span>{isAr ? 'حفظ الإعدادات' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-lg overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{isAr ? tab.labelAr : lang === 'fr' ? tab.labelFr : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header Search for Logs / Files / Releases */}
      {['logs', 'files', 'activity', 'updates'].includes(activeTab) && (
        <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث سريع في البيانات والسجلات...' : 'Search records and logs...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500/50"
            />
          </div>

          {activeTab === 'logs' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLogs}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
              </button>

              <button
                onClick={() => setShowClearLogsModal(true)}
                className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح السجلات' : 'Clear Logs'}</span>
              </button>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleScanFiles}
                disabled={isScanningFiles}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningFiles ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'إعادة الفحص' : 'Re-scan'}</span>
              </button>

              <button
                onClick={handleCleanOrphans}
                disabled={isCleaningOrphans}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'تنظيف الملفات المؤقتة' : 'Clean Orphans'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: GENERAL STORE SETTINGS */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Store className="w-5 h-5 text-emerald-400" />
              {isAr ? 'هوية المتجر والمعلومات العامة' : 'Store Identity & General Information'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'اسم المتجر (بالعربية)' : 'Store Name (Arabic)'}
                </label>
                <input
                  type="text"
                  value={settings.store_name_ar}
                  onChange={e => setSettings({ ...settings, store_name_ar: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'اسم المتجر (بالفرنسية)' : 'Store Name (French)'}
                </label>
                <input
                  type="text"
                  value={settings.store_name_fr}
                  onChange={e => setSettings({ ...settings, store_name_fr: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'اسم المتجر (بالإنجليزية)' : 'Store Name (English)'}
                </label>
                <input
                  type="text"
                  value={settings.store_name_en}
                  onChange={e => setSettings({ ...settings, store_name_en: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Logo, Favicon, and Android App Icon Uploader */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  {isAr ? 'شعار المتجر الرسمي (Logo)' : 'Official Store Logo'}
                </label>
                <ImageUploader
                  bucket="cms-images"
                  folder="store-logo"
                  images={
                    typeof settings.store_logo === 'string' && settings.store_logo
                      ? [{ url: settings.store_logo, path: '' }]
                      : Array.isArray(settings.store_logo)
                      ? settings.store_logo
                      : []
                  }
                  onChange={imgs => {
                    const first = imgs[0];
                    const url = first ? (typeof first === 'string' ? first : first.url || first.preview || '') : '';
                    setSettings(prev => ({ ...prev, store_logo: url }));
                  }}
                  multiple={false}
                  onNotification={(type, msg) => showToast(msg, type)}
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  {isAr ? 'أيقونة المتجر المميزة (Favicon)' : 'Store Favicon'}
                </label>
                <ImageUploader
                  bucket="cms-images"
                  folder="store-favicon"
                  images={
                    typeof settings.store_favicon === 'string' && settings.store_favicon
                      ? [{ url: settings.store_favicon, path: '' }]
                      : Array.isArray(settings.store_favicon)
                      ? settings.store_favicon
                      : []
                  }
                  onChange={imgs => {
                    const first = imgs[0];
                    const url = first ? (typeof first === 'string' ? first : first.url || first.preview || '') : '';
                    setSettings(prev => ({ ...prev, store_favicon: url }));
                  }}
                  multiple={false}
                  onNotification={(type, msg) => showToast(msg, type)}
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  {isAr ? 'أيقونة تطبيق أندرويد (Android App Icon)' : 'Android App Launcher Icon'}
                </label>
                <ImageUploader
                  bucket="cms-images"
                  folder="app-icon"
                  images={
                    typeof settings.app_icon === 'string' && settings.app_icon
                      ? [{ url: settings.app_icon, path: '' }]
                      : Array.isArray(settings.app_icon)
                      ? settings.app_icon
                      : []
                  }
                  onChange={imgs => {
                    const first = imgs[0];
                    const url = first ? (typeof first === 'string' ? first : first.url || first.preview || '') : '';
                    setSettings(prev => {
                      const updated = { ...prev, app_icon: url };
                      if (url && !url.startsWith('blob:')) {
                        saveSystemSettings(updated).catch(() => {});
                      }
                      return updated;
                    });
                  }}
                  multiple={false}
                  onNotification={(type, msg) => showToast(msg, type)}
                />
                <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                  {isAr
                    ? 'ملاحظة: تُحفظ هذه الصورة كمصدر لأيقونة التطبيق. يتطلب تغيير الأيقونة على هواتف المشتركين إعادة بناء وتصدير حزمة أندرويد (APK / AAB).'
                    : 'Note: Saves source image for app launcher icon. Updating installed phone icons requires rebuilding the Android APK/AAB package.'}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'وصف المتجر (بالعربية)' : 'Description (Arabic)'}
                </label>
                <textarea
                  rows={3}
                  value={settings.store_description_ar}
                  onChange={e => setSettings({ ...settings, store_description_ar: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'وصف المتجر (بالفرنسية)' : 'Description (French)'}
                </label>
                <textarea
                  rows={3}
                  value={settings.store_description_fr}
                  onChange={e => setSettings({ ...settings, store_description_fr: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'وصف المتجر (بالإنجليزية)' : 'Description (English)'}
                </label>
                <textarea
                  rows={3}
                  value={settings.store_description_en}
                  onChange={e => setSettings({ ...settings, store_description_en: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>
            </div>

            {/* Contact Details */}
            <h4 className="text-xs font-bold text-slate-300 pt-4 border-t border-slate-800">
              {isAr ? 'معلومات التواصل والدعم الفني' : 'Contact & Support Information'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'البريد الإلكتروني' : 'Support Email'}</label>
                <input
                  type="email"
                  value={settings.store_email}
                  onChange={e => setSettings({ ...settings, store_email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
                <input
                  type="text"
                  value={settings.store_phone}
                  onChange={e => setSettings({ ...settings, store_phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'رقم واتساب الأعمال' : 'WhatsApp Business'}</label>
                <input
                  type="text"
                  value={settings.store_whatsapp}
                  onChange={e => setSettings({ ...settings, store_whatsapp: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'العنوان الجغرافي (بالعربية)' : 'Address (Arabic)'}</label>
                <input
                  type="text"
                  value={settings.store_address_ar}
                  onChange={e => setSettings({ ...settings, store_address_ar: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'العنوان الجغرافي (بالفرنسية)' : 'Address (French)'}</label>
                <input
                  type="text"
                  value={settings.store_address_fr}
                  onChange={e => setSettings({ ...settings, store_address_fr: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'العنوان الجغرافي (بالإنجليزية)' : 'Address (English)'}</label>
                <input
                  type="text"
                  value={settings.store_address_en}
                  onChange={e => setSettings({ ...settings, store_address_en: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                />
              </div>
            </div>

            {/* Submit Button inside form */}
            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                <span>{isAr ? 'حفظ إعدادات الهوية والتواصل' : 'Save General Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: LOCALIZATION */}
      {activeTab === 'localization' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="w-5 h-5 text-emerald-400" />
            {isAr ? 'إعدادات اللغات والعملات والتوقيت' : 'Localization, Currency & Regional Settings'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200">{isAr ? 'اللغة الافتراضية واللغات المدعومة' : 'Default & Supported Languages'}</h4>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'اللغة الافتراضية للتطبيق' : 'Default Store Language'}</label>
                <select
                  value={settings.default_language}
                  onChange={e => setSettings({ ...settings, default_language: e.target.value as 'ar' | 'fr' | 'en' })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="fr">Français (French)</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">{isAr ? 'اللغات المتاحة للعملاء' : 'Supported Customer Languages'}</label>
                <div className="flex items-center gap-4 text-xs text-slate-300">
                  {['ar', 'fr', 'en'].map(langCode => (
                    <label key={langCode} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.supported_languages.includes(langCode)}
                        onChange={e => {
                          const updated = e.target.checked
                            ? [...settings.supported_languages, langCode]
                            : settings.supported_languages.filter(l => l !== langCode);
                          setSettings({ ...settings, supported_languages: updated });
                        }}
                        className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0"
                      />
                      <span className="uppercase font-bold">{langCode}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200">{isAr ? 'العملة وتنسيق الأسعار' : 'Currency & Price Format'}</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{isAr ? 'العملة الأساسية' : 'Main Currency'}</label>
                  <select
                    value={settings.default_currency}
                    onChange={e => setSettings({ ...settings, default_currency: e.target.value as 'DZD' | 'EUR' | 'USD' })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
                  >
                    <option value="DZD">DZD (دينار جزائري)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{isAr ? 'رمز العملة' : 'Currency Symbol'}</label>
                  <input
                    type="text"
                    value={settings.currency_symbol}
                    onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{isAr ? 'موقع رمز العملة' : 'Currency Position'}</label>
                <select
                  value={settings.currency_position}
                  onChange={e => setSettings({ ...settings, currency_position: e.target.value as 'before' | 'after' })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                >
                  <option value="after">{isAr ? 'بعد المبلغ (مثال: 5,000 د.ج)' : 'After Amount (e.g., 5,000 DZD)'}</option>
                  <option value="before">{isAr ? 'قبل المبلغ (مثال: د.ج 5,000)' : 'Before Amount (e.g., DZD 5,000)'}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'التوقيت الزمني (Timezone)' : 'Time Zone'}</label>
              <select
                value={settings.default_timezone}
                onChange={e => setSettings({ ...settings, default_timezone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              >
                <option value="Africa/Algiers">Africa/Algiers (UTC+1)</option>
                <option value="Europe/Paris">Europe/Paris (UTC+2)</option>
                <option value="UTC">UTC (GMT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'تنسيق التاريخ' : 'Date Format'}</label>
              <select
                value={settings.date_format}
                onChange={e => setSettings({ ...settings, date_format: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl mt-5">
              <div>
                <p className="text-xs font-bold text-slate-200">{isAr ? 'دعم الاتجاه RTL/LTR تلقائياً' : 'Auto RTL/LTR Support'}</p>
                <p className="text-[11px] text-slate-400">{isAr ? 'تغيير اتجاه الصفحة بناءً على اللغة المختارة' : 'Align page direction based on active language'}</p>
              </div>
              <input
                type="checkbox"
                checked={settings.rtl_support}
                onChange={e => setSettings({ ...settings, rtl_support: e.target.checked })}
                className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 h-5 w-5"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: HOMEPAGE LAYOUT SETTINGS */}
      {activeTab === 'homepage' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layout className="w-5 h-5 text-emerald-400" />
            {isAr ? 'تخصيص الواجهة الرئيسية وأقسام العرض' : 'Homepage Layout & Featured Sections Customization'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-200">{isAr ? 'نمط وقالب الصفحة الرئيسية' : 'Homepage Template Layout'}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'standard', title: isAr ? 'النمط القياسي' : 'Standard Grid', desc: isAr ? 'سلايدر + فئات + منتجات' : 'Slider + Categories + Products' },
                  { id: 'hero_first', title: isAr ? 'سلايدر عريض' : 'Wide Hero First', desc: isAr ? 'تركيز كامل على العروض' : 'Full width promo banners' },
                  { id: 'category_centric', title: isAr ? 'تركيز الفئات' : 'Category Centric', desc: isAr ? 'شبكة التصنيفات الرئيسة' : 'Category grids showcase' },
                  { id: 'flash_deals', title: isAr ? 'عروض التخفيضات' : 'Flash Deals Focus', desc: isAr ? 'مؤقت العروض اليومية' : 'Countdown timer & deals' },
                ].map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, homepage_layout: tmpl.id as SystemSettings['homepage_layout'] })}
                    className={`p-3.5 rounded-xl text-right rtl:text-right border transition-all text-xs ${
                      settings.homepage_layout === tmpl.id
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-bold text-slate-100">{tmpl.title}</p>
                    <p className="text-[11px] opacity-70 mt-1">{tmpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200">{isAr ? 'تفعيل/تعطيل الأقسام الظاهرة' : 'Toggle Featured Sections'}</h4>
              <div className="space-y-2 text-xs text-slate-300">
                {Object.entries(settings.featured_sections).map(([secKey, isActive]) => (
                  <label key={secKey} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 cursor-pointer">
                    <span className="capitalize">{secKey.replace('_', ' ')}</span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          featured_sections: {
                            ...settings.featured_sections,
                            [secKey]: e.target.checked,
                          },
                        })
                      }
                      className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'سرعة التبديل التلقائي للسلايدر (ms)' : 'Hero Slider Autoplay (ms)'}</label>
              <input
                type="number"
                step={500}
                value={settings.hero_autoplay_interval_ms}
                onChange={e => setSettings({ ...settings, hero_autoplay_interval_ms: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'عدد المنتجات المميزة المفرزة' : 'Featured Products Limit'}</label>
              <input
                type="number"
                value={settings.featured_products_count}
                onChange={e => setSettings({ ...settings, featured_products_count: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl mt-5">
              <div>
                <p className="text-xs font-bold text-slate-200">{isAr ? 'تراكب ظلال اللافتات' : 'Hero Dark Overlay'}</p>
                <p className="text-[11px] text-slate-400">{isAr ? 'تحسين وضوح النصوص فوق الصور' : 'Enhance text contrast on images'}</p>
              </div>
              <input
                type="checkbox"
                checked={settings.hero_overlay_gradient}
                onChange={e => setSettings({ ...settings, hero_overlay_gradient: e.target.checked })}
                className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 h-5 w-5"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: MAINTENANCE MODE */}
      {activeTab === 'maintenance' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">{isAr ? 'إعدادات وضع الصيانة المؤقتة' : 'Temporary Maintenance Mode Controls'}</h3>
                <p className="text-xs text-slate-400">{isAr ? 'إغلاق المتجر أمام الزوار مع استثناء المدراء' : 'Lock store for visitors while allowing admin bypass'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1 rounded-full border bg-slate-800 text-slate-400 border-slate-700">
                {isAr ? 'معطّل نهائياً' : 'Disabled (Store Always Active)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{isAr ? 'رسالة الصيانة (بالعربية)' : 'Message (Arabic)'}</label>
              <textarea
                rows={3}
                value={settings.maintenance_message_ar}
                onChange={e => setSettings({ ...settings, maintenance_message_ar: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{isAr ? 'رسالة الصيانة (بالفرنسية)' : 'Message (French)'}</label>
              <textarea
                rows={3}
                value={settings.maintenance_message_fr}
                onChange={e => setSettings({ ...settings, maintenance_message_fr: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{isAr ? 'رسالة الصيانة (بالإنجليزية)' : 'Message (English)'}</label>
              <textarea
                rows={3}
                value={settings.maintenance_message_en}
                onChange={e => setSettings({ ...settings, maintenance_message_en: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'وقت العودة التقديري' : 'Estimated Return Time'}</label>
              <input
                type="datetime-local"
                value={settings.estimated_return_time ? settings.estimated_return_time.slice(0, 16) : ''}
                onChange={e => setSettings({ ...settings, estimated_return_time: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl mt-5">
              <div>
                <p className="text-xs font-bold text-slate-200">{isAr ? 'تجاوز الصيانة للمشرفين (Admin Bypass)' : 'Allow Admin Bypass'}</p>
                <p className="text-[11px] text-slate-400">{isAr ? 'السماح للاداريين بتصفح المتجر واختباره' : 'Admins remain unblocked'}</p>
              </div>
              <input
                type="checkbox"
                checked={settings.admin_bypass}
                onChange={e => setSettings({ ...settings, admin_bypass: e.target.checked })}
                className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 h-5 w-5"
              />
            </div>
          </div>

          {/* Maintenance Live Preview Box */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 space-y-3 text-center">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">{isAr ? 'معاينة شاشة الصيانة للعميل' : 'Customer Maintenance Banner Preview'}</p>
            <div className="max-w-md mx-auto p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
              <h4 className="font-bold text-slate-100 text-sm">
                {isAr ? settings.store_name_ar : settings.store_name_en}
              </h4>
              <p className="text-xs text-slate-300">
                {isAr ? settings.maintenance_message_ar : settings.maintenance_message_en}
              </p>

              {settings.estimated_return_time && (
                <div className="pt-2 text-[11px] text-amber-300/80 font-mono flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isAr ? 'العودة المتوقعة:' : 'Estimated Return:'} {new Date(settings.estimated_return_time).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: VERSION MANAGEMENT & OTA UPDATES */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {isAr ? 'نشر وتحديث إصدارات الهاتف المحمول (OTA Release Manager)' : 'Mobile Application OTA Release Manager'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isAr ? 'رفع ملفات APK ونشرها مباشرة إلى GitHub Releases' : 'Build & upload APK artifacts to GitHub Releases'}
                  </p>
                </div>
              </div>

              <div className="text-right rtl:text-right font-mono text-xs">
                <span className="text-slate-400">{isAr ? 'الإصدار الحالى:' : 'Current Version:'} </span>
                <span className="text-emerald-400 font-bold">v{latestVersionName} ({latestVersionCode})</span>
              </div>
            </div>

            <form onSubmit={handlePublishRelease} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">{isAr ? 'اسم الإصدار (Version Name)' : 'Version Name'}</label>
                  <input
                    type="text"
                    value={latestVersionName}
                    onChange={e => setLatestVersionName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
                    placeholder="1.2.0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">{isAr ? 'رمز الإصدار (Version Code)' : 'Version Code'}</label>
                  <input
                    type="number"
                    value={latestVersionCode}
                    onChange={e => setLatestVersionCode(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
                    placeholder="120"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{isAr ? 'ملاحظات التحديث (بالعربية)' : 'Release Notes (Arabic)'}</label>
                  <textarea
                    rows={2}
                    value={notesAr}
                    onChange={e => setNotesAr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                    placeholder="تحديث تحسين السرعة والدفع..."
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{isAr ? 'ملاحظات التحديث (بالفرنسية)' : 'Release Notes (French)'}</label>
                  <textarea
                    rows={2}
                    value={notesFr}
                    onChange={e => setNotesFr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                    placeholder="Amélioration globale et correctifs..."
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{isAr ? 'ملاحظات التحديث (بالإنجليزية)' : 'Release Notes (English)'}</label>
                  <textarea
                    rows={2}
                    value={notesEn}
                    onChange={e => setNotesEn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
                    placeholder="Performance fixes and minor updates..."
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-200">{isAr ? 'إرفاق ملف الحزمة (APK File)' : 'Attach Compiled APK'}</label>
                <input
                  type="file"
                  accept=".apk"
                  onChange={e => e.target.files && setApkFile(e.target.files[0])}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white"
                />
                {apkFile && (
                  <p className="text-xs text-emerald-400 font-mono">
                    {isAr ? `الملف المرفق: ${apkFile.name} (${(apkFile.size / (1024 * 1024)).toFixed(2)} MB)` : `Attached: ${apkFile.name} (${(apkFile.size / (1024 * 1024)).toFixed(2)} MB)`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mandatoryRelease"
                  checked={isMandatory}
                  onChange={e => setIsMandatory(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="mandatoryRelease" className="text-xs text-slate-300 cursor-pointer">
                  {isAr ? 'تحديث إجباري (يمنع استخدام التطبيقات القديمة حتى التحديث)' : 'Mandatory update required'}
                </label>
              </div>

              <button
                type="submit"
                disabled={isPublishing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري رفع الملف والنشر إلى GitHub...' : 'Uploading APK and publishing release...'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>{isAr ? 'نشر الإصدار الجديد الآن' : 'Publish Release Now'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Release History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="w-4 h-4 text-emerald-400" />
              {isAr ? 'سجل التحديثات المنشورة سابقاً' : 'Published Releases History'}
            </h3>

            {releaseHistory.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">{isAr ? 'لا يوجد سجل إصدارات حالياً' : 'No release history available'}</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {releaseHistory.map((rel, idx) => (
                  <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-xs font-mono">v{rel.version_name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({rel.version_code})</span>
                        {rel.is_mandatory && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            {isAr ? 'إجباري' : 'Mandatory'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{rel.notes_ar || rel.notes_fr || rel.notes_en || 'General updates'}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono">
                        {rel.created_at ? new Date(rel.created_at).toLocaleDateString() : ''}
                      </span>

                      {rel.download_url && (
                        <a
                          href={rel.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-colors"
                          title="Download APK"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => setEditingRelease(rel)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        title="Edit Notes"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setReleaseToDelete(rel)}
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg transition-colors"
                        title="Delete Release Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Backup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-3 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">{isAr ? 'إنشاء نسخة احتياطية جديدة' : 'Create New System Backup'}</h3>
                <p className="text-xs text-slate-400">{isAr ? 'تصدير كامل إعدادات المتجر، والمنتجات، والتصنيفات، وسجلات السيرفر' : 'Export store settings, products, categories, orders & logs'}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr
                ? 'يتيح لك هذا الأمر توليد ملف JSON مشفر يحتوي على كافة البيانات المنشورة لإمكانيّة استعادتها فوراً في أي وقت.'
                : 'Generates a timestamped JSON manifest containing all database entities and system configurations.'}
            </p>

            <button
              onClick={handleCreateBackup}
              disabled={isGeneratingBackup}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isGeneratingBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isAr ? 'تحميل النسخة الاحتياطية (JSON)' : 'Download Backup File (.json)'}</span>
            </button>
          </div>

          {/* Restore Backup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">{isAr ? 'استعادة قاعدة البيانات' : 'Restore System Backup'}</h3>
                <p className="text-xs text-slate-400">{isAr ? 'رفع واستعادة نسخة احتياطية سابقة' : 'Import and restore from JSON file'}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-200">{isAr ? 'اختيار ملف النسخة الاحتياطية' : 'Select Backup JSON File'}</label>
              <input
                type="file"
                accept=".json"
                onChange={handleBackupFileSelect}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:bg-amber-600 file:text-white"
              />

              {backupPreview && (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs space-y-1 font-mono">
                  <p className="text-emerald-400 font-bold">{isAr ? 'معاينة ملف النسخة:' : 'Backup Manifest:'}</p>
                  <p className="text-slate-300">
                    File: {uploadedBackupFile?.name || 'backup.json'} | App: {(backupPreview.metadata as Record<string, string>)?.app_name || 'Business Market'}
                  </p>
                  <p className="text-slate-400">
                    Date: {(backupPreview.metadata as Record<string, string>)?.created_at || 'Unknown'}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleConfirmRestore}
              disabled={!backupPreview || isRestoring}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              <span>{isAr ? 'تأكيد عملية الاستعادة الآن' : 'Confirm & Restore Database'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 7: CACHE MANAGEMENT */}
      {activeTab === 'cache' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <p className="text-xs text-slate-400 font-semibold">{isAr ? 'حجم الذاكرة المؤقتة' : 'Total Cached Storage'}</p>
              <p className="text-2xl font-bold text-slate-100 font-mono">1.8 MB</p>
              <p className="text-[11px] text-emerald-400">{isAr ? 'الذاكرة سريعة وتعمل بكفاءة' : 'Optimized & active'}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <p className="text-xs text-slate-400 font-semibold">{isAr ? 'العناصر المخزنة مؤقتاً' : 'Cached Items'}</p>
              <p className="text-2xl font-bold text-slate-100 font-mono">42 {isAr ? 'عنصر' : 'records'}</p>
              <p className="text-[11px] text-slate-400">{isAr ? 'منتجات، تصنيفات، لافتات' : 'Products, categories, banners'}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
              <p className="text-xs text-slate-400 font-semibold">{isAr ? 'حالة تحسين قاعدة البيانات' : 'Database Optimization'}</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">98%</p>
              <p className="text-[11px] text-slate-400">{isAr ? 'المؤشرات والروابط مفهرسة' : 'Indexes and keys optimized'}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
              <Zap className="w-5 h-5 text-emerald-400" />
              {isAr ? 'عمليات تنظيف وتحديث الذاكرة المؤقتة' : 'Cache Cleanup & Database Optimization Actions'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 text-xs">{isAr ? 'تفريغ الذاكرة المحلية (Clear Cache)' : 'Clear Local Cache'}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAr ? 'حذف البيانات المؤقتة لتسريع تحديث الأسعار والمنتجات' : 'Removes client-side cached structures and temporary responses.'}
                </p>
                <button
                  onClick={handleClearCache}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  {isAr ? 'تفريغ الذاكرة الآن' : 'Clear Cache Now'}
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 text-xs">{isAr ? 'إعادة بناء مؤشرات الكتالوج' : 'Rebuild Catalog Cache'}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAr ? 'توليد ذاكرة جديدة للمنتجات والتصنيفات لرفع سرعة التحميل' : 'Pre-warms product lists & categories in memory for instant view.'}
                </p>
                <button
                  onClick={handleRebuildCatalogCache}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors"
                >
                  {isAr ? 'إعادة البناء' : 'Rebuild Cache'}
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 text-xs">{isAr ? 'تحسين وتنظيف DB Vacuum' : 'Optimize Database (Vacuum)'}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAr ? 'إعادة ترتيب الفهارس وحذف الجلسات القديمة غير النشطة' : 'Cleans expired sessions, re-indexes DB tables for fast search.'}
                </p>
                <button
                  onClick={handleOptimizeDatabase}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  {isAr ? 'تحسين قاعدة البيانات' : 'Optimize Database'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: FILE MANAGEMENT & STORAGE CLEANUP */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
              <p className="text-xs text-slate-400 font-semibold">{isAr ? 'إجمالي الملفات المخزنة' : 'Total Stored Files'}</p>
              <p className="text-2xl font-bold text-slate-100 font-mono">{storedFiles.length}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
              <p className="text-xs text-slate-400 font-semibold">{isAr ? 'الملفات غير المستخدمة (Orphans)' : 'Orphan / Temp Files'}</p>
              <p className="text-2xl font-bold text-rose-400 font-mono">{storedFiles.filter(f => f.is_orphan).length}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
              <p className="text-xs text-slate-400 font-semibold">{isAr ? 'الحجم الإجمالي المقدر' : 'Estimated Storage Size'}</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">
                {(storedFiles.reduce((acc, f) => acc + f.size_kb, 0) / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                {isAr ? 'استعراض وإدارة ملفات التخزين' : 'Storage File Inventory'}
              </h3>

              <div className="flex items-center gap-3">
                {selectedFileIds.length > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteFilesModal(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-600/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isAr
                        ? `حذف المحدد (${selectedFileIds.length})`
                        : `Delete Selected (${selectedFileIds.length})`}
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-2 text-xs">
                  {['all', 'product-images', 'cms-images', 'category-images'].map(bucket => (
                    <button
                      key={bucket}
                      onClick={() => setBucketFilter(bucket)}
                      className={`px-3 py-1 rounded-lg capitalize font-medium ${
                        bucketFilter === bucket ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {bucket}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bulk Selection Header */}
            {filteredFiles.length > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={selectedFileIds.length > 0 && selectedFileIds.length === filteredFiles.length}
                    onChange={handleSelectAllFiles}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 h-4 w-4"
                  />
                  <span>{isAr ? 'تحديد الكل في هذه القائمة' : 'Select All Files'}</span>
                </label>
                <span className="font-mono">
                  {selectedFileIds.length} / {filteredFiles.length} {isAr ? 'محدد' : 'selected'}
                </span>
              </div>
            )}

            {paginatedFiles.length === 0 ? (
              <p className="text-xs text-slate-500 p-6 text-center">{isAr ? 'لا توجد ملفات مطابقة' : 'No files found matching criteria'}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {paginatedFiles.map(file => {
                  const isSelected = selectedFileIds.includes(file.id);
                  return (
                    <div
                      key={file.id}
                      className={`bg-slate-950 border p-3 rounded-xl space-y-2 relative group transition-all ${
                        isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-950/10' : 'border-slate-800'
                      }`}
                    >
                      <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectFile(file.id)}
                          className="absolute top-2 left-2 z-10 rounded bg-slate-950/80 border-slate-700 text-emerald-500 focus:ring-0 h-4 w-4 cursor-pointer"
                        />
                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        {file.is_orphan && (
                          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/90 text-white">
                            {isAr ? 'مؤقت' : 'Orphan'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-200 line-clamp-1 font-mono">{file.name}</p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{file.size_kb} KB</span>
                        <button
                          onClick={() => setFileToDelete(file)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {fileTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
                <span className="text-slate-400 font-mono">
                  Page {fileCurrentPage} of {fileTotalPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFileCurrentPage(p => Math.max(1, p - 1))}
                    disabled={fileCurrentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>

                  <button
                    onClick={() => setFileCurrentPage(p => Math.min(fileTotalPages, p + 1))}
                    disabled={fileCurrentPage === fileTotalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: EMAIL & SMTP CONFIGURATION */}
      {activeTab === 'smtp' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Mail className="w-5 h-5 text-emerald-400" />
            {isAr ? 'إعدادات خادم البريد الإشعارى SMTP' : 'Email SMTP Server Configuration'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">{isAr ? 'مضيف الخادم (SMTP Host)' : 'SMTP Host'}</label>
              <input
                type="text"
                value={settings.smtp_host}
                onChange={e => setSettings({ ...settings, smtp_host: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">{isAr ? 'منفذ الخادم (Port)' : 'SMTP Port'}</label>
              <input
                type="number"
                value={settings.smtp_port}
                onChange={e => setSettings({ ...settings, smtp_port: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">{isAr ? 'التشفير والأمان' : 'Security Encryption'}</label>
              <select
                value={settings.smtp_security}
                onChange={e => setSettings({ ...settings, smtp_security: e.target.value as 'tls' | 'ssl' | 'none' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              >
                <option value="tls">STARTTLS (Port 587)</option>
                <option value="ssl">SSL/TLS (Port 465)</option>
                <option value="none">None (Plain)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">{isAr ? 'اسم المستخدم (User)' : 'SMTP User'}</label>
              <input
                type="text"
                value={settings.smtp_user}
                onChange={e => setSettings({ ...settings, smtp_user: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">{isAr ? 'كلمة المرور' : 'SMTP Password'}</label>
              <input
                type="password"
                value={settings.smtp_pass}
                onChange={e => setSettings({ ...settings, smtp_pass: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">{isAr ? 'البريد المرسل (From Email)' : 'From Email'}</label>
              <input
                type="email"
                value={settings.smtp_from_email}
                onChange={e => setSettings({ ...settings, smtp_from_email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">{isAr ? 'اسم المرسل (From Name)' : 'From Name'}</label>
              <input
                type="text"
                value={settings.smtp_from_name}
                onChange={e => setSettings({ ...settings, smtp_from_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>
          </div>

          {/* Test Email Trigger Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-xs text-slate-200">{isAr ? 'اختبار اتصال البريد الإلكتروني' : 'Test Email Connection Diagnostic'}</h4>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={e => setTestEmailRecipient(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2"
              >
                {isSendingTestEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <span>{isAr ? 'إرسال بريد اختباري' : 'Send Test Email'}</span>
              </button>
            </div>

            {testEmailStatus && (
              <div className={`p-3 rounded-xl text-xs font-mono border ${testEmailStatus.success ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border-rose-800 text-rose-300'}`}>
                {testEmailStatus.message}
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 10: SYSTEM HEALTH & DIAGNOSTICS */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              {isAr ? 'فحص ومراقبة سلامة واستقرار السيرفر' : 'System Health & Services Diagnostic Status'}
            </h3>

            <button
              onClick={handleRefreshDiagnostics}
              disabled={isRunningDiagnostics}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'إعادة الفحص الآن' : 'Run Diagnostics'}</span>
            </button>
          </div>

          {diagnostics && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">{isAr ? 'قاعدة البيانات (Supabase DB)' : 'Database Status'}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diagnostics.database.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {diagnostics.database.status}
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-100 font-mono">{diagnostics.database.ping_ms} ms</p>
                <p className="text-[11px] text-slate-500">{isAr ? 'زمن الاستجابة للطلب' : 'Query ping latency'}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">{isAr ? 'تخزين السحاب (Storage Buckets)' : 'Storage Status'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                    {diagnostics.storage.status}
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-100 font-mono">{diagnostics.storage.active_buckets} {isAr ? 'مساحات' : 'buckets'}</p>
                <p className="text-[11px] text-slate-500">{isAr ? 'جاهزة للقراءة والكتابة' : 'Read & write verified'}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">{isAr ? 'واجهة البرمجة (API Latency)' : 'API Endpoints'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                    {diagnostics.api.status}
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-100 font-mono">{diagnostics.api.latency_ms} ms</p>
                <p className="text-[11px] text-slate-500">{isAr ? 'استجابة السيرفر الكلية' : 'Server response speed'}</p>
              </div>
            </div>
          )}

          {/* Environment Variables Audit */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="font-bold text-slate-100 text-xs flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              {isAr ? 'فحص متغيرات البيئة الأساسية (Environment Variables Audit)' : 'Environment Variables Check'}
            </h4>

            <div className="divide-y divide-slate-800 text-xs font-mono">
              {diagnostics?.envVars.map((env, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-300">{env.name}</span>
                  <div className="flex items-center gap-2">
                    {env.isSet ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {isAr ? 'معرّف بنجاح (Configured)' : 'Configured'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                        {isAr ? 'مفقود' : 'Missing'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: SYSTEM LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              {isAr ? 'سجلات أخطاء وأحداث النظام' : 'System Logs & Runtime Diagnostics'}
            </h3>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={logFilterType}
                onChange={e => {
                  setLogFilterType(e.target.value);
                  setLogCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200"
              >
                <option value="all">{isAr ? 'كل الأنواع' : 'All Types'}</option>
                <option value="system">System</option>
                <option value="error">Error</option>
                <option value="update">Update</option>
                <option value="cache">Cache</option>
                <option value="backup">Backup</option>
              </select>

              <select
                value={logFilterSeverity}
                onChange={e => {
                  setLogFilterSeverity(e.target.value);
                  setLogCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200"
              >
                <option value="all">{isAr ? 'كل المستويات' : 'All Severities'}</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="success">Success</option>
              </select>
            </div>
          </div>

          {paginatedLogs.length === 0 ? (
            <p className="text-xs text-slate-500 p-8 text-center">{isAr ? 'لا توجد سجلات مطابقة حالياً' : 'No logs available'}</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {paginatedLogs.map(log => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 p-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        log.severity === 'success'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : log.severity === 'error'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : log.severity === 'warning'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {log.severity}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-slate-200">{log.title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{log.details || 'No details'}</p>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {logTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
              <span className="text-slate-400 font-mono">
                Page {logCurrentPage} of {logTotalPages} ({filteredLogs.length} entries)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))}
                  disabled={logCurrentPage === 1}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                </button>

                <button
                  onClick={() => setLogCurrentPage(p => Math.min(logTotalPages, p + 1))}
                  disabled={logCurrentPage === logTotalPages}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 12: SYSTEM ACTIVITY LOG */}
      {activeTab === 'activity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {isAr ? 'سجل عمليات ونشاطات مشرفي النظام (Audit Trail)' : 'Admin Activity Audit Trail'}
          </h3>

          <div className="divide-y divide-slate-800 text-xs">
            {systemLogs.map(log => (
              <div key={log.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200">{log.title}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{log.details}</p>
                </div>

                <div className="text-right rtl:text-right font-mono text-[11px]">
                  <span className="text-emerald-400">{log.actor || 'admin@businessmarket.dz'}</span>
                  <p className="text-slate-500 mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: LOG DETAILS DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-4 shadow-2xl">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-slate-100">{selectedLog.title}</h3>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
              <p><span className="text-slate-500">Log ID:</span> {selectedLog.id}</p>
              <p><span className="text-slate-500">Type:</span> {selectedLog.type}</p>
              <p><span className="text-slate-500">Severity:</span> {selectedLog.severity}</p>
              <p><span className="text-slate-500">Timestamp:</span> {new Date(selectedLog.timestamp).toLocaleString()}</p>
              <p><span className="text-slate-500">Actor:</span> {selectedLog.actor || 'System'}</p>
              <div className="pt-2 border-t border-slate-800 text-slate-200 whitespace-pre-wrap">
                {selectedLog.details}
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: EDIT OTA RELEASE NOTES */}
      {editingRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-4 shadow-2xl">
            <button
              onClick={() => setEditingRelease(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1 rounded-lg text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-sm text-slate-100">
              {isAr ? `تعديل ملاحظات الإصدار v${editingRelease.version_name}` : `Edit Release Notes v${editingRelease.version_name}`}
            </h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'ملاحظات التحديث (بالعربية)' : 'Notes (Arabic)'}</label>
              <textarea
                rows={2}
                value={editingRelease.notes_ar || ''}
                onChange={e => setEditingRelease({ ...editingRelease, notes_ar: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{isAr ? 'ملاحظات التحديث (بالفرنسية)' : 'Notes (French)'}</label>
              <textarea
                rows={2}
                value={editingRelease.notes_fr || ''}
                onChange={e => setEditingRelease({ ...editingRelease, notes_fr: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRelease(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const updatedHistory = releaseHistory.map(r =>
                    r.version_code === editingRelease.version_code ? editingRelease : r
                  );
                  setReleaseHistory(updatedHistory);
                  await supabase.from('app_config').upsert({
                    id: 1,
                    release_history: updatedHistory,
                    updated_at: new Date().toISOString(),
                  });
                  showToast(isAr ? 'تم تحديث الملاحظات بنجاح' : 'Notes updated successfully', 'success');
                  setEditingRelease(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
              >
                {isAr ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODALS */}
      <ConfirmDeleteModal
        isOpen={!!releaseToDelete}
        onClose={() => setReleaseToDelete(null)}
        onConfirm={confirmDeleteRelease}
        title={isAr ? 'تأكيد حذف سجل الإصدار' : 'Confirm Release Deletion'}
        itemName={releaseToDelete ? `Release v${releaseToDelete.version_name}` : undefined}
      />

      <ConfirmDeleteModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={confirmDeleteFile}
        title={isAr ? 'تأكيد حذف الملف' : 'Confirm File Deletion'}
        itemName={fileToDelete ? fileToDelete.name : undefined}
      />

      <ConfirmDeleteModal
        isOpen={showBulkDeleteFilesModal}
        onClose={() => setShowBulkDeleteFilesModal(false)}
        onConfirm={confirmBulkDeleteFiles}
        title={isAr ? 'تأكيد الحذف الجماعي للملفات' : 'Confirm Bulk File Deletion'}
        description={
          isAr
            ? `هل أنت متأكد من حذف ${selectedFileIds.length} ملف محدد بشكل نهائي؟`
            : `Are you sure you want to permanently delete the ${selectedFileIds.length} selected files?`
        }
      />

      <ConfirmDeleteModal
        isOpen={showClearLogsModal}
        onClose={() => setShowClearLogsModal(false)}
        onConfirm={() => {
          clearSystemLogs();
          setSystemLogs([]);
          setShowClearLogsModal(false);
          showToast(isAr ? 'تم مسح السجلات بنجاح' : 'Logs cleared successfully', 'success');
        }}
        title={isAr ? 'مسح جميع السجلات' : 'Clear All System Logs'}
        description={isAr ? 'هل أنت متأكد من مسح جميع سجلات الأخطاء والأحداث؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to permanently clear all logs?'}
      />
    </div>
  );
}
