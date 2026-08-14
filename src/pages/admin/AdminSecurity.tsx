import { useState, useEffect, useMemo } from 'react';
import {
  Shield, ShieldCheck, Lock, Key, AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, Smartphone, UserX, UserCheck, Search, Filter,
  ChevronLeft, ChevronRight, Copy, Check, Zap, Activity, Ban, Sliders,
  ShieldAlert, Cpu, HardDrive
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  SecurityConfig,
  AdminActiveSession,
  FailedLoginAttempt,
  SecurityEventLog,
  ApiRequestLog,
  BackupVerificationResult,
  getSecurityConfig,
  saveSecurityConfig,
  fetchActiveSessions,
  revokeActiveSession,
  logoutFromAllOtherDevices,
  fetchFailedLoginAttempts,
  toggleIpBlock,
  fetchBannedIps,
  updateBannedIps,
  fetchSecurityEvents,
  logSecurityEvent,
  generateApiLogs,
  performBackupVerification,
  generate2FARecoveryCodes,
} from '../../lib/security';
import { fetchAdminRoles, ALL_PERMISSIONS, AdminRole } from '../../lib/admin';

export default function AdminSecurity() {
  const { lang, dir, formatDate } = useLanguage();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'passwords' | 'rbac' | 'protection' | 'logs_api'>('overview');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<BackupVerificationResult | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Configuration State
  const [config, setConfig] = useState<SecurityConfig>({
    session_timeout_minutes: 30,
    ip_lock_enabled: false,
    max_simultaneous_sessions: 3,
    logout_on_browser_close: true,

    min_password_length: 12,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: true,
    password_expiration_days: 90,
    prevent_reuse_count: 5,

    two_factor_policy: 'admins_only',

    max_login_attempts: 5,
    lockout_duration_minutes: 30,
    auto_ip_ban_threshold: 10,
    rate_limit_per_minute: 60,

    backup_encryption_enabled: true,
    api_cors_origins: 'https://businessmarket.dz, https://admin.businessmarket.dz',
    api_rate_limiting_enabled: true,
    jwt_expiration_hours: 168,
  });

  // Data Collections
  const [sessions, setSessions] = useState<AdminActiveSession[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedLoginAttempt[]>([]);
  const [bannedIps, setBannedIps] = useState<string[]>([]);
  const [newBannedIp, setNewBannedIp] = useState('');
  const [securityEvents, setSecurityEvents] = useState<SecurityEventLog[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiRequestLog[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  // 2FA Recovery Codes State
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Live Password Testing State
  const [testPassword, setTestPassword] = useState('');

  // Search & Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Load Data on Mount
  useEffect(() => {
    loadAllSecurityData();
  }, []);

  const loadAllSecurityData = async () => {
    setLoading(true);
    try {
      const loadedConfig = await getSecurityConfig();
      setConfig(loadedConfig);

      const loadedSessions = await fetchActiveSessions();
      setSessions(loadedSessions);

      const loadedFailed = await fetchFailedLoginAttempts();
      setFailedAttempts(loadedFailed);

      const loadedBanned = await fetchBannedIps();
      setBannedIps(loadedBanned);

      const loadedEvents = await fetchSecurityEvents();
      setSecurityEvents(loadedEvents);

      const loadedApiLogs = generateApiLogs();
      setApiLogs(loadedApiLogs);

      const loadedRoles = await fetchAdminRoles();
      setRoles(loadedRoles);
    } catch (e) {
      console.error('Error loading security data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Save Settings Handler
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await saveSecurityConfig(config);
      await logSecurityEvent(
        'zakidj181@gmail.com',
        'critical_action',
        'medium',
        'تحديث وتطبيق إعدادات أمان وحماية النظام العامة'
      );
      showToast('success', lang === 'ar' ? 'تم حفظ إعدادات الأمان بنجاح' : 'Security settings saved successfully');
    } catch {
      showToast('error', lang === 'ar' ? 'حدث خطأ أثناء حفظ الإعدادات' : 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Run Full Audit
  const handleRunAudit = async () => {
    setAuditing(true);
    try {
      const res = await performBackupVerification();
      setAuditResult(res);
      await logSecurityEvent(
        'zakidj181@gmail.com',
        'backup_verified',
        'low',
        'تم تشغيل فحص تدقيق الأمان والنسخ الاحتياطي الشامل بنجاح'
      );
      showToast('success', lang === 'ar' ? 'مكتمل: فحص أمان النظام وسلامة قواعد البيانات ناجح 100%' : 'Security audit completed successfully');
    } catch {
      showToast('error', lang === 'ar' ? 'فشل فحص الأمان' : 'Audit failed');
    } finally {
      setAuditing(false);
    }
  };

  // Revoke Single Session
  const handleRevokeSession = async (id: string) => {
    const updated = await revokeActiveSession(id);
    setSessions(updated);
    await logSecurityEvent(
      'zakidj181@gmail.com',
      'critical_action',
      'high',
      `إنهاء وتوثيق إغلاق الجلسة رقم: ${id}`
    );
    showToast('info', lang === 'ar' ? 'تم إنهاء الجلسة بنجاح' : 'Session revoked');
  };

  // Logout from all other devices
  const handleLogoutAllOther = async () => {
    const updated = await logoutFromAllOtherDevices();
    setSessions(updated);
    await logSecurityEvent(
      'zakidj181@gmail.com',
      'critical_action',
      'critical',
      'تسجيل الخروج القسري وإغلاق كافة الجلسات النشطة في الأجهزة الأخرى'
    );
    showToast('success', lang === 'ar' ? 'تم إغلاق جميع الجلسات في الأجهزة الأخرى' : 'All other sessions revoked');
  };

  // Toggle IP Block on Failed Login
  const handleToggleIpBlock = async (attemptId: string) => {
    const updated = await toggleIpBlock(attemptId);
    setFailedAttempts(updated);
    showToast('success', lang === 'ar' ? 'تم تحديث حالة حظر العنوان' : 'IP block state updated');
  };

  // Manage Manual Banned IPs
  const handleAddBannedIp = async () => {
    if (!newBannedIp.trim()) return;
    if (bannedIps.includes(newBannedIp.trim())) {
      showToast('error', lang === 'ar' ? 'العنوان مضاف بالفعل' : 'IP already banned');
      return;
    }
    const updated = [...bannedIps, newBannedIp.trim()];
    setBannedIps(updated);
    await updateBannedIps(updated);
    setNewBannedIp('');
    await logSecurityEvent(
      'zakidj181@gmail.com',
      'security_alert',
      'high',
      `إضافة عنوان IP القائمة السوداء المحظورة: ${newBannedIp.trim()}`
    );
    showToast('success', lang === 'ar' ? 'تمت إضافة العنوان للحظر' : 'IP banned successfully');
  };

  const handleRemoveBannedIp = async (ip: string) => {
    const updated = bannedIps.filter(item => item !== ip);
    setBannedIps(updated);
    await updateBannedIps(updated);
    showToast('info', lang === 'ar' ? 'تم إلغاء حظر العنوان' : 'IP unbanned');
  };

  // Generate 2FA Codes Modal
  const handleOpen2FAModal = () => {
    const codes = generate2FARecoveryCodes();
    setRecoveryCodes(codes);
    setShow2FAModal(true);
    setCopiedCodes(false);
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  // Live Password Strength Calculation
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (!testPassword) return { score: 0, label: 'فارغ', color: 'text-slate-500', barColor: 'bg-slate-700' };

    if (testPassword.length >= config.min_password_length) score += 25;
    if (/[A-Z]/.test(testPassword)) score += 25;
    if (/[a-z]/.test(testPassword)) score += 20;
    if (/[0-9]/.test(testPassword)) score += 15;
    if (/[^A-Za-z0-9]/.test(testPassword)) score += 15;

    if (score < 40) return { score, label: lang === 'ar' ? 'ضعيفة جداً' : 'Very Weak', color: 'text-rose-400', barColor: 'bg-rose-500' };
    if (score < 70) return { score, label: lang === 'ar' ? 'متوسطة القوة' : 'Medium', color: 'text-amber-400', barColor: 'bg-amber-500' };
    if (score < 90) return { score, label: lang === 'ar' ? 'قوية' : 'Strong', color: 'text-emerald-400', barColor: 'bg-emerald-500' };
    return { score: 100, label: lang === 'ar' ? 'ممتازة و آمنة 100%' : 'Excellent', color: 'text-indigo-400', barColor: 'bg-indigo-500' };
  }, [testPassword, config, lang]);

  // Filtered Security Logs
  const filteredLogs = useMemo(() => {
    return securityEvents.filter(ev => {
      const matchQuery = searchQuery === '' ||
        ev.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.ip_address.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSeverity = severityFilter === 'all' || ev.severity === severityFilter;
      const matchType = eventTypeFilter === 'all' || ev.event_type === eventTypeFilter;

      return matchQuery && matchSeverity && matchType;
    });
  }, [securityEvents, searchQuery, severityFilter, eventTypeFilter]);

  // Paginated Logs
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">{lang === 'ar' ? 'جاري تحميل نظام وحدة الأمان...' : 'Loading Security System Module...'}</p>
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-6 text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 ${dir === 'rtl' ? 'left-6' : 'right-6'} z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-bold animate-slideUp ${
            toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950 border-rose-500/40 text-rose-200'
              : 'bg-slate-900 border-indigo-500/40 text-indigo-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'مركز حماية وأمان النظام والوصول' : 'Security & Access Control Center'}</span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {lang === 'ar' ? 'محمي 100%' : 'Protected'}
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'ar'
                  ? 'إدارة جلسات المشرفين، سياسات كلمات المرور، جدار الحماية، الصلاحيات RBAC، وسجلات الأمان المباشرة.'
                  : 'Manage active admin sessions, password policies, firewall protection, RBAC, and security audit logs.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRunAudit}
            disabled={auditing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            {auditing ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
            <span>{lang === 'ar' ? 'تشغيل فحص الأمان الشامل' : 'Run Full Security Audit'}</span>
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>{lang === 'ar' ? 'حفظ إعدادات الأمان' : 'Save Security Rules'}</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'حالة الحماية والأمان' : 'System Status'}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-emerald-400 flex items-center gap-2">
            <span>{lang === 'ar' ? 'نشط وآمن جداً' : 'Active & Secure'}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'تشفير AES-256 وقواعد RLS مفعلة' : 'AES-256 & RLS enforced'}</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'الجلسات النشطة' : 'Active Sessions'}</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-white">
            {sessions.length} {lang === 'ar' ? 'جلسة متصلة' : 'active'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'الحد الأقصى لكل مشرف:' : 'Max limit per admin:'} {config.max_simultaneous_sessions}</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'المصادقة الثنائية (2FA)' : '2FA Policy'}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-amber-400">
            {config.two_factor_policy === 'admins_only' ? (lang === 'ar' ? 'إجباري للمشرفين' : 'Admins Only') :
             config.two_factor_policy === 'all_users' ? (lang === 'ar' ? 'إجباري للجميع' : 'All Users') :
             (lang === 'ar' ? 'اختياري' : 'Optional')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'رمز TOTP ورموز استعادة الطوارئ' : 'TOTP & Recovery codes'}</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'العناوين المحظورة' : 'Blocked IPs'}</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-extrabold text-rose-400">
            {bannedIps.length} {lang === 'ar' ? 'عنوان محظور' : 'banned IPs'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'حظر تلقائي للهجمات التخمينية' : 'Auto Brute-force protection'}</p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'overview', label: lang === 'ar' ? 'الحالة العامة والوقاية' : 'Overview & Firewall', icon: ShieldAlert },
          { id: 'sessions', label: lang === 'ar' ? 'الجلسات والمصادقة (2FA)' : 'Sessions & 2FA', icon: Smartphone },
          { id: 'passwords', label: lang === 'ar' ? 'سياسة كلمات المرور' : 'Password Policy', icon: Lock },
          { id: 'rbac', label: lang === 'ar' ? 'صلاحيات الوصول (RBAC)' : 'Access Control', icon: UserCheck },
          { id: 'protection', label: lang === 'ar' ? 'حظر الهجمات والعناوين' : 'Login Protection', icon: Ban },
          { id: 'logs_api', label: lang === 'ar' ? 'سجلات الأمان والنسخ' : 'Logs & API Security', icon: Activity },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & FIREWALL */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Maximum Protection Mode Switch */}
          <div className={`bg-slate-900 p-6 rounded-2xl border transition-all ${config.ip_lock_enabled ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-800'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-5 h-5 ${config.ip_lock_enabled ? 'text-amber-400' : 'text-slate-400'}`} />
                  <h2 className="font-bold text-white text-sm">
                    {lang === 'ar' ? 'وضع القفل الأمني لعنوان IP والجلسات (IP Security Lock)' : 'Strict Session IP Lock Mode'}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                  {lang === 'ar'
                    ? 'عند التفعيل، سيتم إنهاء كافة جلسات المشرفين فور تغيير عنوان IP أو متصفح الجهاز لمنع اختطاف الجلسات (Session Hijacking).'
                    : 'Enforce instant session termination upon IP or browser user-agent changes to mitigate hijacking threats.'}
                </p>
              </div>

              <button
                onClick={() => setConfig(prev => ({ ...prev, ip_lock_enabled: !prev.ip_lock_enabled }))}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  config.ip_lock_enabled
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {config.ip_lock_enabled
                  ? (lang === 'ar' ? 'تعطيل القفل الحساس ⚠️' : 'Disable Strict IP Lock')
                  : (lang === 'ar' ? 'تفعيل القفل الحساس 🛡️' : 'Enable Strict IP Lock')}
              </button>
            </div>
          </div>

          {/* Security Audit Output Panel */}
          {auditResult && (
            <div className="bg-slate-900 p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 animate-fadeIn space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-emerald-300 text-sm">
                  {lang === 'ar' ? 'تقرير نتيجة الفحص الأمني الشامل لقاعدة البيانات والنظام' : 'Database & Infrastructure Security Audit Report'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">{lang === 'ar' ? 'بصمة التشفير (SHA-256):' : 'SHA-256 Checksum:'}</span>
                  <span className="font-mono text-emerald-400 text-[10px] break-all">{auditResult.checksum_sha256}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">{lang === 'ar' ? 'خوارزمية التشفير:' : 'Encryption:'}</span>
                  <span className="font-bold text-white">{auditResult.encryption_algorithm}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">{lang === 'ar' ? 'إجمالي السجلات المفحوصة:' : 'Total Records Audit:'}</span>
                  <span className="font-bold text-indigo-400">{auditResult.total_records} {lang === 'ar' ? 'سجل في' : 'records across'} {auditResult.tables_count} {lang === 'ar' ? 'جدول' : 'tables'}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                ✅ {auditResult.notes}
              </p>
            </div>
          )}

          {/* Main Security Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Policy Controls */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'ar' ? 'محددات سقف الطلبات والجلسات' : 'Rate Limits & Session Constraints'}</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'سقف طلبات API لكل دقيقة (Rate Limit)' : 'Rate Limit Requests per minute'}
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={config.rate_limit_per_minute}
                    onChange={e => setConfig({ ...config, rate_limit_per_minute: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'حماية السيرفر من هجمات الحرمان من الخدمة (DDoS).' : 'Prevents API flooding and brute force rate limits.'}</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'الحد الأقصى للجلسات المتزامنة لكل حساب' : 'Max Simultaneous Sessions per Account'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.max_simultaneous_sessions}
                    onChange={e => setConfig({ ...config, max_simultaneous_sessions: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-bold text-slate-300">{lang === 'ar' ? 'تسجيل الخروج عند إغلاق المتصفح' : 'Logout on Browser Close'}</span>
                  <input
                    type="checkbox"
                    checked={config.logout_on_browser_close}
                    onChange={e => setConfig({ ...config, logout_on_browser_close: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Core Infrastructure Controls */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span>{lang === 'ar' ? 'تشفير قاعدة البيانات و JWT' : 'DB Encryption & JWT Expiration'}</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'مدة صلاحية رمز المصادقة JWT (بالساعات)' : 'JWT Token Validity (Hours)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={config.jwt_expiration_hours}
                    onChange={e => setConfig({ ...config, jwt_expiration_hours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? '168 ساعة تعادل أسبوع كامل' : '168 hours = 7 days'}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div>
                    <span className="font-bold text-slate-300 block">{lang === 'ar' ? 'تشفير النسخ الاحتياطية (AES-256)' : 'Backup Encryption (AES-256)'}</span>
                    <span className="text-[10px] text-slate-500">{lang === 'ar' ? 'تشفير جميع الملفات المحفوظة قبل النقل' : 'Encrypt backup files before cloud sync'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.backup_encryption_enabled}
                    onChange={e => setConfig({ ...config, backup_encryption_enabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div>
                    <span className="font-bold text-slate-300 block">{lang === 'ar' ? 'تقييد النطاقات المسموحة CORS' : 'CORS API Origin Protection'}</span>
                    <span className="text-[10px] text-slate-500">{lang === 'ar' ? 'منع استدعاء API من مواقع خارجية غير مصرحة' : 'Prevent unauthorized cross-origin requests'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.api_rate_limiting_enabled}
                    onChange={e => setConfig({ ...config, api_rate_limiting_enabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SESSIONS & 2FA */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Active Sessions Panel */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-bold text-white text-base flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <span>{lang === 'ar' ? 'جلسات المشرفين المتصلة حالياً' : 'Active Admin Sessions'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'مراقبة وإدارة الأجهزة المتصلة بمتجرك وإنهاء الجلسات غير المصرح بها فوراً.' : 'Monitor and revoke logged-in admin device sessions.'}
                </p>
              </div>

              <button
                onClick={handleLogoutAllOther}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <UserX className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إنهاء الجلسات في جميع الأجهزة الأخرى' : 'Revoke All Other Sessions'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.is_current ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{s.user_email}</span>
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">{s.user_role}</span>
                        {s.is_current && (
                          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30">
                            {lang === 'ar' ? 'الجلسة الحالية' : 'Current Session'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        💻 {s.device_browser} | IP: <span className="font-mono text-emerald-400 font-bold">{s.ip_address}</span> ({s.location})
                      </p>
                    </div>
                  </div>

                  {!s.is_current && (
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs font-bold border border-rose-500/20 transition-all cursor-pointer self-end sm:self-center"
                    >
                      {lang === 'ar' ? 'إغلاق الجلسة فوراً' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Session Timeout & 2FA Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Session Timeout Settings */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'ar' ? 'مهلة الخمول والتسجيل التلقائي' : 'Idle Session Timeout'}</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'مدة الخمول المسموحة قبل القفل التلقائي (بالدقائق)' : 'Session Idle Timeout (Minutes)'}
                  </label>
                  <select
                    value={config.session_timeout_minutes}
                    onChange={e => setConfig({ ...config, session_timeout_minutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  >
                    <option value={15}>15 {lang === 'ar' ? 'دقيقة (حماية فائقة)' : 'Minutes'}</option>
                    <option value={30}>30 {lang === 'ar' ? 'دقيقة (موصى به)' : 'Minutes'}</option>
                    <option value={60}>60 {lang === 'ar' ? 'دقيقة (ساعة)' : 'Minutes'}</option>
                    <option value={480}>480 {lang === 'ar' ? 'دقيقة (8 ساعات)' : 'Minutes'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2FA Configuration & Recovery Generator */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
                <Key className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'إعدادات المصادقة الثنائية (2FA)' : 'Two-Factor Authentication Policy'}</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'سياسة فرض المصادقة الثنائية' : '2FA Policy Requirement'}
                  </label>
                  <select
                    value={config.two_factor_policy}
                    onChange={e => setConfig({ ...config, two_factor_policy: e.target.value as typeof config.two_factor_policy })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  >
                    <option value="optional">{lang === 'ar' ? 'اختياري لجميع المستخدمين' : 'Optional for all'}</option>
                    <option value="admins_only">{lang === 'ar' ? 'إجباري لجميع المشرفين فقط' : 'Mandatory for Admins'}</option>
                    <option value="all_users">{lang === 'ar' ? 'إجباري لكافة مستخدمي المتجر' : 'Mandatory for All Users'}</option>
                  </select>
                </div>

                <button
                  onClick={handleOpen2FAModal}
                  className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold rounded-xl border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'عرض وإنشاء رموز استعادة 2FA الطوارئ' : 'View & Generate 2FA Recovery Codes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PASSWORD POLICY */}
      {activeTab === 'passwords' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Password Policy Rules */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
                <Lock className="w-5 h-5 text-emerald-400" />
                <span>{lang === 'ar' ? 'قواعد وتعقيد كلمات المرور' : 'Password Complexity Rules'}</span>
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">{lang === 'ar' ? 'الحد الأدنى لطول كلمة المرور:' : 'Minimum Length:'}</span>
                    <span className="text-emerald-400 font-mono text-sm">{config.min_password_length} {lang === 'ar' ? 'أحرف' : 'chars'}</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={32}
                    value={config.min_password_length}
                    onChange={e => setConfig({ ...config, min_password_length: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.require_uppercase}
                      onChange={e => setConfig({ ...config, require_uppercase: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span>{lang === 'ar' ? 'اشتراط أحرف كبيرة (A-Z)' : 'Require Uppercase Letters (A-Z)'}</span>
                  </label>

                  <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.require_lowercase}
                      onChange={e => setConfig({ ...config, require_lowercase: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span>{lang === 'ar' ? 'اشتراط أحرف صغيرة (a-z)' : 'Require Lowercase Letters (a-z)'}</span>
                  </label>

                  <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.require_numbers}
                      onChange={e => setConfig({ ...config, require_numbers: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span>{lang === 'ar' ? 'اشتراط أرقام (0-9)' : 'Require Numbers (0-9)'}</span>
                  </label>

                  <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.require_symbols}
                      onChange={e => setConfig({ ...config, require_symbols: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span>{lang === 'ar' ? 'اشتراط رموز خاصة (!@#$%^&*)' : 'Require Special Symbols (!@#$%^&*)'}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Expiration & Rotation */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
                <span>{lang === 'ar' ? 'انتهاء الصلاحية ودورة التغيير' : 'Expiration & Rotation Policy'}</span>
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'مدة صلاحية كلمة المرور قبل فرض التغيير' : 'Password Expiration (Days)'}
                  </label>
                  <select
                    value={config.password_expiration_days}
                    onChange={e => setConfig({ ...config, password_expiration_days: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  >
                    <option value={0}>{lang === 'ar' ? 'بلا انتهاء (غير موصى به)' : 'Never expire'}</option>
                    <option value={30}>30 {lang === 'ar' ? 'يوماً' : 'Days'}</option>
                    <option value={60}>60 {lang === 'ar' ? 'يوماً' : 'Days'}</option>
                    <option value={90}>90 {lang === 'ar' ? 'يوماً (موصى به)' : 'Days (Recommended)'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'منع إعادة استخدام كلمات المرور السابقة' : 'Prevent Password Reuse (Count)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.prevent_reuse_count}
                    onChange={e => setConfig({ ...config, prevent_reuse_count: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'يمنع المستخدم من استخدام أحدث N كلمة مرور سابقة' : 'Prevents reusing last N passwords'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Password Tester */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'مختبر قياس قوة كلمة المرور المباشر' : 'Live Password Strength Validator'}</span>
            </h3>

            <div className="space-y-3 max-w-xl">
              <input
                type="text"
                placeholder={lang === 'ar' ? 'اكتب كلمة مرور لتجربتها واختبار توافقها مع السياسة...' : 'Type a test password to evaluate...'}
                value={testPassword}
                onChange={e => setTestPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:border-emerald-500"
              />

              {testPassword && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">{lang === 'ar' ? 'مستوى القوة:' : 'Strength Score:'}</span>
                    <span className={passwordStrength.color}>{passwordStrength.label} ({passwordStrength.score}%)</span>
                  </div>

                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full transition-all duration-300 ${passwordStrength.barColor}`} style={{ width: `${passwordStrength.score}%` }}></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2">
                    <span className={testPassword.length >= config.min_password_length ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {testPassword.length >= config.min_password_length ? '✓' : '✗'} {config.min_password_length}+ {lang === 'ar' ? 'أحرف' : 'chars'}
                    </span>
                    <span className={/[A-Z]/.test(testPassword) ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {/[A-Z]/.test(testPassword) ? '✓' : '✗'} {lang === 'ar' ? 'حرف كبير (A-Z)' : 'Uppercase'}
                    </span>
                    <span className={/[a-z]/.test(testPassword) ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {/[a-z]/.test(testPassword) ? '✓' : '✗'} {lang === 'ar' ? 'حرف صغير (a-z)' : 'Lowercase'}
                    </span>
                    <span className={/[0-9]/.test(testPassword) ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {/[0-9]/.test(testPassword) ? '✓' : '✗'} {lang === 'ar' ? 'أرقام (0-9)' : 'Numbers'}
                    </span>
                    <span className={/[^A-Za-z0-9]/.test(testPassword) ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {/[^A-Za-z0-9]/.test(testPassword) ? '✓' : '✗'} {lang === 'ar' ? 'رموز خاصة (!@#)' : 'Symbols'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ACCESS CONTROL (RBAC) */}
      {activeTab === 'rbac' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-bold text-white text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span>{lang === 'ar' ? 'مصفوفة أدوار وصلاحيات الوصول (RBAC)' : 'Role-Based Access Control Matrix'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'عرض وتأكيد صلاحيات وحدات النظام، الصفحات، والعمليات الحساسة لكل دور وظيفي.' : 'Review and enforce module, page, and action permissions for admin roles.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/50">
                    <th className="py-3 px-4 text-right">{lang === 'ar' ? 'الدور الوظيفي' : 'Role Name'}</th>
                    <th className="py-3 px-4 text-right">{lang === 'ar' ? 'الوصف' : 'Description'}</th>
                    <th className="py-3 px-4 text-center">{lang === 'ar' ? 'إجمالي الصلاحيات' : 'Permissions'}</th>
                    <th className="py-3 px-4 text-center">{lang === 'ar' ? 'صلاحيات النظام' : 'System Scope'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {roles.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>{r.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{r.description}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-400">
                        {r.is_super_admin ? (lang === 'ar' ? 'جميع الصلاحيات (كل شيء)' : 'ALL (100%)') : `${r.permissions?.length || 0} / ${ALL_PERMISSIONS.length}`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.is_super_admin ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-300'}`}>
                          {r.is_super_admin ? (lang === 'ar' ? 'مدير كامل' : 'Super Admin') : (lang === 'ar' ? 'مخصص' : 'Custom Scope')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOGIN PROTECTION & BANS */}
      {activeTab === 'protection' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brute Force & Lockout Rules */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>{lang === 'ar' ? 'سياسة الحظر وقفل الحسابات' : 'Account Lockout & Brute Force Policy'}</span>
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'الحد الأقصى لمحاولات الدخول الفاشلة قبل القفل' : 'Max Failed Login Attempts before Lockout'}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={config.max_login_attempts}
                    onChange={e => setConfig({ ...config, max_login_attempts: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {lang === 'ar' ? 'مدة قفل الحساب المتبقية (بالدقائق)' : 'Lockout Duration (Minutes)'}
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={config.lockout_duration_minutes}
                    onChange={e => setConfig({ ...config, lockout_duration_minutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Manual IP Blacklist Manager */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>{lang === 'ar' ? 'إدارة عناوين IP المحظورة فوراً' : 'IP Blacklist Manager'}</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 185.220.101.4"
                    value={newBannedIp}
                    onChange={e => setNewBannedIp(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
                  />
                  <button
                    onClick={handleAddBannedIp}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    {lang === 'ar' ? 'حظر العنوان' : 'Ban IP'}
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bannedIps.map(ip => (
                    <div key={ip} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="font-mono text-rose-400 font-bold">{ip}</span>
                      <button
                        onClick={() => handleRemoveBannedIp(ip)}
                        className="text-[10px] text-slate-400 hover:text-emerald-400 font-bold transition-colors cursor-pointer"
                      >
                        {lang === 'ar' ? 'إلغاء الحظر' : 'Unban'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Failed Logins Table */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>{lang === 'ar' ? 'سجل محاولات الدخول الفاشلة والمشبوهة' : 'Failed Login Attempts & Threats'}</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/50">
                    <th className="py-3 px-4 text-right">{lang === 'ar' ? 'البريد المحاول' : 'Attempted Email'}</th>
                    <th className="py-3 px-4 text-right">{lang === 'ar' ? 'عنوان IP' : 'IP Address'}</th>
                    <th className="py-3 px-4 text-right">{lang === 'ar' ? 'السبب' : 'Failure Reason'}</th>
                    <th className="py-3 px-4 text-right">{lang === 'ar' ? 'التوقيت' : 'Time'}</th>
                    <th className="py-3 px-4 text-center">{lang === 'ar' ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {failedAttempts.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white font-mono">{item.email_attempted}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{item.ip_address}</td>
                      <td className="py-3 px-4 text-rose-400">{item.failure_reason}</td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(item.attempt_time)}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleIpBlock(item.id)}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                            item.is_blocked
                              ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30'
                              : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/30'
                          }`}
                        >
                          {item.is_blocked ? (lang === 'ar' ? 'إلغاء حظر العنوان' : 'Unblock') : (lang === 'ar' ? 'حظر العنوان فوراً' : 'Block IP')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: LOGS, API & BACKUP SECURITY */}
      {activeTab === 'logs_api' && (
        <div className="space-y-6">
          {/* Security Events Search & Filters */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <h2 className="font-bold text-white text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <span>{lang === 'ar' ? 'سجلات أحداث الأمان والتدقيق الحي' : 'Security Events & Audit Feed'}</span>
              </h2>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute top-2.5 right-3" />
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'بحث في السجلات...' : 'Search logs...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:border-emerald-500 w-48"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={severityFilter}
                    onChange={e => setSeverityFilter(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none"
                  >
                    <option value="all">{lang === 'ar' ? 'كل المستويات' : 'All Severities'}</option>
                    <option value="low">{lang === 'ar' ? 'عادي (Low)' : 'Low'}</option>
                    <option value="medium">{lang === 'ar' ? 'متوسط (Medium)' : 'Medium'}</option>
                    <option value="high">{lang === 'ar' ? 'عالي (High)' : 'High'}</option>
                    <option value="critical">{lang === 'ar' ? 'حرج (Critical)' : 'Critical'}</option>
                  </select>
                </div>

                <select
                  value={eventTypeFilter}
                  onChange={e => setEventTypeFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500"
                >
                  <option value="all">{lang === 'ar' ? 'جميع أنواع الأحداث' : 'All Event Types'}</option>
                  <option value="login_success">{lang === 'ar' ? 'دخول ناجح' : 'Login Success'}</option>
                  <option value="login_failed">{lang === 'ar' ? 'دخول فاشل' : 'Login Failed'}</option>
                  <option value="permission_change">{lang === 'ar' ? 'تعديل الصلاحيات' : 'Permission Change'}</option>
                  <option value="critical_action">{lang === 'ar' ? 'إجراء حرج' : 'Critical Action'}</option>
                  <option value="backup_verified">{lang === 'ar' ? 'فحص النسخ الاحتياطي' : 'Backup Verified'}</option>
                  <option value="api_auth_failure">{lang === 'ar' ? 'فشل مصادقة API' : 'API Auth Failure'}</option>
                  <option value="security_alert">{lang === 'ar' ? 'تنبيه أمني' : 'Security Alert'}</option>
                </select>
              </div>
            </div>

            {/* Events List */}
            <div className="space-y-2">
              {paginatedLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {lang === 'ar' ? 'لا توجد سجلات تطابق معايير البحث والفلترة' : 'No logs match the search/filter criteria'}
                </div>
              ) : (
                paginatedLogs.map(ev => (
                  <div key={ev.id} className="flex items-start justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs hover:border-slate-700 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          ev.severity === 'high' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          ev.severity === 'medium' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {ev.severity.toUpperCase()}
                        </span>
                        <span className="font-bold text-white">{ev.details}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>👤 {ev.actor}</span>
                        <span>🌐 IP: <strong className="font-mono text-slate-300">{ev.ip_address}</strong></span>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{formatDate(ev.created_at)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
              <span>
                {lang === 'ar' ? 'الصفحة' : 'Page'} {currentPage} {lang === 'ar' ? 'من' : 'of'} {totalPages}
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* API Request Logs Table */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <span>{lang === 'ar' ? 'سجل طلبات API المباشرة واستجابة السيرفر' : 'Live API Request Logs'}</span>
            </h2>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/50">
                    <th className="py-2.5 px-4 text-right">{lang === 'ar' ? 'المسار Endpoint' : 'Endpoint'}</th>
                    <th className="py-2.5 px-4 text-center">{lang === 'ar' ? 'النوع' : 'Method'}</th>
                    <th className="py-2.5 px-4 text-center">{lang === 'ar' ? 'كود الاستجابة' : 'Status Code'}</th>
                    <th className="py-2.5 px-4 text-center">{lang === 'ar' ? 'زمن الاستجابة' : 'Response Time'}</th>
                    <th className="py-2.5 px-4 text-right">{lang === 'ar' ? 'عنوان IP' : 'Client IP'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {apiLogs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-4 font-mono font-bold text-white">{l.endpoint}</td>
                      <td className="py-2 px-4 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-indigo-300">{l.method}</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.status_code < 300 ? 'bg-emerald-500/20 text-emerald-400' :
                          l.status_code < 400 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {l.status_code}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-slate-300">{l.response_time_ms} ms</td>
                      <td className="py-2 px-4 font-mono text-slate-400">{l.client_ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2FA RECOVERY CODES MODAL */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span>{lang === 'ar' ? 'رموز استعادة 2FA للطوارئ' : '2FA Emergency Recovery Codes'}</span>
              </h3>
              <button
                onClick={() => setShow2FAModal(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {lang === 'ar'
                ? 'احتفظ بهذه الرموز في مكان آمن. يمكن استخدام كل رمز مرة واحدة فقط للدخول إلى حسابك عند فقدان تطبيق Authenticator.'
                : 'Keep these emergency codes safe. Each code can be used once if you lose access to your authenticator app.'}
            </p>

            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-center text-emerald-400 text-sm font-bold">
              {recoveryCodes.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-slate-900/60 rounded border border-slate-800/80">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyRecoveryCodes}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {copiedCodes ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCodes ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ كافة الرموز' : 'Copy All Codes')}</span>
              </button>

              <button
                onClick={() => setRecoveryCodes(generate2FARecoveryCodes())}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
                title={lang === 'ar' ? 'إعادة توليد الرموز' : 'Regenerate'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
