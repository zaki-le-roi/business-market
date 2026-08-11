-- Automation System Database Schema Migration
-- Safe to run on existing Supabase projects.

-- 1. Automation Rules Table
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT '',
    name_ar TEXT,
    name_fr TEXT,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'order',
    trigger_type TEXT NOT NULL DEFAULT '',
    trigger_config JSONB DEFAULT '{}'::jsonb,
    conditions TEXT DEFAULT '',
    actions TEXT DEFAULT '',
    is_workflow BOOLEAN NOT NULL DEFAULT false,
    workflow_steps JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_executed_at TIMESTAMPTZ,
    next_execution_at TIMESTAMPTZ
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules_select" ON automation_rules;
CREATE POLICY "automation_rules_select" ON automation_rules FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "automation_rules_all" ON automation_rules;
CREATE POLICY "automation_rules_all" ON automation_rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_automation_rules_category ON automation_rules(category);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_workflow ON automation_rules(is_workflow);


-- 2. Automation Executions Table
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    rule_name TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'running', 'warning', 'pending', 'idle')),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT DEFAULT '',
    execution_result JSONB DEFAULT '{}'::jsonb,
    trigger_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_executions_select" ON automation_executions;
CREATE POLICY "automation_executions_select" ON automation_executions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "automation_executions_all" ON automation_executions;
CREATE POLICY "automation_executions_all" ON automation_executions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_created_at ON automation_executions(created_at DESC);


-- 3. Automation Logs Table
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    execution_id UUID REFERENCES automation_executions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL DEFAULT 'AutomationEvent',
    rule_name TEXT DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'warning', 'info')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_logs_select" ON automation_logs;
CREATE POLICY "automation_logs_select" ON automation_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "automation_logs_all" ON automation_logs;
CREATE POLICY "automation_logs_all" ON automation_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);


-- 4. Scheduled Automation Tasks (Cron Jobs) Table
CREATE TABLE IF NOT EXISTS scheduled_automation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    name_ar TEXT NOT NULL DEFAULT '',
    name_fr TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '',
    schedule_type TEXT NOT NULL DEFAULT 'daily' CHECK (schedule_type IN ('hourly', 'daily', 'weekly', 'monthly', 'custom')),
    scheduled_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'success', 'failed', 'pending')),
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT DEFAULT '',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    completed_time TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scheduled_automation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_tasks_select" ON scheduled_automation_tasks;
CREATE POLICY "scheduled_tasks_select" ON scheduled_automation_tasks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "scheduled_tasks_all" ON scheduled_automation_tasks;
CREATE POLICY "scheduled_tasks_all" ON scheduled_automation_tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_automation_tasks(status);


-- 5. Automation Settings Table
CREATE TABLE IF NOT EXISTS automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_enabled BOOLEAN NOT NULL DEFAULT true,
    default_retry_count INT NOT NULL DEFAULT 3,
    auto_cancel_hours INT NOT NULL DEFAULT 24,
    auto_confirm_orders BOOLEAN NOT NULL DEFAULT true,
    auto_generate_invoices BOOLEAN NOT NULL DEFAULT true,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    out_of_stock_auto_disable BOOLEAN NOT NULL DEFAULT true,
    welcome_email_enabled BOOLEAN NOT NULL DEFAULT true,
    welcome_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10,
    birthday_promo_enabled BOOLEAN NOT NULL DEFAULT true,
    admin_alert_email TEXT NOT NULL DEFAULT 'admin@moko.dz',
    admin_alert_sms BOOLEAN NOT NULL DEFAULT true,
    retry_max_attempts INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_settings_select" ON automation_settings;
CREATE POLICY "automation_settings_select" ON automation_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "automation_settings_all" ON automation_settings;
CREATE POLICY "automation_settings_all" ON automation_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 6. Automation Email Queue Table
CREATE TABLE IF NOT EXISTS automation_email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'welcome' CHECK (type IN ('welcome', 'invoice', 'shipping', 'alert', 'promo')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    error TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_queue_select" ON automation_email_queue;
CREATE POLICY "email_queue_select" ON automation_email_queue FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "email_queue_all" ON automation_email_queue;
CREATE POLICY "email_queue_all" ON automation_email_queue FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON automation_email_queue(status);


-- 7. Initial Seed Data
INSERT INTO automation_settings (
    global_enabled, default_retry_count, auto_cancel_hours, auto_confirm_orders,
    auto_generate_invoices, low_stock_threshold, out_of_stock_auto_disable,
    welcome_email_enabled, welcome_discount_percent, birthday_promo_enabled,
    admin_alert_email, admin_alert_sms, retry_max_attempts
)
SELECT true, 3, 24, true, true, 5, true, true, 10, true, 'admin@moko.dz', true, 3
WHERE NOT EXISTS (SELECT 1 FROM automation_settings);

INSERT INTO automation_rules (id, name, name_ar, name_fr, category, trigger_type, conditions, actions, is_workflow, workflow_steps, enabled)
VALUES
('00000000-0000-0000-0000-000000000001', 'Order Processing Workflow', 'المعالجة التلقائية للطلبات وفواتيرها', 'Traitement automatique des commandes & factures', 'order', 'OrderCreated', 'Status == Created', 'Auto Confirm & Generate Invoice', true, '[{"ar":"تأكيد الطلب تلقائياً في النظام","fr":"Auto-confirmer la commande","status":"done"},{"ar":"خصم أعداد الكميات من جدول المخزون","fr":"Déduire les quantités en stock","status":"done"},{"ar":"إنشاء فاتورة الشراء PDF تلقائياً","fr":"Générer facture PDF automatique","status":"done"},{"ar":"إشعار مسؤول المتجر عبر البريد وSMS","fr":"Notifier l admin via Email & SMS","status":"done"}]'::jsonb, true),
('00000000-0000-0000-0000-000000000002', 'Low Stock Alert Workflow', 'تنبيهات واستجابة أوتوماتيكية للمخزون', 'Alertes & mise à jour automatique des stocks', 'inventory', 'LowStockAlert', 'Stock < 5', 'Send Admin Alert & Disable Product on 0', true, '[{"ar":"فحص الكميات الأقل من الحد الأدنى (5 قطع)","fr":"Détecter les stocks < 5 articles","status":"done"},{"ar":"تحديث حالة المنتج إلى \"مخزون منخفض\"","fr":"Mettre à jour le statut en \"Stock faible\"","status":"done"},{"ar":"إرسال تنبيه لوحة تحكم الإدارة","fr":"Envoyer alerte au tableau de bord","status":"done"},{"ar":"إيقاف المنتج تلقائياً عند نفاده تماماً (0)","fr":"Désactiver le produit à épuisement (0)","status":"done"}]'::jsonb, true),
('00000000-0000-0000-0000-000000000003', 'Customer Welcome Workflow', 'أتمتة ترحيب وتفعيل حسابات العملاء', 'Automation d accueil & activation des clients', 'customer', 'CustomerRegistered', 'Is New Registration', 'Send Welcome Email & Discount Code', true, '[{"ar":"إرسال بريد ترحيبي مع كود الخصم الأول","fr":"Envoyer e-mail de bienvenue avec code","status":"done"},{"ar":"إشعار العميل بتفعيل حسابه وتوثيقه","fr":"Envoyer notification d activation","status":"done"},{"ar":"جدولة كود خصم لعيد ميلاد العميل","fr":"Programmer remise d anniversaire","status":"done"}]'::jsonb, true),
('00000000-0000-0000-0000-000000000004', 'Scheduled Promos Workflow', 'إدارة العروض والكوبونات المجدولة تلقائياً', 'Gestion automatique des promotions & coupons', 'marketing', 'MarketingScheduleCheck', 'Active Schedule Present', 'Enable Promos & Disable Expired Coupons', true, '[{"ar":"تفعيل العروض الترويجية المجدولة فور حلول وقتها","fr":"Activer les promos programmées","status":"idle"},{"ar":"إلغاء تفعيل الكوبونات فور انتهاء تاريخ صلاحيتها","fr":"Désactiver les coupons expirés","status":"idle"},{"ar":"تحديث بانرات الواجهة الرئيسية تلقائياً","fr":"Mettre à jour les bannières","status":"idle"}]'::jsonb, true),
('00000000-0000-0000-0000-000000000005', 'Shipping Notifications Workflow', 'إشعارات الدفع والتوصيل التلقائية', 'Notifications automatiques de paiement & livraison', 'notification', 'ShipmentStatusUpdated', 'Status == Shipped or Delivered', 'Send Tracking Number & Thank You Email', true, '[{"ar":"إرسال رقم التتبع ورابط شركة الشحن للعميل","fr":"Envoyer numéro de suivi au client","status":"idle"},{"ar":"إرسال إشعار التوصيل الفعلي وتحديث حالة الدفع","fr":"Notification de livraison et paiement","status":"idle"},{"ar":"إرسال بريد الشكر وطلب تقييم الخدمة","fr":"Envoyer e-mail de remerciement et avis","status":"idle"}]'::jsonb, true),
('00000000-0000-0000-0000-000000000011', 'Send Thank You Email', 'إرسال رسالة شكر عند توصيل الطلب', 'Envoyer e-mail de remerciement après livraison', 'Order', 'Order Delivered', 'Total > 0 DZD', 'Send Thank You Email & Request Review', false, null, true),
('00000000-0000-0000-0000-000000000012', 'Low Stock Admin Alert', 'تنبيه الأدمن عند انخفاض المخزون عن 5 قطع', 'Alerter admin si stock < 5', 'Inventory', 'Stock < Minimum (5)', 'Is Active Product', 'Send Admin Alert Email & Dashboard Notification', false, null, true),
('00000000-0000-0000-0000-000000000013', 'Auto Disable Expired Coupons', 'إلغاء الكوبونات المنتهية أوتوماتيكياً', 'Désactiver coupons expirés', 'Marketing', 'Coupon Expired Date', 'Is Active Coupon', 'Disable Coupon Automatically', false, null, true),
('00000000-0000-0000-0000-000000000014', 'Auto Cancel Unpaid Orders', 'إلغاء الطلبات غير المدفوعة بعد 24 ساعة', 'Annuler commandes non payées après 24h', 'Order', 'Unpaid Order > 24 Hours', 'Status == Pending', 'Set Status to Cancelled & Restore Stock', false, null, true),
('00000000-0000-0000-0000-000000000015', 'Send Welcome Coupon', 'إرسال قسيمة خصم ترحيبية للعميل الجديد', 'Envoyer coupon de bienvenue', 'Customer', 'New Customer Registered', 'Email Confirmed', 'Send Welcome Coupon (10%) via Email', false, null, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO scheduled_automation_tasks (id, name_ar, name_fr, schedule, schedule_type, last_run_at, next_run_at, enabled, status)
VALUES
('00000000-0000-0000-0000-000000000021', 'فحص صلاحية الكوبونات المجدولة والمنتجات', 'Vérification quotidienne des coupons et offres', '0 0 * * * (يومياً الساعة 00:00)', 'daily', now() - INTERVAL '14 hours', now() + INTERVAL '10 hours', true, 'idle'),
('00000000-0000-0000-0000-000000000022', 'تنظيف وإلغاء الطلبات غير المدفوعة (كل ساعة)', 'Nettoyage des commandes non payées (Chaque heure)', '0 * * * * (كل ساعة)', 'hourly', now() - INTERVAL '25 minutes', now() + INTERVAL '35 minutes', true, 'idle'),
('00000000-0000-0000-0000-000000000023', 'إرسال تقرير أداء المبيعات الأسبوعي للأدمن', 'Rapport hebdomadaire des ventes', '0 8 * * 1 (كل يوم اثنين الساعة 08:00)', 'weekly', now() - INTERVAL '3 days', now() + INTERVAL '4 days', true, 'idle'),
('00000000-0000-0000-0000-000000000024', 'فحص عروض أعياد ميلاد العملاء الشهرية', 'Offres d anniversaire mensuelles', '0 9 1 * * (أول يوم في الشهر)', 'monthly', now() - INTERVAL '12 days', now() + INTERVAL '18 days', false, 'idle')
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_email_queue (id, recipient, subject, type, status, attempts, created_at)
VALUES
('00000000-0000-0000-0000-000000000031', 'karim.client@gmail.com', 'فاتورة شرائك رقم #ORD-9821', 'invoice', 'sent', 1, now() - INTERVAL '15 minutes'),
('00000000-0000-0000-0000-000000000032', 'sarah.store@hotmail.com', 'مرحباً بك في متجرنا - كود خصم 10%', 'welcome', 'sent', 1, now() - INTERVAL '45 minutes'),
('00000000-0000-0000-0000-000000000033', 'admin@moko.dz', '⚠️ تنبيه: 3 منتجات وصل مخزونها للحد الأدنى', 'alert', 'sent', 1, now() - INTERVAL '2 hours'),
('00000000-0000-0000-0000-000000000034', 'walid.ship@yahoo.com', 'تم شحن طلبك مع رقم التتبع #TRACK-4821', 'shipping', 'failed', 3, now() - INTERVAL '5 hours'),
('00000000-0000-0000-0000-000000000035', 'amine.buyer@gmail.com', 'تأكيد استلام طلبك وشكراً لتسوقك معنا', 'promo', 'pending', 0, now() - INTERVAL '10 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_logs (id, event_type, rule_name, status, message, created_at)
VALUES
('00000000-0000-0000-0000-000000000041', 'OrderCreated', 'Auto-confirm & Generate Invoice', 'success', 'Order #ORD-9821 confirmed automatically and invoice generated.', now() - INTERVAL '12 minutes'),
('00000000-0000-0000-0000-000000000042', 'LowStockAlert', 'Stock < Minimum Check', 'warning', 'Product "Smart Watch Ultra" reached low stock (3 remaining). Admin alerted.', now() - INTERVAL '2 hours'),
('00000000-0000-0000-0000-000000000043', 'CouponExpiredCheck', 'Disable Expired Coupons', 'success', 'Expired coupon "SUMMER2025" automatically disabled.', now() - INTERVAL '6 hours'),
('00000000-0000-0000-0000-000000000044', 'EmailDispatch', 'Shipping Notification', 'failure', 'Failed to send tracking email to walid.ship@yahoo.com (SMTP Timeout).', now() - INTERVAL '5 hours'),
('00000000-0000-0000-0000-000000000045', 'CustomerRegistered', 'Welcome Email Automation', 'success', 'Welcome email sent to sarah.store@hotmail.com with discount code.', now() - INTERVAL '8 hours')
ON CONFLICT (id) DO NOTHING;
