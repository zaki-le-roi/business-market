import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, CheckCircle2, Clock, Loader2, RefreshCw, Play, Plus, Trash2, Sliders,
  Mail, Search, FileSpreadsheet, ChevronLeft, ChevronRight, Settings, Activity, X,
  AlertCircle
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { exportToCSV } from '../../lib/csvHelper';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchAutomationRules,
  saveAutomationRule,
  deleteAutomationRule,
  toggleAutomationRuleStatus,
  fetchScheduledTasks,
  fetchEmailQueue,
  retryEmailQueueItem,
  retryAllFailedEmails as retryAllFailedEmailsDB,
  fetchAutomationSettings,
  saveAutomationSettings,
  fetchAutomationLogs,
  WorkflowStep,
} from '../../lib/automation';
import { processDomainEvent, processScheduledTasks, processEmailQueue } from '../../lib/automationEngine';

interface Workflow {
  id: string;
  category: 'order' | 'inventory' | 'customer' | 'marketing' | 'notification';
  titleAr: string;
  titleFr: string;
  event: string;
  steps: WorkflowStep[];
}

interface CustomRule {
  id: string;
  nameAr: string;
  nameFr: string;
  trigger: string;
  condition: string;
  action: string;
  enabled: boolean;
  category: string;
}

interface CronJob {
  id: string;
  nameAr: string;
  nameFr: string;
  schedule: string;
  type: 'daily' | 'weekly' | 'monthly' | 'hourly';
  lastRun: string;
  nextRun: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'success';
}

interface EmailQueueItem {
  id: string;
  recipient: string;
  subject: string;
  type: 'welcome' | 'invoice' | 'shipping' | 'alert' | 'promo';
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  created_at: string;
  error?: string;
}

interface ExecLog {
  id: string;
  event: string;
  ruleName: string;
  status: 'success' | 'failure' | 'warning';
  message: string;
  created_at: string;
}

export default function AdminAutomation() {
  const { lang, dir, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (arStr: string, frStr: string) => (isAr ? arStr : frStr);

  const [activeTab, setActiveTab] = useState<'workflows' | 'builder' | 'cron' | 'emailQueue' | 'settings' | 'logs'>('workflows');
  const [loading, setLoading] = useState(true);

  // --- Workflows Engine State ---
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: '00000000-0000-0000-0000-000000000001',
      category: 'order',
      titleAr: 'المعالجة التلقائية للطلبات وفواتيرها',
      titleFr: 'Traitement automatique des commandes & factures',
      event: 'OrderCreated',
      steps: [
        { ar: 'تأكيد الطلب تلقائياً في النظام', fr: 'Auto-confirmer la commande', status: 'done' },
        { ar: 'خصم أعداد الكميات من جدول المخزون', fr: 'Déduire les quantités en stock', status: 'done' },
        { ar: 'إنشاء فاتورة الشراء PDF تلقائياً', fr: 'Générer facture PDF automatique', status: 'done' },
        { ar: 'إشعار مسؤول المتجر عبر البريد وSMS', fr: 'Notifier l admin via Email & SMS', status: 'done' },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      category: 'inventory',
      titleAr: 'تنبيهات واستجابة أوتوماتيكية للمخزون',
      titleFr: 'Alertes & mise à jour automatique des stocks',
      event: 'LowStockAlert',
      steps: [
        { ar: 'فحص الكميات الأقل من الحد الأدنى (5 قطع)', fr: 'Détecter les stocks < 5 articles', status: 'done' },
        { ar: 'تحديث حالة المنتج إلى "مخزون منخفض"', fr: 'Mettre à jour le statut en "Stock faible"', status: 'done' },
        { ar: 'إرسال تنبيه لوحة تحكم الإدارة', fr: 'Envoyer alerte au tableau de bord', status: 'done' },
        { ar: 'إيقاف المنتج تلقائياً عند نفاده تماماً (0)', fr: 'Désactiver le produit à épuisement (0)', status: 'done' },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      category: 'customer',
      titleAr: 'أتمتة ترحيب وتفعيل حسابات العملاء',
      titleFr: 'Automation d accueil & activation des clients',
      event: 'CustomerRegistered',
      steps: [
        { ar: 'إرسال بريد ترحيبي مع كود الخصم الأول', fr: 'Envoyer e-mail de bienvenue avec code', status: 'done' },
        { ar: 'إشعار العميل بتفعيل حسابه وتوثيقه', fr: 'Envoyer notification d activation', status: 'done' },
        { ar: 'جدولة كود خصم لعيد ميلاد العميل', fr: 'Programmer remise d anniversaire', status: 'done' },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      category: 'marketing',
      titleAr: 'إدارة العروض والكوبونات المجدولة تلقائياً',
      titleFr: 'Gestion automatique des promotions & coupons',
      event: 'MarketingScheduleCheck',
      steps: [
        { ar: 'تفعيل العروض الترويجية المجدولة فور حلول وقتها', fr: 'Activer les promos programmées', status: 'idle' },
        { ar: 'إلغاء تفعيل الكوبونات فور انتهاء تاريخ صلاحيتها', fr: 'Désactiver les coupons expirés', status: 'idle' },
        { ar: 'تحديث بانرات الواجهة الرئيسية تلقائياً', fr: 'Mettre à jour les bannières', status: 'idle' },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      category: 'notification',
      titleAr: 'إشعارات الدفع والتوصيل التلقائية',
      titleFr: 'Notifications automatiques de paiement & livraison',
      event: 'ShipmentStatusUpdated',
      steps: [
        { ar: 'إرسال رقم التتبع ورابط شركة الشحن للعميل', fr: 'Envoyer numéro de suivi au client', status: 'idle' },
        { ar: 'إرسال إشعار التوصيل الفعلي وتحديث حالة الدفع', fr: 'Notification de livraison et paiement', status: 'idle' },
        { ar: 'إرسال بريد الشكر وطلب تقييم الخدمة', fr: 'Envoyer e-mail de remerciement et avis', status: 'idle' },
      ],
    },
  ]);

  const [runningWfId, setRunningWfId] = useState<string | null>(null);
  const [runningStepIdx, setRunningStepIdx] = useState<number | null>(null);
  const [activeQueueCount, setActiveQueueCount] = useState(0);
  const [successQueueCount] = useState(342);
  const [failedQueueCount, setFailedQueueCount] = useState(3);

  // --- Rule Builder State ---
  const [customRules, setCustomRules] = useState<CustomRule[]>([
    {
      id: '00000000-0000-0000-0000-000000000011',
      nameAr: 'إرسال رسالة شكر عند توصيل الطلب',
      nameFr: 'Envoyer e-mail de remerciement après livraison',
      trigger: 'Order Delivered',
      condition: 'Total > 0 DZD',
      action: 'Send Thank You Email & Request Review',
      enabled: true,
      category: 'Order',
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      nameAr: 'تنبيه الأدمن عند انخفاض المخزون عن 5 قطع',
      nameFr: 'Alerter admin si stock < 5',
      trigger: 'Stock < Minimum (5)',
      condition: 'Is Active Product',
      action: 'Send Admin Alert Email & Dashboard Notification',
      enabled: true,
      category: 'Inventory',
    },
    {
      id: '00000000-0000-0000-0000-000000000013',
      nameAr: 'إلغاء الكوبونات المنتهية أوتوماتيكياً',
      nameFr: 'Désactiver coupons expirés',
      trigger: 'Coupon Expired Date',
      condition: 'Is Active Coupon',
      action: 'Disable Coupon Automatically',
      enabled: true,
      category: 'Marketing',
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      nameAr: 'إلغاء الطلبات غير المدفوعة بعد 24 ساعة',
      nameFr: 'Annuler commandes non payées après 24h',
      trigger: 'Unpaid Order > 24 Hours',
      condition: 'Status == Pending',
      action: 'Set Status to Cancelled & Restore Stock',
      enabled: true,
      category: 'Order',
    },
    {
      id: '00000000-0000-0000-0000-000000000015',
      nameAr: 'إرسال قسيمة خصم ترحيبية للعميل الجديد',
      nameFr: 'Envoyer coupon de bienvenue',
      trigger: 'New Customer Registered',
      condition: 'Email Confirmed',
      action: 'Send Welcome Coupon (10%) via Email',
      enabled: true,
      category: 'Customer',
    },
  ]);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    nameAr: '',
    nameFr: '',
    trigger: 'Order Delivered',
    condition: 'Status == Confirmed',
    action: 'Send Notification',
    category: 'Order',
  });

  // --- Scheduled Tasks (Cron Jobs) State ---
  const [cronJobs, setCronJobs] = useState<CronJob[]>([
    {
      id: '00000000-0000-0000-0000-000000000021',
      nameAr: 'فحص صلاحية الكوبونات المجدولة والمنتجات',
      nameFr: 'Vérification quotidienne des coupons et offres',
      schedule: '0 0 * * * (يومياً الساعة 00:00)',
      type: 'daily',
      lastRun: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
      enabled: true,
      status: 'idle',
    },
    {
      id: '00000000-0000-0000-0000-000000000022',
      nameAr: 'تنظيف وإلغاء الطلبات غير المدفوعة (كل ساعة)',
      nameFr: 'Nettoyage des commandes non payées (Chaque heure)',
      schedule: '0 * * * * (كل ساعة)',
      type: 'hourly',
      lastRun: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
      enabled: true,
      status: 'idle',
    },
    {
      id: '00000000-0000-0000-0000-000000000023',
      nameAr: 'إرسال تقرير أداء المبيعات الأسبوعي للأدمن',
      nameFr: 'Rapport hebdomadaire des ventes',
      schedule: '0 8 * * 1 (كل يوم اثنين الساعة 08:00)',
      type: 'weekly',
      lastRun: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
      enabled: true,
      status: 'idle',
    },
    {
      id: '00000000-0000-0000-0000-000000000024',
      nameAr: 'فحص عروض أعياد ميلاد العملاء الشهرية',
      nameFr: 'Offres d anniversaire mensuelles',
      schedule: '0 9 1 * * (أول يوم في الشهر)',
      type: 'monthly',
      lastRun: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 18 * 24 * 3600 * 1000).toISOString(),
      enabled: false,
      status: 'idle',
    },
  ]);

  // --- Email Queue State ---
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([
    { id: '00000000-0000-0000-0000-000000000031', recipient: 'karim.client@gmail.com', subject: 'فاتورة شرائك رقم #ORD-9821', type: 'invoice', status: 'sent', attempts: 1, created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000032', recipient: 'sarah.store@hotmail.com', subject: 'مرحباً بك في متجرنا - كود خصم 10%', type: 'welcome', status: 'sent', attempts: 1, created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000033', recipient: 'admin@moko.dz', subject: '⚠️ تنبيه: 3 منتجات وصل مخزونها للحد الأدنى', type: 'alert', status: 'sent', attempts: 1, created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000034', recipient: 'walid.ship@yahoo.com', subject: 'تم شحن طلبك مع رقم التتبع #TRACK-4821', type: 'shipping', status: 'failed', attempts: 3, created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), error: 'SMTP Timeout Connection' },
    { id: '00000000-0000-0000-0000-000000000035', recipient: 'amine.buyer@gmail.com', subject: 'تأكيد استلام طلبك وشكراً لتسوقك معنا', type: 'promo', status: 'pending', attempts: 0, created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  ]);

  // --- Settings State ---
  const [settings, setSettings] = useState({
    autoCancelHours: 24,
    autoConfirmOrders: true,
    autoGenerateInvoices: true,
    lowStockThreshold: 5,
    outOfStockAutoDisable: true,
    welcomeEmailEnabled: true,
    welcomeDiscountPercent: 10,
    birthdayPromoEnabled: true,
    adminAlertEmail: 'admin@moko.dz',
    adminAlertSMS: true,
    retryMaxAttempts: 3,
  });

  // --- Audit & Automation Logs State ---
  const [logs, setLogs] = useState<ExecLog[]>([
    { id: '00000000-0000-0000-0000-000000000041', event: 'OrderCreated', ruleName: 'Auto-confirm & Generate Invoice', status: 'success', message: 'Order #ORD-9821 confirmed automatically and invoice generated.', created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000042', event: 'LowStockAlert', ruleName: 'Stock < Minimum Check', status: 'warning', message: 'Product "Smart Watch Ultra" reached low stock (3 remaining). Admin alerted.', created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000043', event: 'CouponExpiredCheck', ruleName: 'Disable Expired Coupons', status: 'success', message: 'Expired coupon "SUMMER2025" automatically disabled.', created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000044', event: 'EmailDispatch', ruleName: 'Shipping Notification', status: 'failure', message: 'Failed to send tracking email to walid.ship@yahoo.com (SMTP Timeout).', created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    { id: '00000000-0000-0000-0000-000000000045', event: 'CustomerRegistered', ruleName: 'Welcome Email Automation', status: 'success', message: 'Welcome email sent to sarah.store@hotmail.com with discount code.', created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString() },
  ]);

  // Filter, Search, Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure' | 'warning'>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadAllAutomationData();

    // Admin UI Heartbeat: Refresh automation status & logs from Supabase every 60s
    const heartbeatInterval = setInterval(() => {
      loadAllAutomationData(true);
    }, 60000);

    return () => clearInterval(heartbeatInterval);
  }, []);

  const loadAllAutomationData = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    try {
      const [dbRules, dbTasks, dbEmailQueue, dbSettings, dbLogs] = await Promise.all([
        fetchAutomationRules(),
        fetchScheduledTasks(),
        fetchEmailQueue(),
        fetchAutomationSettings(),
        fetchAutomationLogs(),
      ]);

      if (dbRules && dbRules.length > 0) {
        const loadedWorkflows: Workflow[] = dbRules
          .filter((r) => r.is_workflow)
          .map((r) => ({
            id: r.id,
            category: (r.category as Workflow['category']) || 'order',
            titleAr: r.name_ar || r.name,
            titleFr: r.name_fr || r.name,
            event: r.trigger_type,
            steps: r.workflow_steps || [],
          }));

        const loadedCustomRules: CustomRule[] = dbRules
          .filter((r) => !r.is_workflow)
          .map((r) => ({
            id: r.id,
            nameAr: r.name_ar || r.name,
            nameFr: r.name_fr || r.name,
            trigger: r.trigger_type,
            condition: r.conditions || '',
            action: r.actions || '',
            enabled: r.enabled,
            category: r.category,
          }));

        if (loadedWorkflows.length > 0) setWorkflows(loadedWorkflows);
        if (loadedCustomRules.length > 0) setCustomRules(loadedCustomRules);
      }

      if (dbTasks && dbTasks.length > 0) {
        setCronJobs(
          dbTasks.map((t) => ({
            id: t.id,
            nameAr: t.name_ar,
            nameFr: t.name_fr,
            schedule: t.schedule,
            type: (t.schedule_type as CronJob['type']) || 'daily',
            lastRun: t.last_run_at || new Date().toISOString(),
            nextRun: t.next_run_at || new Date().toISOString(),
            enabled: t.enabled,
            status: t.status === 'running' ? 'running' : 'idle',
          }))
        );
      }

      if (dbEmailQueue && dbEmailQueue.length > 0) {
        setEmailQueue(
          dbEmailQueue.map((e) => ({
            id: e.id,
            recipient: e.recipient,
            subject: e.subject,
            type: (e.type as EmailQueueItem['type']) || 'welcome',
            status: (e.status as EmailQueueItem['status']) || 'pending',
            attempts: e.attempts,
            created_at: e.created_at,
            error: e.error || undefined,
          }))
        );
        const failedCount = dbEmailQueue.filter((e) => e.status === 'failed').length;
        setFailedQueueCount(failedCount);
      }

      if (dbSettings) {
        setSettings({
          autoCancelHours: dbSettings.auto_cancel_hours,
          autoConfirmOrders: dbSettings.auto_confirm_orders,
          autoGenerateInvoices: dbSettings.auto_generate_invoices,
          lowStockThreshold: dbSettings.low_stock_threshold,
          outOfStockAutoDisable: dbSettings.out_of_stock_auto_disable,
          welcomeEmailEnabled: dbSettings.welcome_email_enabled,
          welcomeDiscountPercent: dbSettings.welcome_discount_percent,
          birthdayPromoEnabled: dbSettings.birthday_promo_enabled,
          adminAlertEmail: dbSettings.admin_alert_email,
          adminAlertSMS: dbSettings.admin_alert_sms,
          retryMaxAttempts: dbSettings.retry_max_attempts,
        });
      }

      if (dbLogs && dbLogs.length > 0) {
        setLogs(
          dbLogs.map((l) => ({
            id: l.id,
            event: l.event_type,
            ruleName: l.rule_name || 'System Rule',
            status: l.status === 'failure' ? 'failure' : l.status === 'warning' ? 'warning' : 'success',
            message: l.message,
            created_at: l.created_at,
          }))
        );
      }
    } catch (e) {
      console.error('Error loading automation data from Supabase:', e);
    } finally {
      setLoading(false);
    }
  };

  // Run Real Workflow Execution via Automation Engine
  const runWorkflow = async (wfId: string) => {
    if (runningWfId !== null) return;

    const wfIndex = workflows.findIndex((w) => w.id === wfId);
    if (wfIndex === -1) return;

    const targetWf = workflows[wfIndex];
    setRunningWfId(wfId);
    setActiveQueueCount(1);

    // Reset steps
    setWorkflows((prev) => {
      const copy = [...prev];
      copy[wfIndex] = {
        ...copy[wfIndex],
        steps: copy[wfIndex].steps.map((s) => ({ ...s, status: 'running' })),
      };
      return copy;
    });

    try {
      // Execute real domain event via engine against Supabase
      const result = await processDomainEvent(targetWf.event, {
        manualTrigger: true,
        triggeredBy: 'admin',
        wfId: targetWf.id,
      });

      // Mark steps as done
      setWorkflows((prev) => {
        const copy = [...prev];
        copy[wfIndex] = {
          ...copy[wfIndex],
          steps: copy[wfIndex].steps.map((s) => ({ ...s, status: 'done' })),
        };
        return copy;
      });

      showToast(
        tr(
          `تم تشغيل سيناريو "${targetWf.titleAr}" بنجاح مع تنفيذ ${result.executions} قواعد`,
          `Workflow "${targetWf.titleFr}" exécuté avec succès (${result.executions} règles)`
        ),
        'success'
      );

      // Refresh logs & email queue from Supabase
      await loadAllAutomationData();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Workflow execution error:', err);
      showToast(tr('حدث خطأ أثناء تشغيل سيناريو الأتمتة', 'Erreur lors de l exécution du workflow'), 'error');
    } finally {
      setActiveQueueCount(0);
      setRunningWfId(null);
      setRunningStepIdx(null);
    }
  };

  // Run Real Scheduled Cron Job via Automation Engine
  const runCronJob = async (jobId: string) => {
    setCronJobs((prev) =>
      prev.map((c) => (c.id === jobId ? { ...c, status: 'running' } : c))
    );

    try {
      // Execute real scheduled tasks & email queue in Supabase
      const result = await processScheduledTasks();

      setCronJobs((prev) =>
        prev.map((c) =>
          c.id === jobId ? { ...c, status: 'idle', lastRun: new Date().toISOString() } : c
        )
      );

      showToast(
        tr(
          `تم تنفيذ كافة المهام المجدولة يدويًا بنجاح (${result.tasksProcessed} مهام)`,
          `Tâches planifiées exécutées avec succès (${result.tasksProcessed} tâches)`
        ),
        'success'
      );

      // Reload fresh logs & queue
      await loadAllAutomationData();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Scheduled cron execution error:', err);
      setCronJobs((prev) =>
        prev.map((c) => (c.id === jobId ? { ...c, status: 'idle' } : c))
      );
      showToast(tr('فشل تنفيذ المهام المجدولة', 'Échec de l exécution de la tâche'), 'error');
    }
  };

  // Toggle Rule with Supabase persistence
  const toggleRule = async (ruleId: string) => {
    if (updatingRuleId) return;

    const targetRule = customRules.find((r) => r.id === ruleId);
    if (!targetRule) return;

    setUpdatingRuleId(ruleId);
    const newEnabled = !targetRule.enabled;

    // Optimistic state update
    setCustomRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: newEnabled } : r))
    );

    try {
      const ok = await toggleAutomationRuleStatus(ruleId, newEnabled);
      if (ok) {
        showToast(
          tr('تم تحديث وحفظ حالة قاعدة الأتمتة بنجاح في Supabase', 'Statut de la règle mis à jour et sauvegardé'),
          'success'
        );
      } else {
        throw new Error('Failed toggle');
      }
    } catch (err) {
      console.error('Failed to save rule state to Supabase:', err);
      // Rollback
      setCustomRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: targetRule.enabled } : r))
      );
      showToast(
        tr('فشل حفظ حالة القاعدة في قاعدة البيانات، تم إلغاء التغيير', 'Échec de la sauvegarde, modification annulée'),
        'error'
      );
    } finally {
      setUpdatingRuleId(null);
    }
  };

  // Create New Custom Rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.nameAr || !newRule.action) {
      showToast(tr('يرجى ملء كافة تفاصيل القاعدة', 'Veuillez remplir les détails'), 'error');
      return;
    }

    try {
      const saved = await saveAutomationRule({
        name: newRule.nameAr,
        name_ar: newRule.nameAr,
        name_fr: newRule.nameFr || newRule.nameAr,
        trigger_type: newRule.trigger,
        conditions: newRule.condition,
        actions: newRule.action,
        category: newRule.category,
        enabled: true,
        is_workflow: false,
      });

      if (saved) {
        const createdUI: CustomRule = {
          id: saved.id,
          nameAr: saved.name_ar || saved.name,
          nameFr: saved.name_fr || saved.name,
          trigger: saved.trigger_type,
          condition: saved.conditions || '',
          action: saved.actions || '',
          enabled: saved.enabled,
          category: saved.category,
        };

        setCustomRules((prev) => [createdUI, ...prev]);
        showToast(tr('تمت إضافة قاعدة الأتمتة الجديدة وحفظها بنجاح', 'Nouvelle règle ajoutée et enregistrée'), 'success');
      }
    } catch (err) {
      console.error('Failed to save created rule:', err);
      showToast(tr('تعذر حفظ القاعدة في قاعدة البيانات', 'Échec de la sauvegarde'), 'error');
    } finally {
      setShowRuleModal(false);
      setNewRule({
        nameAr: '',
        nameFr: '',
        trigger: 'Order Delivered',
        condition: 'Status == Confirmed',
        action: 'Send Notification',
        category: 'Order',
      });
    }
  };

  // Delete Custom Rule
  const handleDeleteRule = async (ruleId: string) => {
    try {
      const ok = await deleteAutomationRule(ruleId);
      if (ok) {
        setCustomRules((prev) => prev.filter((r) => r.id !== ruleId));
        showToast(tr('تم حذف القاعدة بنجاح من Supabase', 'Règle supprimée'), 'info');
      } else {
        throw new Error('Delete failed');
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
      showToast(tr('تعذر حذف القاعدة من قاعدة البيانات', 'Échec de la suppression'), 'error');
    }
  };

  // Retry Failed Email via Real Dispatch
  const retryEmail = async (emailId: string) => {
    try {
      await retryEmailQueueItem(emailId);
      const res = await processEmailQueue();
      await loadAllAutomationData();
      if (res.successCount > 0) {
        showToast(tr('تمت إعادة محاولة إرسال البريد أوتوماتيكياً عبر الخادم بنجاح', 'E-mail réexpédié avec succès'), 'success');
      } else {
        showToast(tr('فشل إعادة إرسال البريد، يرجى مراجعة سجلات الخطأ', 'Échec de la réexpédition'), 'error');
      }
    } catch (err) {
      console.error('Error retrying email:', err);
      showToast(tr('فشل إعادة إرسال البريد', 'Échec de la réexpédition'), 'error');
    }
  };

  const retryAllFailedEmails = async () => {
    try {
      await retryAllFailedEmailsDB();
      const res = await processEmailQueue();
      await loadAllAutomationData();
      showToast(
        tr(
          `تمت إعادة محاولة كافة الرسائل (${res.successCount} نجحت، ${res.failedCount} فشلت)`,
          `Traitement du طابور terminé (${res.successCount} envoyés)`
        ),
        'info'
      );
    } catch (err) {
      console.error('Error retrying all emails:', err);
      showToast(tr('فشل إعادة إرسال الرسائل الفاشلة', 'Échec de la réexpédition'), 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveAutomationSettings({
        auto_cancel_hours: settings.autoCancelHours,
        auto_confirm_orders: settings.autoConfirmOrders,
        auto_generate_invoices: settings.autoGenerateInvoices,
        low_stock_threshold: settings.lowStockThreshold,
        out_of_stock_auto_disable: settings.outOfStockAutoDisable,
        welcome_email_enabled: settings.welcomeEmailEnabled,
        welcome_discount_percent: settings.welcomeDiscountPercent,
        birthday_promo_enabled: settings.birthdayPromoEnabled,
        admin_alert_email: settings.adminAlertEmail,
        admin_alert_sms: settings.adminAlertSMS,
        retry_max_attempts: settings.retryMaxAttempts,
      });

      showToast(tr('تم حفظ إعدادات الأتمتة بنجاح في Supabase', 'Paramètres d automatisation enregistrés'), 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast(tr('فشل حفظ الإعدادات في قاعدة البيانات', 'Échec de l enregistrement'), 'error');
    }
  };

  // Export Logs CSV
  const handleExportLogs = () => {
    const exportData = filteredLogs.map((l) => ({
      ID: l.id,
      Event: l.event,
      RuleName: l.ruleName,
      Status: l.status,
      Message: l.message,
      Date: l.created_at,
    }));
    exportToCSV(exportData, `Automation_Logs_${new Date().toISOString().split('T')[0]}`);
    showToast(tr('تم تصدير سجل الأتمتة بنجاح', 'Sujet d automatisation exporté'), 'success');
  };

  // Filtered Logs calculation
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const searchLower = search.toLowerCase().trim();
      const matchSearch =
        !searchLower ||
        l.event.toLowerCase().includes(searchLower) ||
        l.ruleName.toLowerCase().includes(searchLower) ||
        l.message.toLowerCase().includes(searchLower);
      return matchStatus && matchSearch;
    });
  }, [logs, statusFilter, search]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-6">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <Zap className="w-7 h-7 text-emerald-400" />
            {tr('محرك الأتمتة والمهام الذكية', 'Moteur d Automatisation & Workflows')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {tr(
              'أتمتة معالجة الطلبات، المخزون، العروض الترويجية، وطابور الإشعارات والمهام المجدولة',
              'Automatisation des commandes, stocks, promotions, file d attente et tâches planifiées'
            )}
          </p>
        </div>

        {/* Quick Queue Stats Header Badges */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">{tr('الطابور:', 'File:')}</span>
            <span className="font-mono font-bold text-slate-100">{activeQueueCount}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">{tr('مكتمل:', 'Succès:')}</span>
            <span className="font-mono font-bold text-emerald-400">{successQueueCount}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-slate-400">{tr('فاشل:', 'Échecs:')}</span>
            <span className="font-mono font-bold text-rose-400">{failedQueueCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
            activeTab === 'workflows'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>{tr('سيناريوهات الأتمتة (Workflows)', 'Workflows')}</span>
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
            activeTab === 'builder'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{tr('منشئ القواعد (If... Then)', 'Règles (If... Then)')}</span>
        </button>

        <button
          onClick={() => setActiveTab('cron')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
            activeTab === 'cron'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{tr('المهام المجدولة (Cron Jobs)', 'Tâches Cron')}</span>
        </button>

        <button
          onClick={() => setActiveTab('emailQueue')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
            activeTab === 'emailQueue'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>{tr('طابور البريد والإشعارات', 'File E-mails')}</span>
          {emailQueue.some((e) => e.status === 'failed') && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{tr('إعدادات القواعد', 'Paramètres')}</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{tr('سجل تشغيل الأتمتة (Logs)', 'Sujet Logs')}</span>
        </button>
      </div>

      {/* TAB 1: WORKFLOWS */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {workflows.map((wf) => {
              const isCurrentRunning = runningWfId === wf.id;
              const allDone = wf.steps.every((s) => s.status === 'done');

              return (
                <div
                  key={wf.id}
                  className={`bg-slate-950 border p-5 rounded-2xl shadow-xl transition-all ${
                    isCurrentRunning
                      ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-emerald-950/60'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 block font-mono">
                        EVENT: {wf.event}
                      </span>
                      <h3 className="font-extrabold text-slate-100 text-sm mt-0.5">
                        {isAr ? wf.titleAr : wf.titleFr}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          allDone
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                        }`}
                      >
                        {allDone ? tr('جاهز / نشط', 'Actif') : tr('قيد التشغيل', 'En attente')}
                      </span>

                      <button
                        onClick={() => runWorkflow(wf.id)}
                        disabled={runningWfId !== null}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          isCurrentRunning
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-not-allowed'
                            : runningWfId !== null
                            ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 shadow-md'
                        }`}
                      >
                        {isCurrentRunning ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{tr('جاري التنفيذ...', 'Exécution...')}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{tr('تشغيل محاكاة', 'Simuler')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Steps List */}
                  <div className="space-y-2.5">
                    {wf.steps.map((step, idx) => {
                      const isStepRunning = isCurrentRunning && runningStepIdx === idx;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                            step.status === 'done'
                              ? 'bg-slate-900/80 border-slate-800'
                              : isStepRunning
                              ? 'bg-emerald-950/60 border-emerald-800/80 animate-pulse'
                              : 'bg-slate-900/30 border-slate-800/40'
                          }`}
                        >
                          {step.status === 'done' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : isStepRunning ? (
                            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-600 shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <span
                              className={`text-xs font-semibold ${
                                step.status === 'done'
                                  ? 'text-slate-200'
                                  : isStepRunning
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isAr ? step.ar : step.fr}
                            </span>
                          </div>

                          {step.status === 'done' && (
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/50">
                              DONE
                            </span>
                          )}
                          {isStepRunning && (
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800/50">
                              RUNNING
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: WORKFLOW BUILDER */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              {tr('قواعد الأتمتة المخصصة (Custom Rules Engine)', 'Règles personnalisées')}
            </h2>

            <button
              onClick={() => setShowRuleModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>{tr('إضافة قاعدة أتمتة جديدة', 'Nouvelle règle')}</span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">{tr('اسم القاعدة', 'Nom de la règle')}</th>
                    <th className="p-3.5">{tr('الحدث الشرطي (IF)', 'Déclencheur (IF)')}</th>
                    <th className="p-3.5">{tr('الشرط الإضافي (AND)', 'Condition (AND)')}</th>
                    <th className="p-3.5">{tr('الإجراء المنفذ (THEN)', 'Action (THEN)')}</th>
                    <th className="p-3.5">{tr('الحالة', 'Statut')}</th>
                    <th className="p-3.5 text-center">{tr('التحكم', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {customRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-3.5 font-bold text-slate-100">
                        {isAr ? rule.nameAr : rule.nameFr}
                      </td>
                      <td className="p-3.5 font-mono text-emerald-400 font-bold bg-slate-900/40 rounded">
                        IF {rule.trigger}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        AND {rule.condition}
                      </td>
                      <td className="p-3.5 font-mono text-amber-400 font-bold">
                        THEN {rule.action}
                      </td>
                      <td className="p-3.5">
                        <button
                          disabled={updatingRuleId === rule.id}
                          onClick={() => toggleRule(rule.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
                            updatingRuleId === rule.id
                              ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait'
                              : rule.enabled
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900'
                              : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {updatingRuleId === rule.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                              <span>{tr('جاري الحفظ...', 'Enregistrement...')}</span>
                            </>
                          ) : rule.enabled ? (
                            tr('مفعلة', 'Activée')
                          ) : (
                            tr('معطلة', 'Désactivée')
                          )}
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title={tr('حذف القاعدة', 'Supprimer')}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* TAB 3: CRON JOBS */}
      {activeTab === 'cron' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              {tr('المهام المجدولة دورياً (Cron Jobs Engine)', 'Tâches Cron')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cronJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                      SCHEDULE: {job.schedule}
                    </span>
                    <h3 className="font-extrabold text-slate-100 text-sm mt-1">
                      {isAr ? job.nameAr : job.nameFr}
                    </h3>
                  </div>

                  <button
                    onClick={() => runCronJob(job.id)}
                    disabled={job.status === 'running'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
                  >
                    {job.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                    )}
                    <span>{tr('تشغيل الآن', 'Exécuter')}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    <span>{tr('آخر تشغيل:', 'Dernière exécution:')} </span>
                    <strong className="text-slate-200 font-mono">
                      {formatDate(job.lastRun)}
                    </strong>
                  </div>
                  <div>
                    <span>{tr('التشغيل القادم:', 'Prochaine exécution:')} </span>
                    <strong className="text-emerald-400 font-mono">
                      {formatDate(job.nextRun)}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: EMAIL & NOTIFICATION QUEUE */}
      {activeTab === 'emailQueue' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              {tr('طابور الرسائل والإشعارات المباشرة', 'File d Attente des E-mails')}
            </h2>

            <button
              onClick={retryAllFailedEmails}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{tr('إعادة محاولة الرسائل الفاشلة', 'Réexpédier échecs')}</span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">{tr('المستلم', 'Destinataire')}</th>
                    <th className="p-3.5">{tr('عنوان الرسالة', 'Sujet')}</th>
                    <th className="p-3.5">{tr('نوع الإشعار', 'Type')}</th>
                    <th className="p-3.5">{tr('الحالة', 'Statut')}</th>
                    <th className="p-3.5">{tr('المحاولات', 'Essais')}</th>
                    <th className="p-3.5 text-center">{tr('إجراء', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {emailQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-3.5 font-mono text-slate-100 font-bold">{item.recipient}</td>
                      <td className="p-3.5 text-slate-200 font-medium">{item.subject}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800 uppercase">
                          {item.type}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            item.status === 'sent'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                              : item.status === 'failed'
                              ? 'bg-rose-950 text-rose-400 border-rose-800/60'
                              : 'bg-amber-950 text-amber-400 border-amber-800/60'
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                        {item.error && (
                          <p className="text-[10px] text-rose-400 font-mono mt-1">{item.error}</p>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{item.attempts} / 3</td>
                      <td className="p-3.5 text-center">
                        {item.status === 'failed' && (
                          <button
                            onClick={() => retryEmail(item.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition"
                          >
                            {tr('إعادة الإرسال', 'Réexpédier')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUTOMATION SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings className="w-5 h-5 text-emerald-400" />
              {tr('إعدادات وتفضيلات محرك الأتمتة الإجمالي', 'Paramètres Globaux d Automatisation')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Setting 1: Auto Cancel Unpaid */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  {tr('مهلة إلغاء الطلبات غير المدفوعة تلقائياً (بالساعات)', 'Délai d annulation auto (heures)')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={settings.autoCancelHours}
                  onChange={(e) =>
                    setSettings({ ...settings, autoCancelHours: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              {/* Setting 2: Low Stock Threshold */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  {tr('الحد الأدنى لتنبيهات انخفاض المخزون (قطع)', 'Seuil d alerte stock faible')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.lowStockThreshold}
                  onChange={(e) =>
                    setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              {/* Setting 3: Admin Alert Email */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  {tr('البريد الإلكتروني الرئيسي لاستلام تنبيهات الأدمن', 'Email de notification administrateur')}
                </label>
                <input
                  type="email"
                  value={settings.adminAlertEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, adminAlertEmail: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              {/* Setting 4: Welcome Discount Percent */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  {tr('نسبة خصم بريد الترحيب للعملاء الجدد (%)', 'Remise e-mail de bienvenue (%)')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.welcomeDiscountPercent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      welcomeDiscountPercent: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>
            </div>

            {/* Checkboxes Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoConfirmOrders}
                  onChange={(e) =>
                    setSettings({ ...settings, autoConfirmOrders: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-200 font-semibold">
                  {tr('تأكيد الطلبات تلقائياً فور إنشائها', 'Auto-confirmer les commandes')}
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoGenerateInvoices}
                  onChange={(e) =>
                    setSettings({ ...settings, autoGenerateInvoices: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-200 font-semibold">
                  {tr('إنشاء فواتير الشراء PDF تلقائياً', 'Générer les factures PDF auto')}
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.outOfStockAutoDisable}
                  onChange={(e) =>
                    setSettings({ ...settings, outOfStockAutoDisable: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-200 font-semibold">
                  {tr('إيقاف عرض المنتج تلقائياً عند نفاده (0)', 'Désactiver le produit à zéro stock')}
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.welcomeEmailEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, welcomeEmailEnabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-200 font-semibold">
                  {tr('إرسال البريد الترحيبي للعملاء الجدد', 'Envoyer e-mail de bienvenue')}
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
              >
                {tr('حفظ التغييرات بالإعدادات', 'Enregistrer les modifications')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 6: LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              {tr('سجل أحداث وتشغيل الأتمتة (Execution Logs)', 'Journal d Exécution')}
            </h2>

            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{tr('تصدير السجل CSV', 'Exporter CSV')}</span>
            </button>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ltr:left-3.5 rtl:right-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={tr('بحث في السجل بالحدث أو الرسالة...', 'Rechercher dans les logs...')}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-2 px-3.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'success' | 'failure' | 'warning');
                setPage(1);
              }}
              style={{ colorScheme: 'dark' }}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-100 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors cursor-pointer min-w-[150px]"
            >
              <option value="all">{tr('كافة الحالات', 'Tous les statuts')}</option>
              <option value="success">{tr('ناجحة (Success)', 'Succès')}</option>
              <option value="warning">{tr('تحذير (Warning)', 'Avertissement')}</option>
              <option value="failure">{tr('فاشلة (Failure)', 'Échecs')}</option>
            </select>
          </div>

          {/* Logs Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">{tr('الحدث', 'Événement')}</th>
                    <th className="p-3.5">{tr('اسم القاعدة / السيناريو', 'Règle / Workflow')}</th>
                    <th className="p-3.5">{tr('التفاصيل / الرسالة', 'Message')}</th>
                    <th className="p-3.5">{tr('الحالة', 'Statut')}</th>
                    <th className="p-3.5">{tr('التاريخ والوقت', 'Date & Heure')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {paginatedLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-3.5 font-mono text-emerald-400 font-bold">{l.event}</td>
                      <td className="p-3.5 font-bold text-slate-100">{l.ruleName}</td>
                      <td className="p-3.5 text-slate-300 max-w-sm truncate">{l.message}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            l.status === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                              : l.status === 'warning'
                              ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                              : 'bg-rose-950 text-rose-400 border-rose-800/60'
                          }`}
                        >
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                  {paginatedLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500 font-medium">
                        {tr('لا توجد سجلات مطابقة للبحث والحساب الحالي.', 'Aucun journal correspondant.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {tr('صفحة', 'Page')} <strong className="text-slate-100">{page}</strong> {tr('من', 'de')}{' '}
                  <strong className="text-slate-100">{totalPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 rounded-lg border border-slate-800 transition"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 rounded-lg border border-slate-800 transition"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                {tr('إضافة قاعدة أتمتة جديدة (If... Then)', 'Nouvelle règle d automatisation')}
              </h3>
              <button
                onClick={() => setShowRuleModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  {tr('اسم القاعدة بالعربية', 'Nom (Arabe)')}
                </label>
                <input
                  type="text"
                  required
                  value={newRule.nameAr}
                  onChange={(e) => setNewRule({ ...newRule, nameAr: e.target.value })}
                  placeholder="مثال: تنبيه المسؤول عند انخفاض المخزون"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  {tr('الحدث الشرطي الرئيسي (IF Trigger)', 'Déclencheur (IF)')}
                </label>
                <select
                  value={newRule.trigger}
                  onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-100 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <option value="Order Delivered">Order Delivered (توصيل الطلب)</option>
                  <option value="Stock < Minimum (5)">Stock &lt; Minimum (انخفاض المخزون)</option>
                  <option value="Coupon Expired Date">Coupon Expired (انتهاء الكوبون)</option>
                  <option value="Unpaid Order > 24 Hours">Unpaid Order &gt; 24h (طلب غير مدفوع)</option>
                  <option value="New Customer Registered">New Customer Registered (عميل جديد)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  {tr('الشرط الإضافي (AND Condition)', 'Condition (AND)')}
                </label>
                <input
                  type="text"
                  value={newRule.condition}
                  onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                  placeholder="مثال: Segment == VIP"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  {tr('الإجراء المنفذ تلقائياً (THEN Action)', 'Action (THEN)')}
                </label>
                <input
                  type="text"
                  required
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                  placeholder="مثال: Send Welcome Discount Email"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 caret-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  {tr('حفظ القاعدة', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
